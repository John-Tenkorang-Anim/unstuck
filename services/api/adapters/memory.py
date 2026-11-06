"""Explicit development repository; one lock makes mutations and outbox writes atomic.

This adapter is process-local. Production must use a persistent transactional adapter.
"""
import asyncio
from copy import deepcopy
from uuid import UUID

from domain.errors import Forbidden, NotFound


class MemoryRepository:
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
