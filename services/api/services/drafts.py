"""Service layer. Routers call these; these call adapters. No FastAPI, no SQL imports.

Methods raise NotBuilt until the week in the build plan (section 18) implements them.
Signatures match docs/SPEC.md section 10.
"""
from datetime import datetime
from typing import Literal
from uuid import UUID

from domain.enums import EntryKind, EvidenceKind, LinkRel
from domain.errors import NotBuilt
from domain.models import (
    CommentCreate,
    CommentView,
    EntryCreate,
    EntryDraft,
    EntryPatch,
    EntryView,
    OutcomeReportCreate,
    PersonRef,
)


from services._actor import Account

class DraftService:
    async def draft_entry(self, actor: Account, text: str | None, audio_media_id: UUID | None, kind_hint: EntryKind | None) -> EntryDraft:
        raise NotBuilt("drafts.draft_entry")
