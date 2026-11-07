"""App factory, middleware, error handlers, OpenAPI.

Routers validate, load the session, and call one service. They do not write SQL.
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from domain.errors import DomainError
from settings import get_settings

from routers import all_routers


def create_app(repo=None, blob=None) -> FastAPI:
    settings = get_settings()
    app = FastAPI(title=settings.PRODUCT_NAME, version="0.1.0")

    from adapters.memory import MemoryRepository
    from services.entries import EntryService
    from services.outcomes import OutcomeService
    from services.search import SearchService
    from routers.core import router as core_router

    from adapters.fakes import FakeBlobStore
    if settings.APP_ENV == 'production' and (
        repo is None or blob is None or isinstance(repo, MemoryRepository) or isinstance(blob, FakeBlobStore)
    ):
        raise RuntimeError('Production requires persistent repository and object-store adapters; development fakes cannot be used.')
    app.state.repo = repo if repo is not None else MemoryRepository()
    app.state.entries = EntryService(app.state.repo)
    app.state.outcomes = OutcomeService(app.state.repo)
    app.state.search = SearchService(app.state.repo)
    from services.discussion import DiscussionService
    from services.entries import LinkService
    from services.problems import ProblemService
    from services.outcomes import ImpactService
    app.state.discussion = DiscussionService(app.state.repo)
    app.state.links = LinkService(app.state.repo)
    app.state.problems = ProblemService(app.state.repo)
    app.state.impact = ImpactService(app.state.repo)
    from services.explanations import ExplanationService
    app.state.explanations = ExplanationService(app.state.repo)
    from services.knowledge import KnowledgeService
    app.state.knowledge = KnowledgeService(app.state.repo)
    from services.media import MediaService
    from services.media_review import MediaReviewService
    app.state.blob = blob if blob is not None else FakeBlobStore()
    app.state.media = MediaService(app.state.repo, app.state.blob)
    app.state.media_review = MediaReviewService(app.state.repo, app.state.blob)

    @app.exception_handler(DomainError)
    async def domain_error(_request: Request, exc: DomainError) -> JSONResponse:
        body = {
            "type": f"https://unstuck.dev/problems/{exc.code}",
            "title": exc.code,
            "status": exc.status,
            "detail": exc.detail,
            "code": exc.code,
        }
        headers = {}
        if exc.retry_after is not None:
            headers["Retry-After"] = str(exc.retry_after)
        return JSONResponse(status_code=exc.status, content=body, headers=headers)

    @app.get("/healthz", tags=["meta"])
    async def healthz() -> dict:
        return {"ok": True, "product": settings.PRODUCT_NAME}

    app.include_router(core_router, prefix="/api/v1")
    implemented = {(route.path, method) for route in app.routes
                   for method in getattr(route, "methods", ())}
    for router in all_routers:
        # Keep contracts for unfinished areas, without shadowing implemented routes.
        for route in router.routes:
            if any(("/api/v1" + route.path, method) in implemented for method in route.methods):
                continue
            app.add_api_route("/api/v1" + route.path, route.endpoint,
                              methods=list(route.methods), tags=route.tags)
    return app


app = create_app()
