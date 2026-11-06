"""Permissions matrix cells that do not need a database (T-30, pure half)."""
import pytest

from domain.errors import Forbidden
from domain.permissions import MATRIX, authorize


def test_matrix_covers_the_spec_actions():
    expected = {
        "read_published",
        "create",
        "edit_own",
        "publish_own",
        "delete_own",
        "tried_it",
        "helped",
        "vote",
        "promote",
        "add_evidence",
        "author_confirm",
        "verify",
        "resolve",
        "rule_out",
        "mark_solved",
        "decide_revision",
        "approve_entry",
        "link_duplicate",
        "review_media",
        "moderate",
        "report",
    }
    assert set(MATRIX) == expected


def test_author_cannot_vote_on_own_entry():
    with pytest.raises(Forbidden):
        authorize("vote", {"author", "account"})


def test_reviewer_can_verify():
    authorize("verify", {"reviewer"})


def test_stranger_cannot_moderate():
    with pytest.raises(Forbidden):
        authorize("moderate", {"account"})


def test_maintainer_cannot_decide_own_revision():
    with pytest.raises(Forbidden):
        authorize("decide_revision", {"maintainer"}, is_own=True)
