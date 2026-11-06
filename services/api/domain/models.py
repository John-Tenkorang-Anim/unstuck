"""Public request and response models (Pydantic v2).

INV-01: no public model carries an account id. People appear only as PersonRef.
"""
from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field

from domain.enums import (
    EntryKind,
    EntryStatus,
    License,
    LinkRel,
    Outcome,
    ProblemState,
    Template,
    Verdict,
    WhyStatus,
)


class PersonRef(BaseModel):
    """How a person appears in any public payload (INV-01).

    alias: per-entry random name, e.g. "quiet-otter-41", or "Author".
    is_author: true when this person wrote the entry being viewed.
    signed_name: present only if the author signed this specific entry (v1.1).
    """

    alias: str
    is_author: bool = False
    signed_name: str | None = None


class TopicRef(BaseModel):
    slug: str
    name: str
    high_stakes: bool = False


class EntryStats(BaseModel):
    """Absolute counts (INV-04, INV-13). Never an increment."""

    same_count: int = 0
    not_same_count: int = 0
    worked_count: int = 0
    didnt_work_count: int = 0
    helped_count: int = 0
    saved_count: int = 0
    comment_count: int = 0
    solved_for_count: int = 0
    frozen: bool = False


class MediaView(BaseModel):
    id: UUID
    kind: str
    status: str
    review_status: str
    alt_text: str | None = None
    variants: dict[str, Any] = {}


class LinkView(BaseModel):
    to_id: UUID
    rel: LinkRel
    note: str | None = None


class EntryCreate(BaseModel):
    """Draft creation payload. Kind-specific requirements are enforced at publish, not here,
    so people can save partial drafts.

    context: {context_key: value}; unknown keys are rejected; values validated by context_keys.
    type_fields: validated against domain/templates/{template}.json at publish.
    """

    kind: EntryKind
    template: Template
    title: str = Field(min_length=6, max_length=160)
    goal: str
    approach: str | None = None
    result: str | None = None
    outcome: Outcome | None = None
    why_text: str | None = None
    advice: str | None = None
    lang: str
    license: License = License.CC_BY_4
    topics: list[str] = Field(default_factory=list, max_length=5)
    context: dict[str, str] = {}
    type_fields: dict[str, Any] = {}


class EntryPatch(BaseModel):
    title: str | None = Field(default=None, min_length=6, max_length=160)
    goal: str | None = None
    approach: str | None = None
    result: str | None = None
    outcome: Outcome | None = None
    why_text: str | None = None
    advice: str | None = None
    topics: list[str] | None = Field(default=None, max_length=5)
    context: dict[str, str] | None = None
    type_fields: dict[str, Any] | None = None


class EntryView(BaseModel):
    """What GET /entries/{id} returns. Never includes author_id or any account id."""

    id: UUID
    kind: EntryKind
    template: Template
    status: EntryStatus
    outcome: Outcome | None = None
    problem_state: ProblemState | None = None
    title: str
    goal: str
    approach: str | None = None
    result: str | None = None
    why_text: str | None = None
    advice: str | None = None
    why_status: WhyStatus
    author: PersonRef
    lang: str
    translation_available: bool = False
    license: License
    version: int
    topics: list[TopicRef] = []
    context: dict[str, str] = {}
    type_fields: dict[str, Any] = {}
    media: list[MediaView] = []
    stats: EntryStats
    links: list[LinkView] = []
    high_stakes: bool = False
    published_at: datetime | None = None


class OutcomeReportCreate(BaseModel):
    """A tried-it report. The allowed verdicts depend on the entry's kind."""

    verdict: Verdict
    context: dict[str, str] = {}
    note: str | None = Field(default=None, max_length=2000)


class EntryDraft(BaseModel):
    """AI draft. Never persisted by the draft endpoint; the client fills the composer with it.
    missing: fields the story didn't support, so the UI can prompt for them instead of inventing.
    """

    kind: EntryKind
    template: Template
    title: str | None = None
    goal: str | None = None
    approach: str | None = None
    result: str | None = None
    outcome: Outcome | None = None
    why_text: str | None = None
    advice: str | None = None
    context: dict[str, str] = {}
    type_fields: dict[str, Any] = {}
    missing: list[str] = []
    lang: str


class CommentCreate(BaseModel):
    type: Literal["reply", "question", "answer", "hypothesis", "evidence", "fix_tried"]
    body_md: str = Field(min_length=1, max_length=10000)
    parent_id: UUID | None = None
    lang: str
    fix_outcome: Literal["worked", "failed", "mixed"] | None = None


class CommentView(BaseModel):
    id: UUID
    parent_id: UUID | None = None
    type: str
    author: PersonRef
    body_html: str
    lang: str


class ChainStep(BaseModel):
    entry_id: UUID
    title: str
    outcome: Outcome | None = None
    what_changed: str | None = None


class ProblemDetail(BaseModel):
    type: str
    title: str
    status: int
    detail: str
    code: str


class ExplanationView(BaseModel):
    id: UUID
    entry_id: UUID
    source_comment: UUID
    direction: Literal['why_failed', 'why_worked']
    state: str = 'proposed'
    score: float = 0
    supporting: int = 0
    contradicting: int = 0
    author: PersonRef


class ClaimCitation(BaseModel):
    target_type: Literal['entry', 'explanation']
    target_id: UUID


class ClaimDraft(BaseModel):
    section: Literal['what_works', 'what_fails', 'why', 'open_questions', 'safety']
    text: str = Field(min_length=1, max_length=10000)
    citations: list[ClaimCitation] = Field(min_length=1, max_length=100)


class RevisionDraft(BaseModel):
    title: str = Field(min_length=6, max_length=160)
    claims: list[ClaimDraft] = Field(min_length=1, max_length=100)
    ai_generated: bool = False


class ClaimView(ClaimDraft):
    strength: str = 'anecdotal'


class RevisionView(BaseModel):
    id: UUID
    page_slug: str
    title: str
    claims: list[ClaimView]
    ai_generated: bool
    state: str = 'proposed'
    version: int
