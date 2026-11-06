"""Who may do what. The matrix below IS the test plan (T-30 walks every cell).

Roles are computed per request and per object:
  author      the entry's author
  asker       the author of a problem entry
  account     any signed-in account in good standing (status 'active')
  reviewer    moderator, OR trust_score >= REVIEWER_MIN_TRUST and NOT the author and
              NOT someone who commented, reported or presented evidence on this entry
  maintainer  in page_maintainers for this page
  moderator   accounts.is_moderator
'limited' accounts can read and report only. 'suspended' can't do anything but read.

| Action                                   | anyone | account | author | reviewer | maintainer | moderator |
|------------------------------------------|:------:|:-------:|:------:|:--------:|:----------:|:---------:|
| read published entries and pages         |   ✓    |    ✓    |   ✓    |    ✓     |     ✓      |     ✓     |
| create entry, comment, report, follow    |        |    ✓    |   ✓    |    ✓     |     ✓      |     ✓     |
| edit / publish / delete own entry        |        |         |   ✓    |          |            |           |
| tried-it report, helped, vote            |        |    ✓    |  ✗ own |    ✓     |     ✓      |     ✓     |
| promote hypothesis, add evidence         |        |    ✓    |   ✓    |    ✓     |     ✓      |     ✓     |
| author-confirm explanation               |        |         |   ✓    |          |            |           |
| verify / resolve explanation             |        |         |        |    ✓     |            |     ✓     |
| rule out explanation                     |        |         |   ✓    |          |            |     ✓     |
| mark solved                              |        |         | ✓ asker|          |            |           |
| accept / reject page revision            |        |         |        | ✓ if page has no maintainers | ✓ not own |     ✓     |
| approve high-stakes entry, link duplicate|        |         |        |    ✓     |            |     ✓     |
| approve / reject media                   |        |         |        |          |            |     ✓     |
| hide, remove, warn, limit, suspend       |        |         |        |          |            |     ✓     |
"""
from domain.errors import Forbidden
from settings import get_settings

# Action → roles that may perform it. "anyone" means no role is required.
# "not_author" means the account role is required and the author role forbids it.
MATRIX: dict[str, dict] = {
    "read_published": {"anyone": True},
    "create": {"any_of": ("account",)},
    "edit_own": {"any_of": ("author",)},
    "publish_own": {"any_of": ("author",)},
    "delete_own": {"any_of": ("author",)},
    "tried_it": {"any_of": ("account",), "forbid": ("author",)},
    "helped": {"any_of": ("account",)},
    "vote": {"any_of": ("account",), "forbid": ("author",)},
    "promote": {"any_of": ("account",)},
    "add_evidence": {"any_of": ("account",)},
    "author_confirm": {"any_of": ("author",)},
    "verify": {"any_of": ("reviewer", "moderator"), "forbid": ("involved",)},
    "resolve": {"any_of": ("reviewer", "moderator"), "forbid": ("involved",)},
    "rule_out": {"any_of": ("author", "moderator")},
    "mark_solved": {"any_of": ("asker",)},
    "decide_revision": {"any_of": ("maintainer", "reviewer", "moderator"), "forbid_own": True},
    "approve_entry": {"any_of": ("reviewer", "moderator")},
    "link_duplicate": {"any_of": ("reviewer", "moderator")},
    "review_media": {"any_of": ("moderator",)},
    "moderate": {"any_of": ("moderator",)},
    "report": {"any_of": ("account", "limited")},
}


async def roles_for(actor, obj, repos) -> set[str]:
    """Compute the actor's roles for one object (entry, explanation, page, media, report)."""
    if actor is None:
        return set()
    if actor.status != "active":
        return {"limited"} if actor.status == "limited" else set()
    roles = {"account"}
    if actor.is_moderator:
        roles.add("moderator")
    if isinstance(obj, dict):
        view = obj.get("view")
        entry_id = obj.get("entry_id") or getattr(view, "entry_id", None)
    else:
        entry_id = getattr(obj, "entry_id", None) or getattr(obj, "id", None)
    entry = repos.entries.get(entry_id)
    if entry is not None:
        if repos.owners.get(entry_id) == actor.id:
            roles.add("author")
            if entry.kind == "problem":
                roles.add("asker")
        involved = ("author" in roles or any(
            comment["entry_id"] == entry_id and comment["owner"] == actor.id
            for comment in repos.comments.values()) or
            (entry_id, actor.id) in repos.reports)
        if involved:
            roles.add("involved")
        elif actor.is_moderator or actor.trust_score >= get_settings().REVIEWER_MIN_TRUST:
            roles.add("reviewer")
    if isinstance(obj, dict) and actor.id in obj.get("maintainers", set()):
        roles.add("maintainer")
    return roles


def require(roles: set[str], *any_of: str) -> None:
    """Raise Forbidden unless roles intersect any_of."""
    if not roles.intersection(any_of):
        raise Forbidden("not allowed")


def authorize(action: str, roles: set[str], *, is_own: bool = False) -> None:
    """Apply one row of MATRIX. T-30 walks every cell."""
    rule = MATRIX[action]
    if rule.get("anyone"):
        return
    if is_own and rule.get("forbid_own"):
        raise Forbidden("cannot decide your own revision")
    forbidden = set(rule.get("forbid", ()))
    if roles & forbidden:
        raise Forbidden("not allowed on your own entry")
    require(roles, *rule["any_of"])
