"""State machines: allowed edges succeed, other edges fail (T-03, pure half)."""
from uuid import uuid4

import pytest

from domain.errors import Forbidden, InvalidTransition, ValidationFailed
from domain.states import ENTRY_MACHINE, EXPLANATION_MACHINE, PROBLEM_MACHINE, MemoryTx


def _actor():
    class Actor:
        id = uuid4()

    return Actor()


@pytest.mark.asyncio
async def test_entry_publish_clean_and_review():
    entry_id = uuid4()
    tx = MemoryTx()
    tx.seed("entries", "status", entry_id, "draft")
    frm, to = await ENTRY_MACHINE.apply(
        tx, entry_id, "publish", _actor(), {"author"}, guard_ctx={"flagged": False, "high_stakes": False}
    )
    assert (frm, to) == ("draft", "published")
    assert len(tx.events) == 1

    entry_id = uuid4()
    tx.seed("entries", "status", entry_id, "draft")
    _, to = await ENTRY_MACHINE.apply(
        tx, entry_id, "publish", _actor(), {"author"}, guard_ctx={"high_stakes": True}
    )
    assert to == "pending_review"


@pytest.mark.asyncio
async def test_entry_publish_forbidden_for_stranger():
    entry_id = uuid4()
    tx = MemoryTx()
    tx.seed("entries", "status", entry_id, "draft")
    with pytest.raises(Forbidden):
        await ENTRY_MACHINE.apply(tx, entry_id, "publish", _actor(), {"account"})


@pytest.mark.asyncio
async def test_duplicate_transition_loses():
    entry_id = uuid4()
    tx = MemoryTx()
    tx.seed("entries", "status", entry_id, "draft")
    await ENTRY_MACHINE.apply(tx, entry_id, "delete", _actor(), {"author"})
    with pytest.raises(InvalidTransition):
        await ENTRY_MACHINE.apply(tx, entry_id, "delete", _actor(), {"author"})


def test_problem_unmark_requires_note():
    with pytest.raises(ValidationFailed):
        PROBLEM_MACHINE.resolve("solved", "unmark", {"asker"}, note=None)


def test_explanation_resolve_uses_prior_state():
    frm, to = EXPLANATION_MACHINE.resolve(
        "disputed", "resolve", {"reviewer"}, note="back to supported", to_override="supported"
    )
    assert (frm, to) == ("disputed", "supported")


def test_votes_are_not_a_transition():
    assert "vote" not in EXPLANATION_MACHINE.allowed("proposed", {"account"})
