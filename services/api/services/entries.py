"""Entry lifecycle with optimistic concurrency, private drafts and atomic events."""
from datetime import datetime, timezone
from uuid import uuid4

from adapters.memory import MemoryRepository
from domain.enums import EntryStatus, ProblemState, WhyStatus
from domain.errors import Conflict, StaleVersion, ValidationFailed
from domain.models import EntryStats, EntryView, TopicRef
from domain.validation import validate_entry
from services.alias import AliasService
from services.safety import SafetyService, HIGH_STAKES_TOPICS
from settings import get_settings


class EntryService:
    def __init__(self, repo=None):
        self.repo = repo if repo is not None else MemoryRepository()
        self.aliases = AliasService()

    async def create_draft(self, actor, data, idem_key):
        self.repo.active(actor)
        if not idem_key or len(idem_key) > 200:
            raise ValidationFailed('an idempotency key of at most 200 characters is required')
        validate_entry(data)
        async with self.repo.lock:
            key = (actor.id, idem_key)
            payload = data.model_dump(mode='json')
            if key in self.repo.idempotency:
                previous, entry_id = self.repo.idempotency[key]
                if previous != payload:
                    raise Conflict('idempotency key was used with a different request')
                return self.repo.entry(entry_id, actor).model_copy(deep=True)
            entry_id = uuid4()
            self.repo.owners[entry_id] = actor.id
            values = data.model_dump(exclude={'topics'})
            entry = EntryView(**values, id=entry_id, status=EntryStatus.DRAFT,
                why_status=WhyStatus.UNKNOWN, version=1, stats=EntryStats(),
                author=await self.aliases.person_ref(self.repo, actor.id, entry_id),
                topics=[TopicRef(slug=slug, name=slug, high_stakes=slug in HIGH_STAKES_TOPICS) for slug in data.topics])
            self.repo.entries[entry_id] = entry
            self.repo.idempotency[key] = (payload, entry_id)
            self.repo.snapshot(entry)
            # Draft creation is private and must never reach the public event stream.
            return entry.model_copy(deep=True)

    async def get(self, entry_id, actor=None):
        return self.repo.entry(entry_id, actor).model_copy(deep=True)

    async def edit(self, actor, entry_id, patch, if_match):
        async with self.repo.lock:
            entry = self.repo.entry(entry_id, actor, own=True)
            if entry.version != if_match:
                raise StaleVersion('entry changed; reload before editing')
            changes = patch.model_dump(exclude_unset=True)
            for field in ('title', 'goal', 'topics', 'context', 'type_fields'):
                if field in changes and changes[field] is None:
                    raise ValidationFailed(f'{field} cannot be null')
            if 'topics' in changes:
                changes['topics'] = [TopicRef(slug=s, name=s, high_stakes=s in HIGH_STAKES_TOPICS) for s in changes['topics']]
            updated = EntryView.model_validate({**entry.model_dump(), **changes,
                                                'version': entry.version + 1})
            validate_entry(updated, publish=entry.status == EntryStatus.PUBLISHED)
            scan = await SafetyService().scan_entry(updated)
            updated.high_stakes = scan['high_stakes']
            # Sensitive edits invalidate the previous publication approval.
            if scan['status'] == 'flagged' and entry.status == EntryStatus.PUBLISHED:
                updated.status = EntryStatus.PENDING_REVIEW
            self.repo.entries[entry_id] = updated
            self.repo.snapshot(updated)
            if updated.status != entry.status:
                self.repo.transition(updated, entry.status)
            elif updated.status == EntryStatus.PUBLISHED:
                self.repo.emit(updated)
            return updated.model_copy(deep=True)

    async def publish(self, actor, entry_id):
        async with self.repo.lock:
            entry = self.repo.entry(entry_id, actor, own=True)
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
            entry.version += 1
            self.repo.snapshot(entry)
            self.repo.transition(entry, previous)
            return entry.model_copy(deep=True)

    async def delete(self, actor, entry_id):
        async with self.repo.lock:
            entry = self.repo.entry(entry_id, actor, own=True)
            previous = entry.status
            entry.status = EntryStatus.DELETED
            entry.version += 1
            self.repo.snapshot(entry)
            self.repo.transition(entry, previous)

    async def history(self, entry_id, actor=None):
        self.repo.entry(entry_id, actor)
        owner = actor is not None and self.repo.owners[entry_id] == actor.id
        return [v.model_copy(deep=True) for v in self.repo.versions[entry_id]
                if owner or v.status == EntryStatus.PUBLISHED]

    async def compare_context(self, entry_id):
        self.repo.entry(entry_id)
        groups = {}
        for (target, _), report in self.repo.reports.items():
            if target != entry_id:
                continue
            for key, value in report.context.items():
                counts = groups.setdefault(key, {}).setdefault(value, [0, 0])
                counts[0] += 1
                counts[1] += report.verdict in ('same_for_me', 'worked_for_me', 'solved_for_me')
        return {key: {value: ({'label': 'few reports'} if n < get_settings().CONTEXT_MIN_REPORTS else
                    {'count': n, 'positive_percent': round(100 * positive / n)})
                for value, (n, positive) in values.items()} for key, values in groups.items()}


class LinkService:
    def __init__(self, repo):
        self.repo = repo

    async def link(self, actor, from_id, to_id, rel, note=None):
        from domain.enums import LinkRel
        from domain.models import LinkView
        self.repo.active(actor)
        rel = LinkRel(rel)
        async with self.repo.lock:
            source = self.repo.entry(from_id, actor, own=True)
            target = self.repo.entry(to_id)
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
                    pending.extend(link.to_id for link in self.repo.entries[current].links
                                   if link.rel == rel)
            if not any(link.to_id == to_id and link.rel == rel for link in source.links):
                source.links.append(LinkView(to_id=to_id, rel=rel, note=note))
                if source.status == 'published':
                    self.repo.emit(source)

    async def chain(self, entry_id):
        from domain.models import ChainStep
        self.repo.entry(entry_id)
        steps, pending, seen = [], [(entry_id, None)], set()
        while pending:
            current, note = pending.pop(0)
            if current in seen:
                continue
            seen.add(current)
            entry = self.repo.entries.get(current)
            if entry is None or entry.status != 'published':
                continue
            steps.append(ChainStep(entry_id=current, title=entry.title,
                                   outcome=entry.outcome, what_changed=note))
            pending.extend((link.to_id, link.note) for link in entry.links
                           if link.rel == 'next_attempt')
        return steps
