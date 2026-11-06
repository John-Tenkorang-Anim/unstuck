"""Human-maintained knowledge revisions with source-checked claim strengths."""
import re
from uuid import uuid4
from domain.errors import Conflict, Forbidden, NotFound, ValidationFailed
from domain.models import ClaimView, RevisionDraft, RevisionView
from services.explanations import ExplanationService
from settings import get_settings


class KnowledgeService:
    def __init__(self, repo):
        self.repo = repo

    def _citation(self, citation):
        if citation.target_type == 'entry':
            return self.repo.entry(citation.target_id)
        return ExplanationService(self.repo)._load(citation.target_id)['view']

    def _strength(self, claim):
        entries, explanations = {}, []
        for citation in claim.citations:
            source = self._citation(citation)
            if citation.target_type == 'entry':
                entries[source.id] = source
            else:
                explanations.append(source)
                entries[source.entry_id] = self.repo.entry(source.entry_id)
        positive = negative = 0
        contexts, replications = set(), set()
        for entry_id, entry in entries.items():
            for (target, account), report in self.repo.reports.items():
                if target != entry_id:
                    continue
                if report.verdict in ('same_for_me', 'worked_for_me', 'solved_for_me'):
                    positive += 1
                    contexts.add(tuple(sorted(report.context.items())))
                else:
                    negative += 1
        for explanation in explanations:
            for evidence in self.repo.explanations[explanation.id]['evidence'].values():
                if evidence['stance'] == 'supports' and evidence['kind'] == 'replication':
                    replications.add(evidence['owner'])
        if any(e.state == 'disputed' for e in explanations) or (negative and negative * 3 >= max(1, positive)):
            return 'contested'
        if any(e.state == 'verified' for e in explanations):
            return 'verified'
        if len(replications) >= 2:
            return 'tested'
        if positive >= 3 and len(contexts) >= 2:
            return 'consistent'
        return 'anecdotal'

    async def propose_revision(self, actor, page_slug, draft):
        if actor is not None:
            self.repo.active(actor)
        draft = draft if isinstance(draft, RevisionDraft) else RevisionDraft.model_validate(draft)
        if actor is None and not draft.ai_generated:
            raise Forbidden('system proposals must be labeled as AI-generated')
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', page_slug) or len(page_slug) > 120:
            raise ValidationFailed('invalid page slug')
        async with self.repo.lock:
            claims = [ClaimView(**claim.model_dump(), strength=self._strength(claim)) for claim in draft.claims]
            page = self.repo.pages.get(page_slug)
            version = page['version'] if page else 0
            view = RevisionView(id=uuid4(), page_slug=page_slug, title=draft.title, claims=claims,
                                ai_generated=draft.ai_generated, version=version + 1)
            if page is None:
                page = {'id': uuid4(), 'slug': page_slug, 'version': 0,
                        'accepted': None, 'maintainers': set()}
                self.repo.pages[page_slug] = page
            self.repo.revisions[view.id] = {'view': view, 'owner': actor.id if actor else None,
                                            'base_version': version}
            self.repo.state_events.append({'entity': 'page_revision', 'id': str(view.id),
                                           'from': None, 'to': 'proposed'})
            self.repo.outbox.append(('jobs:core', {'kind': 'revision.proposed', 'revision_id': str(view.id)}))
            return view.model_copy(deep=True)

    async def decide(self, actor, revision_id, accept, note):
        self.repo.active(actor)
        if not note or not note.strip():
            raise ValidationFailed('a decision note is required')
        async with self.repo.lock:
            record = self.repo.revisions.get(revision_id)
            if record is None:
                raise NotFound('revision not found')
            view = record['view']
            page = self.repo.pages[view.page_slug]
            if record['owner'] == actor.id:
                raise Forbidden('cannot decide your own revision')
            permitted = (actor.is_moderator or actor.id in page['maintainers'] or
                         (not page['maintainers'] and actor.trust_score >= get_settings().REVIEWER_MIN_TRUST))
            if not permitted:
                raise Forbidden('a maintainer or eligible reviewer is required')
            if view.state != 'proposed':
                raise Conflict('revision was already decided')
            if accept and record['base_version'] != page['version']:
                raise Conflict('page changed; propose a revised draft')
            strengths = [self._strength(claim) for claim in view.claims] if accept else None
            if accept:
                previous = page['accepted']
                if previous:
                    self.repo.revisions[previous]['view'].state = 'superseded'
                    self.repo.state_events.append({'entity': 'page_revision', 'id': str(previous),
                                                   'from': 'accepted', 'to': 'superseded'})
                page['accepted'], page['version'] = view.id, view.version
                for claim, strength in zip(view.claims, strengths):
                    claim.strength = strength
            view.state = 'accepted' if accept else 'rejected'
            self.repo.state_events.append({'entity': 'page_revision', 'id': str(view.id),
                                           'from': 'proposed', 'to': view.state})
            self.repo.outbox.append(('jobs:core', {'kind': 'page.updated', 'slug': view.page_slug}))
            return view.model_copy(deep=True)

    async def get(self, page_slug):
        page = self.repo.pages.get(page_slug)
        if not page or page['accepted'] is None:
            raise NotFound('page not found')
        view = self.repo.revisions[page['accepted']]['view']
        # Revalidate visibility on read; hiding a source must not leave its claims exposed.
        for claim in view.claims:
            for citation in claim.citations:
                self._citation(citation)
        return view.model_copy(deep=True)

    async def refresh_strengths(self, page_id):
        async with self.repo.lock:
            page = next((p for p in self.repo.pages.values() if p['id'] == page_id), None)
            if not page:
                raise NotFound('page not found')
            if page['accepted']:
                view = self.repo.revisions[page['accepted']]['view']
                strengths = [self._strength(claim) for claim in view.claims]
                for claim, strength in zip(view.claims, strengths):
                    claim.strength = strength
                self.repo.outbox.append(('jobs:core', {'kind': 'page.updated', 'slug': page['slug']}))

    async def nominate_maintainers(self, page_id):
        page = next((p for p in self.repo.pages.values() if p['id'] == page_id), None)
        if not page:
            raise NotFound('page not found')
        return list(dict.fromkeys(record['owner'] for record in self.repo.revisions.values()
                    if record['view'].page_slug == page['slug'] and record['owner'] is not None
                    and record['view'].state in ('accepted', 'superseded')))
