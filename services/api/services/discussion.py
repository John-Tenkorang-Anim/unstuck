"""Typed discussion; render plain text safely until the Markdown sanitizer is wired."""
from datetime import datetime, timezone
from html import escape
from uuid import uuid4
from adapters.repository import CoreRepository
from domain.enums import ProblemState
from domain.errors import ValidationFailed
from domain.models import CommentView


class DiscussionService:
    def __init__(self, repo: CoreRepository):
        self.repo = repo

    async def post(self, actor, entry_id, data, idem_key):
        if not idem_key or len(idem_key) > 200:
            raise ValidationFailed('an idempotency key is required')
        async with self.repo.transaction() as tx:
            actor = await tx.check_actor(actor)
            payload = {'entry_id': str(entry_id), 'comment': data.model_dump(mode='json')}
            replay = await tx.replay(actor.id, 'comment.create', idem_key, payload)
            entry = (await tx.load_entry(entry_id, lock=True)).view
            if replay is not None:
                return CommentView.model_validate(replay)
            if data.parent_id:
                parent = await tx.get_comment(data.parent_id)
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
                author=await tx.person_ref(entry_id, actor.id))
            await tx.insert_comment({'entry_id': entry_id, 'owner': actor.id,
                                     'view': view, 'data': data.model_copy(deep=True)})
            await tx.remember(actor.id, 'comment.create', idem_key, view.model_dump(mode='json'))
            entry.stats.comment_count += 1
            if data.type == 'answer' and entry.problem_state in ('open', 'stale'):
                previous = entry.problem_state
                entry.problem_state = ProblemState.ANSWERED
                await tx.event('problem', entry_id, previous, 'answered', actor)
            await tx.touch(entry_id, datetime.now(timezone.utc))
            await tx.save_entry(entry)
            await tx.emit(entry)
            return view.model_copy(deep=True)

    async def list(self, entry_id):
        async with self.repo.transaction(readonly=True) as tx:
            await tx.load_entry(entry_id)
            return await tx.comments_for(entry_id)
