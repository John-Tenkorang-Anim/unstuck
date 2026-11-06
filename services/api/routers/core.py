"""Typed routes for the working development core.

Sessions are injected by identity integration or seeded by a test/development harness;
no caller-supplied account identifier is accepted as authentication.
"""
from uuid import UUID
from fastapi import APIRouter, Depends, Header, Query, Request, Response

from domain.errors import Forbidden, ValidationFailed
from domain.models import EntryCreate, EntryPatch, OutcomeReportCreate

router = APIRouter(tags=['core'])


async def actor(request: Request):
    token = request.cookies.get('session')
    account = request.app.state.repo.sessions.get(token) if token else None
    if account is None:
        raise Forbidden('a valid session is required')
    request.app.state.repo.active(account)
    return account


def optional_actor(request):
    return request.app.state.repo.sessions.get(request.cookies.get('session'))


@router.post('/entries', status_code=201)
async def create(data: EntryCreate, request: Request, account=Depends(actor),
                 idempotency_key: str = Header(...)):
    return await request.app.state.entries.create_draft(account, data, idempotency_key)


@router.get('/entries/{entry_id}')
async def get(entry_id: UUID, request: Request):
    return await request.app.state.entries.get(entry_id, optional_actor(request))


@router.patch('/entries/{entry_id}')
async def edit(entry_id: UUID, data: EntryPatch, request: Request,
               account=Depends(actor), if_match: str = Header(...)):
    try:
        version = int(if_match.strip('"'))
    except ValueError:
        raise ValidationFailed('If-Match must contain an entry version') from None
    return await request.app.state.entries.edit(account, entry_id, data, version)


@router.post('/entries/{entry_id}/publish')
async def publish(entry_id: UUID, request: Request, account=Depends(actor)):
    return await request.app.state.entries.publish(account, entry_id)


@router.delete('/entries/{entry_id}', status_code=204)
async def delete(entry_id: UUID, request: Request, account=Depends(actor)):
    await request.app.state.entries.delete(account, entry_id)
    return Response(status_code=204)


@router.get('/entries/{entry_id}/history')
async def history(entry_id: UUID, request: Request):
    return await request.app.state.entries.history(entry_id, optional_actor(request))


@router.get('/entries/{entry_id}/compare')
async def compare(entry_id: UUID, request: Request):
    return await request.app.state.entries.compare_context(entry_id)


@router.post('/entries/{entry_id}/reports')
async def report(entry_id: UUID, data: OutcomeReportCreate, request: Request,
                 account=Depends(actor)):
    return await request.app.state.outcomes.report(account, entry_id, data)


@router.get('/search')
async def search(request: Request, q: str = '', cursor: str | None = None,
                 limit: int = Query(20, ge=1, le=100), kind: str | None = None,
                 template: str | None = None, outcome: str | None = None,
                 lang: str | None = None, topic: str | None = None):
    filters = {k: v for k, v in dict(kind=kind, template=template, outcome=outcome,
                                    lang=lang, topic=topic).items() if v is not None}
    return await request.app.state.search.search(q, filters, cursor=cursor, limit=limit)


@router.get('/feed')
async def feed(request: Request, cursor: str | None = None):
    return await request.app.state.search.search('', cursor=cursor)


@router.get('/topics/{slug}/feed')
async def topic_feed(slug: str, request: Request, cursor: str | None = None):
    return await request.app.state.search.search('', {'topic': slug}, cursor=cursor)


from typing import Literal
from pydantic import BaseModel, Field
from domain.enums import LinkRel
from domain.models import CommentCreate


class LinkCreate(BaseModel):
    to_id: UUID
    rel: LinkRel
    note: str | None = Field(default=None, max_length=2000)


class Resolution(BaseModel):
    by: Literal['answer', 'solution']
    target_id: UUID


class ResolutionNote(BaseModel):
    note: str = Field(min_length=1, max_length=2000)


class ImpactCreate(BaseModel):
    kind: Literal['helped', 'saved']
    saved_note: str | None = Field(default=None, max_length=2000)


@router.post('/entries/{entry_id}/comments', status_code=201)
async def comment(entry_id: UUID, data: CommentCreate, request: Request,
                  account=Depends(actor), idempotency_key: str = Header(...)):
    return await request.app.state.discussion.post(account, entry_id, data, idempotency_key)


@router.get('/entries/{entry_id}/comments')
async def comments(entry_id: UUID, request: Request):
    return await request.app.state.discussion.list(entry_id)


@router.post('/entries/{entry_id}/links', status_code=204)
async def link(entry_id: UUID, data: LinkCreate, request: Request, account=Depends(actor)):
    await request.app.state.links.link(account, entry_id, data.to_id, data.rel, data.note)
    return Response(status_code=204)


@router.get('/entries/{entry_id}/chain')
async def chain(entry_id: UUID, request: Request):
    return await request.app.state.links.chain(entry_id)


@router.post('/entries/{entry_id}/solved')
async def solve(entry_id: UUID, data: Resolution, request: Request, account=Depends(actor)):
    return await request.app.state.problems.mark_solved(account, entry_id, data.by, data.target_id)


@router.delete('/entries/{entry_id}/solved')
async def unsolve(entry_id: UUID, data: ResolutionNote, request: Request, account=Depends(actor)):
    return await request.app.state.problems.unmark_solved(account, entry_id, data.note)


@router.post('/entries/{entry_id}/helped')
async def helped(entry_id: UUID, data: ImpactCreate, request: Request, account=Depends(actor)):
    return await request.app.state.impact.helped(account, ('entry', entry_id), data.kind, data.saved_note)


@router.get('/me/impact')
async def impact(request: Request, account=Depends(actor)):
    return await request.app.state.impact.my_impact(account)


from domain.enums import EvidenceKind


class VoteCreate(BaseModel):
    up: bool


class EvidenceCreate(BaseModel):
    comment_id: UUID
    stance: Literal['supports', 'contradicts']
    kind: EvidenceKind


class ExplanationAction(BaseModel):
    note: str | None = Field(default=None, max_length=2000)


@router.post('/comments/{comment_id}/promote')
async def promote(comment_id: UUID, request: Request, account=Depends(actor)):
    return await request.app.state.explanations.promote(account, comment_id)


@router.put('/explanations/{explanation_id}/vote')
async def vote(explanation_id: UUID, data: VoteCreate, request: Request, account=Depends(actor)):
    return await request.app.state.explanations.vote(account, explanation_id, data.up)


@router.post('/explanations/{explanation_id}/evidence')
async def evidence(explanation_id: UUID, data: EvidenceCreate, request: Request, account=Depends(actor)):
    return await request.app.state.explanations.add_evidence(account, explanation_id, data.comment_id, data.stance, data.kind)


@router.post('/explanations/{explanation_id}/author-confirm')
@router.post('/explanations/{explanation_id}/verify')
@router.post('/explanations/{explanation_id}/resolve')
@router.post('/explanations/{explanation_id}/rule-out')
@router.post('/explanations/{explanation_id}/reopen')
async def explanation_action(explanation_id: UUID, data: ExplanationAction,
                             request: Request, account=Depends(actor)):
    action = request.url.path.rsplit('/', 1)[-1].replace('-', '_')
    return await request.app.state.explanations.transition(account, explanation_id, action, data.note)


from domain.models import RevisionDraft


@router.get('/pages/{slug}')
async def page(slug: str, request: Request):
    return await request.app.state.knowledge.get(slug)


@router.post('/pages/{slug}/revisions', status_code=201)
async def propose_revision(slug: str, data: RevisionDraft, request: Request, account=Depends(actor)):
    return await request.app.state.knowledge.propose_revision(account, slug, data)


@router.post('/revisions/{revision_id}/accept')
@router.post('/revisions/{revision_id}/reject')
async def decide_revision(revision_id: UUID, data: ResolutionNote, request: Request, account=Depends(actor)):
    return await request.app.state.knowledge.decide(account, revision_id,
                            request.url.path.endswith('/accept'), data.note)


class UploadCreate(BaseModel):
    kind: Literal['image', 'video', 'pdf', 'csv', 'code', 'audio_note']
    size: int = Field(gt=0)
    mime: str


class MediaPatch(BaseModel):
    alt_text: str = Field(min_length=1, max_length=2000)


@router.post('/entries/{entry_id}/media', status_code=201)
async def upload(entry_id: UUID, data: UploadCreate, request: Request,
                 account=Depends(actor), idempotency_key: str = Header(...)):
    return await request.app.state.media.request_upload(account, entry_id,
        data.kind, data.size, data.mime, idempotency_key)


@router.post('/media/{media_id}/finalize')
async def finalize(media_id: UUID, request: Request, account=Depends(actor)):
    return await request.app.state.media.finalize(account, media_id)


@router.patch('/media/{media_id}')
async def patch_media(media_id: UUID, data: MediaPatch, request: Request, account=Depends(actor)):
    repo = request.app.state.repo
    async with repo.lock:
        item = request.app.state.media.load(media_id)
        repo.entry(item['entry_id'], account, own=True)
        if not data.alt_text.strip():
            raise ValidationFailed('alt text cannot be blank')
        item['view'].alt_text = data.alt_text
        repo.emit(repo.entries[item['entry_id']])
        return item['view'].model_copy(deep=True)


@router.post('/mod/media/{media_id}/approve')
async def approve_media(media_id: UUID, request: Request, account=Depends(actor)):
    return await request.app.state.media_review.approve(account, media_id)


@router.post('/mod/media/{media_id}/reject')
async def reject_media(media_id: UUID, data: ResolutionNote, request: Request, account=Depends(actor)):
    return await request.app.state.media_review.reject(account, media_id, data.note)
