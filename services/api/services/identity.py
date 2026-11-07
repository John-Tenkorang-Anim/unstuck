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


from domain.actor import Account

class IdentityService:
    """Accounts, passkeys, recovery codes, magic links and sessions (F-16)."""

    async def register_passkey(self, attestation: dict, ui_lang: str):
        """Create an account from a WebAuthn attestation. Returns session and 10 recovery codes."""
        raise NotBuilt("identity.register_passkey")

    async def login_passkey(self, assertion: dict):
        raise NotBuilt("identity.login_passkey")

    async def request_magic_link(self, email: str) -> None:
        """Always returns normally, whether or not the email matches an account."""
        raise NotBuilt("identity.request_magic_link")

    async def consume_magic_link(self, token: str):
        raise NotBuilt("identity.consume_magic_link")

    async def recover(self, code: str):
        raise NotBuilt("identity.recover")

    async def delete_account(self, actor: Account, delete_entries: bool) -> None:
        raise NotBuilt("identity.delete_account")
