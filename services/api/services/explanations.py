"""Evidence-backed Why board. Votes affect ordering, never state."""
from datetime import datetime, timezone, timedelta
from uuid import uuid4

from domain.enums import EvidenceKind, WhyStatus
from domain.errors import Forbidden, NotFound, ValidationFailed
from domain.models import ExplanationView
from domain.states import EXPLANATION_MACHINE
from settings import get_settings


class ExplanationService:
    def __init__(self, repo, clock=None):
        self.repo = repo
        self.clock = clock or (lambda: datetime.now(timezone.utc))

    def _load(self, explanation_id):
        record = self.repo.explanations.get(explanation_id)
        if record is None:
            raise NotFound('explanation not found')
        self.repo.entry(record['view'].entry_id)
        return record

    def _refresh(self, record):
        view = record['view']
        view.supporting = sum(e['stance'] == 'supports' for e in record['evidence'].values())
        view.contradicting = sum(e['stance'] == 'contradicts' for e in record['evidence'].values())
        view.score = sum(record['votes'].values()) + .5 * (view.supporting - view.contradicting)
        states = {r['view'].state for r in self.repo.explanations.values()
                  if r['view'].entry_id == view.entry_id}
        entry = self.repo.entries[view.entry_id]
        entry.why_status = (WhyStatus.VERIFIED if 'verified' in states else
                            WhyStatus.AUTHOR_CONFIRMED if 'author_confirmed' in states else
                            WhyStatus.SUSPECTED if 'supported' in states else WhyStatus.UNKNOWN)
        self.repo.outbox.append((f'live:entry:{entry.id}', {
            'name': 'explanation.updated', 'data': view.model_dump(mode='json')}))

    def _move(self, record, event, roles, note=None, override=None):
        view = record['view']
        previous, destination = EXPLANATION_MACHINE.resolve(
            view.state, event, roles, note=note, to_override=override)
        if destination == 'disputed':
            record['prior_state'] = previous
        view.state = destination
        record['state_since'] = self.clock()
        self.repo.state_events.append({'entity': 'explanation', 'id': str(view.id),
                                       'from': previous, 'to': destination})

    async def promote(self, actor, comment_id):
        self.repo.active(actor)
        async with self.repo.lock:
            comment = self.repo.comments.get(comment_id)
            if comment is None:
                raise NotFound('comment not found')
            entry = self.repo.entry(comment['entry_id'])
            if comment['view'].type != 'hypothesis':
                raise ValidationFailed('only hypotheses can be promoted')
            for record in self.repo.explanations.values():
                if record['view'].source_comment == comment_id:
                    return record['view'].model_copy(deep=True)
            view = ExplanationView(id=uuid4(), entry_id=entry.id, source_comment=comment_id,
                direction='why_failed' if entry.kind == 'problem' or entry.outcome in ('failed', 'mixed') else 'why_worked',
                author=comment['view'].author.model_copy(deep=True))
            record = {'view': view, 'owner': comment['owner'], 'votes': {}, 'evidence': {},
                      'state_since': self.clock(), 'prior_state': None}
            self.repo.explanations[view.id] = record
            self.repo.state_events.append({'entity': 'explanation', 'id': str(view.id),
                                           'from': None, 'to': 'proposed'})
            self._refresh(record)
            return view.model_copy(deep=True)

    async def vote(self, actor, explanation_id, up):
        self.repo.active(actor)
        async with self.repo.lock:
            record = self._load(explanation_id)
            if self.repo.owners[record['view'].entry_id] == actor.id:
                raise Forbidden('entry authors cannot vote')
            record['votes'][actor.id] = max(.2, min(3., actor.trust_score)) * (1 if up else -1)
            self._refresh(record)
            return record['view'].model_copy(deep=True)

    async def add_evidence(self, actor, explanation_id, comment_id, stance, kind):
        self.repo.active(actor)
        if stance not in ('supports', 'contradicts'):
            raise ValidationFailed('invalid evidence stance')
        try:
            kind = EvidenceKind(kind)
        except ValueError:
            raise ValidationFailed('invalid evidence kind') from None
        async with self.repo.lock:
            record = self._load(explanation_id)
            view = record['view']
            comment = self.repo.comments.get(comment_id)
            if (not comment or comment['entry_id'] != view.entry_id or
                comment['owner'] != actor.id or comment['view'].type not in ('evidence', 'fix_tried')):
                raise ValidationFailed('evidence must be your evidence comment on this entry')
            if comment_id in record['evidence']:
                old = record['evidence'][comment_id]
                if old['stance'] != stance or old['kind'] != kind:
                    raise ValidationFailed('evidence is immutable')
                return view.model_copy(deep=True)
            record['evidence'][comment_id] = {'owner': actor.id, 'stance': stance, 'kind': kind,
                                             'created_at': self.clock(), 'account_created_at': actor.created_at}
            owner = self.repo.owners[view.entry_id]
            supporting = {e['owner'] for e in record['evidence'].values()
                          if e['stance'] == 'supports' and e['owner'] != owner}
            opposing = {e['owner'] for e in record['evidence'].values()
                        if e['stance'] == 'contradicts' and e['created_at'] > record['state_since']}
            if view.state == 'proposed' and len(supporting) >= 2:
                self._move(record, 'support', {'system'})
            elif view.state in ('supported', 'author_confirmed', 'verified') and len(opposing) >= 2:
                self._move(record, 'dispute', {'system'})
            self._refresh(record)
            return view.model_copy(deep=True)

    async def transition(self, actor, explanation_id, event, note=None):
        self.repo.active(actor)
        if event not in ('author_confirm', 'verify', 'resolve', 'rule_out', 'reopen'):
            raise ValidationFailed('invalid manual explanation action')
        async with self.repo.lock:
            record = self._load(explanation_id)
            entry_id = record['view'].entry_id
            roles = {'account'}
            if self.repo.owners[entry_id] == actor.id:
                roles.add('author')
            involved = ('author' in roles or any(c['owner'] == actor.id and c['entry_id'] == entry_id
                                               for c in self.repo.comments.values()))
            if actor.is_moderator:
                roles.add('moderator')
            if not involved and (actor.is_moderator or actor.trust_score >= get_settings().REVIEWER_MIN_TRUST):
                roles.add('reviewer')
                if actor.is_moderator:
                    roles.add('moderator')
            if event in ('verify', 'resolve') and 'reviewer' not in roles:
                raise Forbidden('an independent reviewer is required')
            if event == 'verify':
                settings = get_settings()
                eligible = {e['owner'] for e in record['evidence'].values()
                    if e['stance'] == 'supports' and e['kind'] in ('replication', 'fix_worked')
                    and e['owner'] != self.repo.owners[entry_id]
                    and self.clock() - e['account_created_at'] >= timedelta(days=settings.VERIFY_MIN_ACCOUNT_AGE_DAYS)}
                if len(eligible) < settings.VERIFY_MIN_REPLICATIONS:
                    raise ValidationFailed('more independent replications are required')
            if event == 'reopen' and not any(e['created_at'] > record['state_since'] for e in record['evidence'].values()):
                raise ValidationFailed('newer evidence is required to reopen')
            self._move(record, event, roles, note, record['prior_state'] if event == 'resolve' else None)
            self._refresh(record)
            return record['view'].model_copy(deep=True)
