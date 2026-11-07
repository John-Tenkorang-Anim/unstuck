"""Explicit development repository; one lock makes mutations and outbox writes atomic.

This adapter is process-local. Production must use a persistent transactional adapter.
"""
import asyncio
from contextlib import asynccontextmanager
from copy import deepcopy
from datetime import datetime, timedelta, timezone
import secrets
from uuid import UUID

from adapters.repository import EntryRecord, request_digest
from domain.errors import Conflict, Forbidden, NotFound
from domain.models import PersonRef
from domain.pagination import SearchPosition


class MemoryRepository:
    supports_extended_workflows = True

    def __init__(self):
        self.lock = asyncio.Lock()
        self.entries = {}
        self.owners = {}
        self.versions = {}
        self.idempotency = {}
        self.aliases = {}
        self.reports = {}
        self.state_events = []
        self.outbox = []
        self.sessions = {}
        self.comments = {}
        self.resolutions = {}
        self.activity = {}
        self.explanations = {}
        self.media = {}
        self.pilot_accounts = set()
        self.pages = {}
        self.revisions = {}
        self.signals = {}

    async def open(self):
        pass

    async def close(self):
        pass

    async def ready(self):
        return True

    async def session_actor(self, token):
        return self.sessions.get(token) if token else None

    @asynccontextmanager
    async def transaction(self, *, readonly=False):
        async with self.lock:
            # Development parity includes rollback, not just mutual exclusion.
            before = deepcopy({k: v for k, v in vars(self).items() if k != 'lock'})
            try:
                yield MemoryTransaction(self)
            except BaseException:
                for key, value in before.items():
                    setattr(self, key, value)
                raise

    def active(self, actor):
        if actor is None or actor.status != 'active':
            raise Forbidden('an active session is required')

    def entry(self, entry_id: UUID, actor=None, *, own=False):
        entry = self.entries.get(entry_id)
        if entry is None or entry.status == 'deleted':
            raise NotFound('entry not found')
        owner = actor is not None and self.owners[entry_id] == actor.id
        if own:
            self.active(actor)
            if not owner:
                raise Forbidden('only the author may change this entry')
        elif entry.status != 'published' and not owner:
            raise NotFound('entry not found')
        return entry

    def snapshot(self, entry):
        self.versions.setdefault(entry.id, []).append(entry.model_copy(deep=True))

    def transition(self, entry, previous):
        self.state_events.append({'entity': 'entry', 'id': str(entry.id),
                                  'from': previous, 'to': entry.status})
        self.emit(entry)

    def emit(self, entry):
        stream = f'live:entry:{entry.id}' if entry.status in ('published', 'deleted', 'hidden') else 'events:internal'
        self.outbox.append((stream, deepcopy({
            'v': 1, 'name': 'stats.updated', **entry.stats.model_dump(),
        })))


class MemoryTransaction:
    def __init__(self, repo):
        self.repo = repo

    async def check_actor(self, actor):
        self.repo.active(actor)
        return actor

    async def load_entry(self, entry_id, actor=None, *, own=False, lock=False):
        entry = self.repo.entry(entry_id, actor, own=own)
        return EntryRecord(entry, self.repo.owners[entry_id],
                           self.repo.activity.get(entry_id, entry.published_at))

    async def insert_entry(self, entry, author_id):
        self.repo.entries[entry.id] = entry
        self.repo.owners[entry.id] = author_id
        self.repo.aliases[(author_id, entry.id)] = entry.author.alias

    async def save_entry(self, entry, *, content=False):
        self.repo.entries[entry.id] = entry

    async def snapshot(self, entry):
        self.repo.snapshot(entry)

    async def history(self, entry_id, *, owner):
        return [v.model_copy(deep=True) for v in self.repo.versions[entry_id]
                if owner or v.status == 'published']

    async def event(self, entity, entity_id, previous, destination, actor=None, note=None):
        self.repo.state_events.append({'entity': entity, 'id': str(entity_id),
            'from': previous, 'to': destination, 'actor': actor.id if actor else None, 'note': note})

    async def emit(self, entry):
        self.repo.emit(entry)

    async def replay(self, account_id, operation, key, payload):
        token = (account_id, operation, key)
        now = datetime.now(timezone.utc)
        digest = request_digest(payload)
        old = self.repo.idempotency.get(token)
        if old and now - old['created_at'] < timedelta(hours=24):
            if old['digest'] != digest:
                raise Conflict('idempotency key was used with a different request')
            return deepcopy(old['response'])
        self.repo.idempotency[token] = {'digest': digest, 'response': None, 'created_at': now}
        return None

    async def remember(self, account_id, operation, key, response):
        self.repo.idempotency[(account_id, operation, key)]['response'] = deepcopy(response)

    async def person_ref(self, entry_id, account_id):
        key = (account_id, entry_id)
        alias = self.repo.aliases.setdefault(key, 'reader-' + secrets.token_hex(8))
        return PersonRef(alias=alias, is_author=self.repo.owners[entry_id] == account_id)

    async def topic_refs(self, slugs, lang):
        from domain.models import TopicRef
        from services.safety import HIGH_STAKES_TOPICS
        return [TopicRef(slug=slug, name=slug, high_stakes=slug in HIGH_STAKES_TOPICS)
                for slug in dict.fromkeys(slugs)]

    async def get_report(self, entry_id, account_id):
        return self.repo.reports.get((entry_id, account_id))

    async def put_report(self, entry_id, account_id, data):
        self.repo.reports[(entry_id, account_id)] = data.model_copy(deep=True)

    async def reports_for(self, entry_id):
        return [r for (target, _), r in self.repo.reports.items() if target == entry_id]

    async def get_signal(self, entry_id, account_id):
        item = self.repo.signals.get((account_id, entry_id))
        return item['kind'] if item else None

    async def put_signal(self, entry_id, account_id, kind, note):
        self.repo.signals[(account_id, entry_id)] = {'kind': kind, 'note': note}

    async def impact(self, author_id):
        targets = {key for key, owner in self.repo.owners.items() if owner == author_id}
        signals = [(who, signal['kind']) for (who, target), signal in self.repo.signals.items()
                   if target in targets]
        return len({who for who, _ in signals}), {
            kind: sum(value == kind for _, value in signals) for kind in ('helped', 'saved')}

    async def get_comment(self, comment_id):
        return self.repo.comments.get(comment_id)

    async def insert_comment(self, record):
        self.repo.comments[record['view'].id] = record

    async def comments_for(self, entry_id):
        return [c['view'].model_copy(deep=True) for c in self.repo.comments.values()
                if c['entry_id'] == entry_id]

    async def touch(self, entry_id, at):
        self.repo.activity[entry_id] = at

    async def put_resolution(self, entry_id, by, target_id):
        if by is None:
            self.repo.resolutions.pop(entry_id, None)
        else:
            self.repo.resolutions[entry_id] = (by, target_id)

    async def stale_entries(self, before, limit):
        rows = []
        for entry in sorted(self.repo.entries.values(), key=lambda e: str(e.id)):
            activity = self.repo.activity.get(entry.id, entry.published_at)
            if (entry.status == 'published' and entry.kind == 'problem' and
                entry.problem_state in ('open', 'answered') and activity and activity <= before):
                rows.append(EntryRecord(entry, self.repo.owners[entry.id], activity))
        return rows[:limit]

    async def lock_graph(self):
        pass

    async def lock_entries(self, entry_ids):
        pass

    async def put_link(self, from_id, to_id, rel, actor_id, note):
        from domain.models import LinkView
        links = self.repo.entries[from_id].links
        if not any(link.to_id == to_id and link.rel == rel for link in links):
            links.append(LinkView(to_id=to_id, rel=rel, note=note))

    async def search(self, terms, filters, viewer_ctx, after, limit):
        scored = []
        for entry in self.repo.entries.values():
            if entry.status != 'published':
                continue
            if any((value not in [t.slug for t in entry.topics] if key == 'topic' else
                    str(getattr(entry, key)) != value) for key, value in filters.items()):
                continue
            text = ' '.join(filter(None, [entry.title, entry.goal, entry.approach, entry.result])).lower()
            if terms and not all(term in text for term in terms):
                continue
            score = sum(text.count(term) for term in terms)
            score += sum(entry.context.get(k) == v for k, v in viewer_ctx.items())
            scored.append((score, entry.published_at, str(entry.id), entry))
        scored.sort(key=lambda row: row[:3], reverse=True)
        if after is not None:
            scored = [row for row in scored if row[:3] <
                      (after.score, after.published_at, str(after.entry_id))]
        rows = scored[:limit]
        last = rows[-1] if rows and len(scored) > limit else None
        position = SearchPosition(last[0], last[1], last[3].id) if last else None
        return [row[3].model_copy(deep=True) for row in rows], position
