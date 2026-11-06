"""Typed discussion; render plain text safely until the Markdown sanitizer is wired."""
from datetime import datetime, timezone
from html import escape
from uuid import uuid4
from domain.enums import ProblemState
from domain.errors import Conflict, ValidationFailed
from domain.models import CommentView
from services.alias import AliasService


class DiscussionService:
    def __init__(self, repo):
        self.repo = repo

    async def post(self, actor, entry_id, data, idem_key):
        self.repo.active(actor)
        if not idem_key or len(idem_key) > 200:
            raise ValidationFailed('an idempotency key is required')
        async with self.repo.lock:
            entry = self.repo.entry(entry_id)
            key = (actor.id, 'comment', idem_key)
            payload = (entry_id, data.model_dump())
            if key in self.repo.idempotency:
                previous, comment_id = self.repo.idempotency[key]
                if previous != payload:
                    raise Conflict('idempotency key was used with a different request')
                return self.repo.comments[comment_id]['view'].model_copy(deep=True)
            if data.parent_id:
                parent = self.repo.comments.get(data.parent_id)
                if parent is None or parent['entry_id'] != entry_id:
                    raise ValidationFailed('parent comment must belong to this entry')
            if data.type == 'answer' and entry.kind != 'problem':
                raise ValidationFailed('answers require a problem entry')
            if data.type == 'fix_tried' and data.fix_outcome is None:
                raise ValidationFailed('fix-tried comments require an outcome')
            if not data.body_md.strip():
                raise ValidationFailed('comment cannot be blank')
            view = CommentView(id=uuid4(), parent_id=data.parent_id, type=data.type,
                body_html='<p>' + escape(data.body_md).replace('\n', '<br>') + '</p>', lang=data.lang,
                author=await AliasService().person_ref(self.repo, actor.id, entry_id))
            self.repo.comments[view.id] = {'entry_id': entry_id, 'owner': actor.id,
                                         'view': view, 'data': data.model_copy(deep=True)}
            self.repo.idempotency[key] = (payload, view.id)
            entry.stats.comment_count += 1
            if data.type == 'answer' and entry.problem_state in ('open', 'stale'):
                previous = entry.problem_state
                entry.problem_state = ProblemState.ANSWERED
                self.repo.state_events.append({'entity': 'problem', 'id': str(entry_id),
                                               'from': previous, 'to': 'answered'})
            self.repo.activity[entry_id] = datetime.now(timezone.utc)
            self.repo.emit(entry)
            return view.model_copy(deep=True)

    async def list(self, entry_id):
        self.repo.entry(entry_id)
        return [c['view'].model_copy(deep=True) for c in self.repo.comments.values()
                if c['entry_id'] == entry_id]
