"""One generic state-machine helper, plus the transition tables for every machine in section 6.

Usage:
    await ENTRY_MACHINE.apply(tx, entity_id, event="publish", actor=actor, note=None,
                              guard_ctx={...})

apply() does, inside the caller's transaction:
  1. Look up (current_state, event) in the table; check the actor's role is allowed.
  2. Run the transition's guard (a pure function of guard_ctx) if it has one.
  3. UPDATE <table> SET <column> = :to WHERE id = :id AND <column> = :from
     → 0 rows: raise InvalidTransition (someone else moved it first).
  4. INSERT state_events (INV-05).
  5. Return (from_state, to_state) so the service can write outbox rows (INV-06).
It never commits; the service owns the transaction.

When several edges share (from, event), the first whose guard returns None wins.
A guard string means "this edge does not apply", not an immediate failure.
If every matching edge declines, the last reason becomes ValidationFailed.
`to == "*"` means the caller must pass to_override (explanation resolve → prior_state).
"""
from dataclasses import dataclass
from typing import Callable, Literal, Protocol
from uuid import UUID

from domain.errors import Forbidden, InvalidTransition, ValidationFailed

Role = Literal[
    "author",
    "asker",
    "account",
    "reviewer",
    "moderator",
    "maintainer",
    "system",
    "creator",
    "participant",
]


@dataclass(frozen=True)
class Transition:
    """One allowed edge. guard returns None if this edge applies, or a reason to skip it."""

    frm: str
    event: str
    to: str
    roles: frozenset[str]
    guard: Callable[[dict], str | None] | None = None
    note_required: bool = False


class StateTx(Protocol):
    async def get_state(self, table: str, column: str, entity_id: UUID) -> str | None: ...

    async def cas_state(self, table: str, column: str, entity_id: UUID, frm: str, to: str) -> int: ...

    async def insert_state_event(
        self,
        *,
        entity: str,
        entity_id: UUID,
        from_state: str | None,
        to_state: str,
        actor_id: UUID | None,
        note: str | None,
    ) -> None: ...


class MemoryTx:
    """In-memory transaction used by unit tests and weeks 1–4 fakes."""

    def __init__(self) -> None:
        self.rows: dict[tuple[str, str, UUID], str] = {}
        self.events: list[dict] = []

    def seed(self, table: str, column: str, entity_id: UUID, state: str) -> None:
        self.rows[(table, column, entity_id)] = state

    async def get_state(self, table: str, column: str, entity_id: UUID) -> str | None:
        return self.rows.get((table, column, entity_id))

    async def cas_state(self, table: str, column: str, entity_id: UUID, frm: str, to: str) -> int:
        key = (table, column, entity_id)
        if self.rows.get(key) != frm:
            return 0
        self.rows[key] = to
        return 1

    async def insert_state_event(
        self,
        *,
        entity: str,
        entity_id: UUID,
        from_state: str | None,
        to_state: str,
        actor_id: UUID | None,
        note: str | None,
    ) -> None:
        self.events.append(
            {
                "entity": entity,
                "entity_id": entity_id,
                "from_state": from_state,
                "to_state": to_state,
                "actor_id": actor_id,
                "note": note,
            }
        )


def _needs_review(ctx: dict) -> str | None:
    if ctx.get("flagged") or ctx.get("high_stakes"):
        return None
    return "does not need review"


def _is_clean(ctx: dict) -> str | None:
    if ctx.get("flagged") or ctx.get("high_stakes"):
        return "needs review"
    return None


class StateMachine:
    """A table-driven machine bound to one table and column."""

    def __init__(self, entity: str, table: str, column: str, transitions: list[Transition]) -> None:
        self.entity = entity
        self.table = table
        self.column = column
        self.transitions = transitions

    def allowed(self, state: str, role_set: set[str]) -> list[str]:
        """Events this actor may fire from `state`. The UI uses this to show buttons."""
        events: list[str] = []
        for edge in self.transitions:
            if edge.frm == state and edge.roles & role_set and edge.event not in events:
                events.append(edge.event)
        return events

    def resolve(
        self,
        state: str,
        event: str,
        roles: set[str],
        *,
        note: str | None = None,
        guard_ctx: dict | None = None,
        to_override: str | None = None,
    ) -> tuple[str, str]:
        """Pure decision. Returns (from_state, to_state) or raises a domain error."""
        ctx = guard_ctx or {}
        matched = [edge for edge in self.transitions if edge.frm == state and edge.event == event]
        if not matched:
            raise InvalidTransition(f"{self.entity} cannot {event} from {state}")
        permitted = [edge for edge in matched if edge.roles & roles]
        if not permitted:
            raise Forbidden(f"{event} is not allowed")
        chosen: Transition | None = None
        last_reason = "no applicable transition"
        for edge in permitted:
            if edge.guard is None:
                chosen = edge
                break
            reason = edge.guard(ctx)
            if reason is None:
                chosen = edge
                break
            last_reason = reason
        if chosen is None:
            raise ValidationFailed(last_reason)
        if chosen.note_required and not (note and note.strip()):
            raise ValidationFailed("a note is required")
        dest = to_override if chosen.to == "*" else chosen.to
        if dest is None or dest == "*":
            raise ValidationFailed("to_override is required")
        return state, dest

    async def apply(
        self,
        tx: StateTx,
        entity_id: UUID,
        event: str,
        actor,
        roles: set[str],
        note: str | None = None,
        guard_ctx: dict | None = None,
        to_override: str | None = None,
    ) -> tuple[str, str]:
        """Apply `event`. to_override is for edges whose destination is prior_state.

        Raises InvalidTransition, Forbidden, ValidationFailed.
        """
        current = await tx.get_state(self.table, self.column, entity_id)
        if current is None:
            raise InvalidTransition(f"{self.entity} has no current state")
        frm, to = self.resolve(
            current, event, roles, note=note, guard_ctx=guard_ctx, to_override=to_override
        )
        updated = await tx.cas_state(self.table, self.column, entity_id, frm, to)
        if updated == 0:
            raise InvalidTransition(f"{self.entity} moved before this {event}")
        actor_id = getattr(actor, "id", None) if actor is not None else None
        await tx.insert_state_event(
            entity=self.entity,
            entity_id=entity_id,
            from_state=frm,
            to_state=to,
            actor_id=actor_id,
            note=note,
        )
        return frm, to


_AUTHOR = frozenset({"author"})
_ASKER = frozenset({"asker"})
_REVIEW = frozenset({"reviewer", "moderator"})
_MOD = frozenset({"moderator"})
_SYSTEM = frozenset({"system"})
_ACCOUNT = frozenset({"account", "author", "asker", "reviewer", "moderator", "maintainer"})

ENTRY_MACHINE = StateMachine(
    "entry",
    "entries",
    "status",
    [
        Transition("draft", "publish", "published", _AUTHOR, guard=_is_clean),
        Transition("draft", "publish", "pending_review", _AUTHOR, guard=_needs_review),
        Transition("pending_review", "approve", "published", _REVIEW),
        Transition("pending_review", "return", "draft", _REVIEW, note_required=True),
        Transition("published", "hide", "hidden", _MOD),
        Transition("hidden", "appeal_won", "published", _MOD),
        Transition("draft", "delete", "deleted", _AUTHOR),
        Transition("published", "delete", "deleted", _AUTHOR),
        Transition("hidden", "delete", "deleted", _AUTHOR),
    ],
)

PROBLEM_MACHINE = StateMachine(
    "problem",
    "entries",
    "problem_state",
    [
        Transition("open", "answer", "answered", _ACCOUNT | _SYSTEM),
        Transition("answered", "solve", "solved", _ASKER),
        Transition("open", "solve", "solved", _ASKER),
        Transition("open", "stale", "stale", _SYSTEM),
        Transition("answered", "stale", "stale", _SYSTEM),
        Transition("stale", "activity", "open", _SYSTEM | _ACCOUNT),
        Transition("solved", "unmark", "answered", _ASKER, note_required=True),
    ],
)

EXPLANATION_MACHINE = StateMachine(
    "explanation",
    "explanations",
    "state",
    [
        Transition("proposed", "support", "supported", _SYSTEM),
        Transition("proposed", "author_confirm", "author_confirmed", _AUTHOR, note_required=True),
        Transition("supported", "author_confirm", "author_confirmed", _AUTHOR, note_required=True),
        Transition("supported", "verify", "verified", _REVIEW),
        Transition("author_confirmed", "verify", "verified", _REVIEW),
        Transition("supported", "dispute", "disputed", _SYSTEM),
        Transition("author_confirmed", "dispute", "disputed", _SYSTEM),
        Transition("verified", "dispute", "disputed", _SYSTEM),
        Transition("disputed", "resolve", "*", _REVIEW, note_required=True),
        Transition("disputed", "rule_out", "ruled_out", _REVIEW, note_required=True),
        Transition("proposed", "rule_out", "ruled_out", _AUTHOR | _MOD, note_required=True),
        Transition("supported", "rule_out", "ruled_out", _AUTHOR | _MOD, note_required=True),
        Transition("ruled_out", "reopen", "proposed", _ACCOUNT),
    ],
)

MEDIA_PROCESSING = StateMachine(
    "media",
    "media",
    "status",
    [
        Transition("pending", "finalize", "queued", _AUTHOR | _SYSTEM),
        Transition("queued", "claim", "processing", _SYSTEM),
        Transition("processing", "ok", "ready", _SYSTEM),
        Transition("processing", "error", "failed", _SYSTEM),
        Transition("failed", "retry", "queued", _SYSTEM),
    ],
)

MEDIA_REVIEW = StateMachine(
    "media",
    "media",
    "review_status",
    [
        Transition("pending_review", "approve", "approved", _MOD | _SYSTEM),
        Transition("pending_review", "reject", "rejected", _MOD),
        Transition("approved", "reject", "rejected", _MOD),
    ],
)

TRIAL_MACHINE = StateMachine(
    "trial",
    "trials",
    "status",
    [
        Transition("draft", "publish", "open", frozenset({"creator"})),
        Transition("open", "fill", "full", _SYSTEM),
        Transition("full", "withdraw", "open", frozenset({"participant"}) | _SYSTEM),
        Transition("open", "close", "closed", frozenset({"creator"}) | _SYSTEM),
        Transition("full", "close", "closed", frozenset({"creator"}) | _SYSTEM),
        Transition("closed", "conclude", "concluded", _SYSTEM),
    ],
)

REVISION_MACHINE = StateMachine(
    "page_revision",
    "page_revisions",
    "state",
    [
        Transition("proposed", "accept", "accepted", frozenset({"maintainer", "reviewer", "moderator"}), note_required=True),
        Transition("proposed", "reject", "rejected", frozenset({"maintainer", "reviewer", "moderator"}), note_required=True),
        Transition("accepted", "supersede", "superseded", _SYSTEM),
    ],
)

REPORT_MACHINE = StateMachine(
    "report",
    "reports",
    "status",
    [
        Transition("open", "pick", "reviewing", _MOD),
        Transition("reviewing", "action", "actioned", _MOD, note_required=True),
        Transition("reviewing", "dismiss", "dismissed", _MOD),
        Transition("actioned", "appeal", "appealed", _ACCOUNT),
        Transition("appealed", "close", "closed", _MOD),
        Transition("dismissed", "close", "closed", _SYSTEM | _MOD),
    ],
)
