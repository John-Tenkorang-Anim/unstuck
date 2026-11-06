"""One router per area in spec section 4. Handlers are contracts; services implement them."""
from fastapi import APIRouter, Request

from domain.errors import NotBuilt
from routers import auth

me = APIRouter(tags=["me"])
entries = APIRouter(tags=["entries"])
media = APIRouter(tags=["media"])
links = APIRouter(tags=["links"])
problems = APIRouter(tags=["problems"])
reports_outcome = APIRouter(tags=["reports"])
comments = APIRouter(tags=["comments"])
explanations = APIRouter(tags=["explanations"])
trials = APIRouter(tags=["trials"])
pages = APIRouter(tags=["pages"])
search = APIRouter(tags=["search"])
plan = APIRouter(tags=["plan"])
translate = APIRouter(tags=["translate"])
follows = APIRouter(tags=["follows"])
notifications = APIRouter(tags=["notifications"])
helped = APIRouter(tags=["helped"])
moderation = APIRouter(tags=["moderation"])
ai = APIRouter(tags=["ai"])


def _later(name: str):
    async def handler(request: Request):
        raise NotBuilt(name)

    handler.__name__ = name.replace(".", "_")
    return handler


me.add_api_route("/me", _later("me.get"), methods=["GET"])
me.add_api_route("/me/settings", _later("me.settings"), methods=["PATCH"])
me.add_api_route("/me", _later("me.delete"), methods=["DELETE"])
me.add_api_route("/me/impact", _later("me.impact"), methods=["GET"])

entries.add_api_route("/entries", _later("entries.create"), methods=["POST"])
entries.add_api_route("/entries/{entry_id}", _later("entries.get"), methods=["GET"])
entries.add_api_route("/entries/{entry_id}", _later("entries.edit"), methods=["PATCH"])
entries.add_api_route("/entries/{entry_id}/publish", _later("entries.publish"), methods=["POST"])
entries.add_api_route("/entries/{entry_id}/history", _later("entries.history"), methods=["GET"])
entries.add_api_route("/entries/{entry_id}/compare", _later("entries.compare"), methods=["GET"])
entries.add_api_route("/entries/{entry_id}/chain", _later("entries.chain"), methods=["GET"])
entries.add_api_route("/entries/{entry_id}/live", _later("entries.live"), methods=["GET"])

media.add_api_route("/entries/{entry_id}/media", _later("media.request"), methods=["POST"])
media.add_api_route("/media/{media_id}/finalize", _later("media.finalize"), methods=["POST"])
media.add_api_route("/media/{media_id}/annotations", _later("media.annotations"), methods=["POST"])
media.add_api_route("/media/{media_id}/markers", _later("media.markers"), methods=["POST"])
media.add_api_route("/media/{media_id}", _later("media.patch"), methods=["PATCH"])

links.add_api_route("/entries/{entry_id}/links", _later("links.create"), methods=["POST"])
links.add_api_route("/entries/{entry_id}/links/{to_id}/{rel}", _later("links.delete"), methods=["DELETE"])

reports_outcome.add_api_route("/entries/{entry_id}/reports", _later("outcomes.report"), methods=["POST"])
helped.add_api_route("/entries/{entry_id}/helped", _later("helped.entry"), methods=["POST"])
helped.add_api_route("/pages/{slug}/helped", _later("helped.page"), methods=["POST"])

problems.add_api_route("/entries/{entry_id}/solved", _later("problems.solve"), methods=["POST"])
problems.add_api_route("/entries/{entry_id}/solved", _later("problems.unsolve"), methods=["DELETE"])

comments.add_api_route("/entries/{entry_id}/comments", _later("comments.list"), methods=["GET"])
comments.add_api_route("/entries/{entry_id}/comments", _later("comments.create"), methods=["POST"])
comments.add_api_route("/comments/{comment_id}/promote", _later("comments.promote"), methods=["POST"])

explanations.add_api_route("/explanations/{explanation_id}/vote", _later("explanations.vote"), methods=["PUT"])
explanations.add_api_route("/explanations/{explanation_id}/evidence", _later("explanations.evidence"), methods=["POST"])
explanations.add_api_route("/explanations/{explanation_id}/author-confirm", _later("explanations.author_confirm"), methods=["POST"])
explanations.add_api_route("/explanations/{explanation_id}/verify", _later("explanations.verify"), methods=["POST"])
explanations.add_api_route("/explanations/{explanation_id}/resolve", _later("explanations.resolve"), methods=["POST"])
explanations.add_api_route("/explanations/{explanation_id}/rule-out", _later("explanations.rule_out"), methods=["POST"])
explanations.add_api_route("/explanations/{explanation_id}/reopen", _later("explanations.reopen"), methods=["POST"])

trials.add_api_route("/trials", _later("trials.create"), methods=["POST"])
trials.add_api_route("/trials/{trial_id}/join", _later("trials.join"), methods=["POST"])
trials.add_api_route("/trials/{trial_id}/withdraw", _later("trials.withdraw"), methods=["POST"])
trials.add_api_route("/trials/{trial_id}/report", _later("trials.report"), methods=["POST"])
trials.add_api_route("/trials/{trial_id}/close", _later("trials.close"), methods=["POST"])

pages.add_api_route("/pages/{slug}", _later("pages.get"), methods=["GET"])
pages.add_api_route("/pages/{slug}/revisions", _later("pages.revisions"), methods=["GET"])
pages.add_api_route("/pages/{slug}/revisions", _later("pages.propose"), methods=["POST"])
pages.add_api_route("/revisions/{revision_id}/accept", _later("pages.accept"), methods=["POST"])
pages.add_api_route("/revisions/{revision_id}/reject", _later("pages.reject"), methods=["POST"])

search.add_api_route("/search", _later("search.query"), methods=["GET"])
search.add_api_route("/feed", _later("feed.home"), methods=["GET"])
search.add_api_route("/topics/{slug}/feed", _later("feed.topic"), methods=["GET"])

plan.add_api_route("/plan", _later("plan.check"), methods=["POST"])
translate.add_api_route("/translate/{target_type}/{target_id}", _later("translate.get"), methods=["GET"])
follows.add_api_route("/follows", _later("follows.create"), methods=["POST"])
follows.add_api_route("/follows/{target_type}/{target_id}", _later("follows.delete"), methods=["DELETE"])

notifications.add_api_route("/notifications", _later("notifications.list"), methods=["GET"])
notifications.add_api_route("/notifications/settings", _later("notifications.settings"), methods=["PATCH"])
notifications.add_api_route("/push/subscribe", _later("notifications.push"), methods=["POST"])

moderation.add_api_route("/reports/content", _later("mod.report"), methods=["POST"])
moderation.add_api_route("/mod/queue", _later("mod.queue"), methods=["GET"])
moderation.add_api_route("/mod/{report_id}/action", _later("mod.action"), methods=["POST"])
moderation.add_api_route("/appeals", _later("mod.appeal"), methods=["POST"])
moderation.add_api_route("/mod/media", _later("mod.media_queue"), methods=["GET"])
moderation.add_api_route("/mod/media/{media_id}/approve", _later("mod.media_approve"), methods=["POST"])
moderation.add_api_route("/mod/media/{media_id}/reject", _later("mod.media_reject"), methods=["POST"])
moderation.add_api_route("/mod/review", _later("mod.review_queue"), methods=["GET"])
moderation.add_api_route("/mod/entries/{entry_id}/approve", _later("mod.entry_approve"), methods=["POST"])
moderation.add_api_route("/mod/entries/{entry_id}/return", _later("mod.entry_return"), methods=["POST"])

ai.add_api_route("/ai/draft-entry", _later("ai.draft_entry"), methods=["POST"])

all_routers = [
    auth.router,
    me,
    entries,
    media,
    links,
    problems,
    reports_outcome,
    comments,
    explanations,
    trials,
    pages,
    search,
    plan,
    translate,
    follows,
    notifications,
    helped,
    moderation,
    ai,
]
