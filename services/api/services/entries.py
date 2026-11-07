"""Entry lifecycle with optimistic concurrency, private drafts and atomic events."""
from datetime import datetime, timezone
import secrets
from uuid import uuid4

from adapters.repository import CoreRepository
from domain.enums import EntryStatus, ProblemState, WhyStatus
from domain.errors import Conflict, StaleVersion, ValidationFailed
from domain.models import EntryStats, EntryView, PersonRef
from domain.validation import validate_entry
from services.safety import SafetyService
from settings import get_settings


class EntryService:
    def __init__(self, repo: CoreRepository):
        self.repo = repo

    async def create_draft(self, actor, data, idem_key):
        if not idem_key or len(idem_key) > 200:
            raise ValidationFailed('an idempotency key of at most 200 characters is required')
        validate_entry(data)
        async with self.repo.transaction() as tx:
            actor = await tx.check_actor(actor)
            payload = data.model_dump(mode='json')
            replay = await tx.replay(actor.id, 'entry.create', idem_key, payload)
            if replay is not None:
                return EntryView.model_validate(replay)
            entry_id = uuid4()
            values = data.model_dump(exclude={'topics'})
            entry = EntryView(**values, id=entry_id, status=EntryStatus.DRAFT,
                why_status=WhyStatus.UNKNOWN, version=1, stats=EntryStats(),
                author=PersonRef(alias='reader-' + secrets.token_hex(8), is_author=True),
                problem_state=ProblemState.OPEN if data.kind == 'problem' else None,
                topics=await tx.topic_refs(data.topics, data.lang))
            await tx.insert_entry(entry, actor.id)
            await tx.snapshot(entry)
            await tx.remember(actor.id, 'entry.create', idem_key, entry.model_dump(mode='json'))
            # Draft creation is private and must never reach the public event stream.
            return entry.model_copy(deep=True)

    async def get(self, entry_id, actor=None):
        async with self.repo.transaction(readonly=True) as tx:
            return (await tx.load_entry(entry_id, actor)).view.model_copy(deep=True)

    async def edit(self, actor, entry_id, patch, if_match):
        async with self.repo.transaction() as tx:
            actor = await tx.check_actor(actor)
            entry = (await tx.load_entry(entry_id, actor, own=True, lock=True)).view
            if entry.version != if_match:
                raise StaleVersion('entry changed; reload before editing')
            changes = patch.model_dump(exclude_unset=True)
            for field in ('title', 'goal', 'topics', 'context', 'type_fields'):
                if field in changes and changes[field] is None:
                    raise ValidationFailed(f'{field} cannot be null')
            if 'topics' in changes:
                changes['topics'] = await tx.topic_refs(changes['topics'], entry.lang)
            updated = EntryView.model_validate({**entry.model_dump(), **changes,
                                                'version': entry.version + 1})
            validate_entry(updated, publish=entry.status == EntryStatus.PUBLISHED)
            scan = await SafetyService().scan_entry(updated)
            updated.high_stakes = scan['high_stakes']
            # Sensitive edits invalidate the previous publication approval.
            if scan['status'] == 'flagged' and entry.status == EntryStatus.PUBLISHED:
                updated.status = EntryStatus.PENDING_REVIEW
            await tx.save_entry(updated, content=True)
            await tx.snapshot(updated)
            if updated.status != entry.status:
                await tx.event('entry', entry_id, entry.status, updated.status, actor)
                await tx.emit(updated)
            elif updated.status == EntryStatus.PUBLISHED:
                await tx.emit(updated)
            return updated.model_copy(deep=True)

    async def publish(self, actor, entry_id):
        async with self.repo.transaction() as tx:
            actor = await tx.check_actor(actor)
            entry = (await tx.load_entry(entry_id, actor, own=True, lock=True)).view
            if entry.status in (EntryStatus.PUBLISHED, EntryStatus.PENDING_REVIEW):
                return entry.model_copy(deep=True)
            if entry.status != EntryStatus.DRAFT:
                raise Conflict('entry cannot be published from its current state')
            validate_entry(entry, publish=True)
            previous = entry.status
            scan = await SafetyService().scan_entry(entry)
            entry.high_stakes = scan['high_stakes']
            entry.status = EntryStatus.PENDING_REVIEW if scan['status'] == 'flagged' else EntryStatus.PUBLISHED
            if entry.kind == 'problem':
                entry.problem_state = ProblemState.OPEN
            if entry.status == EntryStatus.PUBLISHED:
                entry.published_at = datetime.now(timezone.utc)
                await tx.touch(entry_id, entry.published_at)
            entry.version += 1
            await tx.save_entry(entry)
            await tx.snapshot(entry)
            await tx.event('entry', entry_id, previous, entry.status, actor)
            await tx.emit(entry)
            return entry.model_copy(deep=True)

    async def delete(self, actor, entry_id):
        async with self.repo.transaction() as tx:
            actor = await tx.check_actor(actor)
            entry = (await tx.load_entry(entry_id, actor, own=True, lock=True)).view
            previous = entry.status
            entry.status = EntryStatus.DELETED
            entry.version += 1
            await tx.save_entry(entry)
            await tx.snapshot(entry)
            await tx.event('entry', entry_id, previous, entry.status, actor)
            await tx.emit(entry)

    async def history(self, entry_id, actor=None):
        async with self.repo.transaction(readonly=True) as tx:
            record = await tx.load_entry(entry_id, actor)
            return await tx.history(entry_id, owner=actor is not None and record.author_id == actor.id)

    async def compare_context(self, entry_id):
        async with self.repo.transaction(readonly=True) as tx:
            await tx.load_entry(entry_id)
            groups = {}
            for report in await tx.reports_for(entry_id):
                for key, value in report.context.items():
                    counts = groups.setdefault(key, {}).setdefault(value, [0, 0])
                    counts[0] += 1
                    counts[1] += report.verdict in ('same_for_me', 'worked_for_me', 'solved_for_me')
            return {key: {value: ({'label': 'few reports'} if n < get_settings().CONTEXT_MIN_REPORTS else
                        {'count': n, 'positive_percent': round(100 * positive / n)})
                    for value, (n, positive) in values.items()} for key, values in groups.items()}


class LinkService:
    def __init__(self, repo: CoreRepository):
        self.repo = repo

    async def link(self, actor, from_id, to_id, rel, note=None):
        from domain.enums import LinkRel
        rel = LinkRel(rel)
        async with self.repo.transaction() as tx:
            actor = await tx.check_actor(actor)
            # The graph lock prevents cycles made by concurrent edges on disjoint rows.
            if rel == LinkRel.NEXT_ATTEMPT:
                await tx.lock_graph()
            await tx.lock_entries([from_id, to_id])
            source = (await tx.load_entry(from_id, actor, own=True)).view
            target = (await tx.load_entry(to_id)).view
            if from_id == to_id:
                raise ValidationFailed('an entry cannot link to itself')
            if rel == LinkRel.DUPLICATE_OF:
                raise ValidationFailed('duplicate merging requires a reviewer workflow')
            if rel == LinkRel.SOLVES and (source.kind != 'solution' or target.kind != 'problem'):
                raise ValidationFailed('solves links must connect a solution to a problem')
            if rel == LinkRel.NEXT_ATTEMPT:
                pending, seen = [to_id], set()
                while pending:
                    current = pending.pop()
                    if current == from_id:
                        raise Conflict('attempt chains cannot contain cycles')
                    if current in seen:
                        continue
                    seen.add(current)
                    if len(seen) > 1000:
                        raise ValidationFailed('attempt chain exceeds the traversal limit')
                    node = (await tx.load_entry(current)).view
                    pending.extend(link.to_id for link in node.links
                                   if link.rel == rel)
            if not any(link.to_id == to_id and link.rel == rel for link in source.links):
                await tx.put_link(from_id, to_id, rel, actor.id, note)
                if source.status == 'published':
                    await tx.emit(source)

    async def chain(self, entry_id):
        from domain.models import ChainStep
        from domain.errors import NotFound
        async with self.repo.transaction(readonly=True) as tx:
            await tx.load_entry(entry_id)
            steps, pending, seen = [], [(entry_id, None)], set()
            while pending:
                current, note = pending.pop(0)
                if current in seen:
                    continue
                seen.add(current)
                if len(seen) > 1000:
                    raise ValidationFailed('attempt chain exceeds the traversal limit')
                try:
                    entry = (await tx.load_entry(current)).view
                except NotFound:
                    continue
                steps.append(ChainStep(entry_id=current, title=entry.title,
                                       outcome=entry.outcome, what_changed=note))
                pending.extend((link.to_id, link.note) for link in entry.links
                               if link.rel == 'next_attempt')
            return steps
