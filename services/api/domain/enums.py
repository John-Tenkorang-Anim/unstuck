"""Every enum used across the API, mirroring the CHECK constraints in 0001_init.sql.

Rule: if you add a value here, add it to the migration's CHECK in the same PR,
and the other way round. T-01 compares them automatically.
"""
from enum import StrEnum


class EntryKind(StrEnum):
    EXPERIENCE = "experience"
    PROBLEM = "problem"
    SOLUTION = "solution"
    IDEA = "idea"
    DISCOVERY = "discovery"
    RESEARCH = "research"


class Template(StrEnum):
    EVERYDAY = "everyday"
    MAKING = "making"
    FARMING_FOOD = "farming_food"
    SOFTWARE = "software"
    RESEARCH = "research"
    WORK_BUSINESS = "work_business"
    COMMUNITY = "community"


class EntryStatus(StrEnum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PUBLISHED = "published"
    HIDDEN = "hidden"
    DELETED = "deleted"


class Outcome(StrEnum):
    WORKED = "worked"
    FAILED = "failed"
    MIXED = "mixed"
    ONGOING = "ongoing"


class ProblemState(StrEnum):
    OPEN = "open"
    ANSWERED = "answered"
    SOLVED = "solved"
    STALE = "stale"


class Verdict(StrEnum):
    SAME_FOR_ME = "same_for_me"
    NOT_FOR_ME = "not_for_me"
    WORKED_FOR_ME = "worked_for_me"
    DIDNT_WORK_FOR_ME = "didnt_work_for_me"
    SOLVED_FOR_ME = "solved_for_me"


class LinkRel(StrEnum):
    SOLVES = "solves"
    NEXT_ATTEMPT = "next_attempt"
    REPLICATES = "replicates"
    CONTRADICTS = "contradicts"
    BUILDS_ON = "builds_on"
    DUPLICATE_OF = "duplicate_of"


class ExplanationState(StrEnum):
    PROPOSED = "proposed"
    SUPPORTED = "supported"
    AUTHOR_CONFIRMED = "author_confirmed"
    VERIFIED = "verified"
    DISPUTED = "disputed"
    RULED_OUT = "ruled_out"


class EvidenceKind(StrEnum):
    OBSERVATION = "observation"
    MEASUREMENT = "measurement"
    FIX_WORKED = "fix_worked"
    FIX_FAILED = "fix_failed"
    REPLICATION = "replication"
    CITATION = "citation"


class ClaimStrength(StrEnum):
    ANECDOTAL = "anecdotal"
    CONSISTENT = "consistent"
    TESTED = "tested"
    VERIFIED = "verified"
    CONTESTED = "contested"


class License(StrEnum):
    CC_BY_4 = "CC-BY-4.0"
    CC_BY_SA_4 = "CC-BY-SA-4.0"
    CC0 = "CC0-1.0"


class WhyStatus(StrEnum):
    UNKNOWN = "unknown"
    SUSPECTED = "suspected"
    AUTHOR_CONFIRMED = "author_confirmed"
    VERIFIED = "verified"


class AccountStatus(StrEnum):
    ACTIVE = "active"
    LIMITED = "limited"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class LiteMode(StrEnum):
    AUTO = "auto"
    ON = "on"
    OFF = "off"


class ContextValueType(StrEnum):
    ENUM = "enum"
    NUMBER = "number"
    TEXT = "text"
    COUNTRY = "country"
    VERSION = "version"


class MediaKind(StrEnum):
    IMAGE = "image"
    VIDEO = "video"
    VIDEO_LINK = "video_link"
    PDF = "pdf"
    CSV = "csv"
    CODE = "code"
    AUDIO_NOTE = "audio_note"


class MediaStatus(StrEnum):
    PENDING = "pending"
    QUEUED = "queued"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class ReviewStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class AnnotationShape(StrEnum):
    ARROW = "arrow"
    CIRCLE = "circle"
    BOX = "box"
    LABEL = "label"


class MarkerKind(StrEnum):
    BROKE = "broke"
    WORKED = "worked"
    NOTE = "note"


class HelpedTarget(StrEnum):
    ENTRY = "entry"
    PAGE = "page"


class HelpedKind(StrEnum):
    HELPED = "helped"
    SAVED = "saved"


class CommentType(StrEnum):
    REPLY = "reply"
    QUESTION = "question"
    ANSWER = "answer"
    HYPOTHESIS = "hypothesis"
    EVIDENCE = "evidence"
    FIX_TRIED = "fix_tried"


class FixOutcome(StrEnum):
    WORKED = "worked"
    FAILED = "failed"
    MIXED = "mixed"


class CommentStatus(StrEnum):
    VISIBLE = "visible"
    HIDDEN = "hidden"
    DELETED = "deleted"


class ExplanationDirection(StrEnum):
    WHY_FAILED = "why_failed"
    WHY_WORKED = "why_worked"


class EvidenceStance(StrEnum):
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"


class StateEntity(StrEnum):
    ENTRY = "entry"
    PROBLEM = "problem"
    EXPLANATION = "explanation"
    MEDIA = "media"
    TRIAL = "trial"
    PAGE_REVISION = "page_revision"
    REPORT = "report"
    CHALLENGE = "challenge"


class TrialOutcome(StrEnum):
    WORKED = "worked"
    FAILED = "failed"
    MIXED = "mixed"


class TrialStatus(StrEnum):
    DRAFT = "draft"
    OPEN = "open"
    FULL = "full"
    CLOSED = "closed"
    CONCLUDED = "concluded"


class ParticipantStatus(StrEnum):
    JOINED = "joined"
    REPORTED = "reported"
    WITHDRAWN = "withdrawn"
    EXPIRED = "expired"


class PageStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class RevisionState(StrEnum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    SUPERSEDED = "superseded"


class ClaimSection(StrEnum):
    WHAT_WORKS = "what_works"
    WHAT_FAILS = "what_fails"
    WHY = "why"
    OPEN_QUESTIONS = "open_questions"
    SAFETY = "safety"


class CitationTarget(StrEnum):
    ENTRY = "entry"
    EXPLANATION = "explanation"
    TRIAL = "trial"


class SpaceKind(StrEnum):
    NGO = "ngo"
    LAB = "lab"
    SCHOOL = "school"
    COMPANY = "company"
    COMMUNITY = "community"
    GOVERNMENT = "government"


class SpaceRole(StrEnum):
    ADMIN = "admin"
    EDITOR = "editor"
    MEMBER = "member"


class ChallengeStatus(StrEnum):
    DRAFT = "draft"
    OPEN = "open"
    CLOSED = "closed"
    ARCHIVED = "archived"


class ChallengeItemType(StrEnum):
    ENTRY = "entry"
    TRIAL = "trial"


class DocType(StrEnum):
    ENTRY = "entry"
    PAGE = "page"
    CHALLENGE = "challenge"


class TranslationTarget(StrEnum):
    ENTRY = "entry"
    COMMENT = "comment"
    PAGE_REVISION = "page_revision"
    EXPLANATION = "explanation"


class AiOutputKind(StrEnum):
    WHY_SUMMARY = "why_summary"
    PLAN_SUMMARY = "plan_summary"
    PAGE_DRAFT = "page_draft"
    ALT_TEXT = "alt_text"
    ENTRY_DRAFT = "entry_draft"


class FollowTarget(StrEnum):
    TOPIC = "topic"
    ENTRY = "entry"
    PAGE = "page"
    CHALLENGE = "challenge"


class NotifyMode(StrEnum):
    INSTANT = "instant"
    DAILY = "daily"
    OFF = "off"


class ReportReason(StrEnum):
    HARMFUL_HOWTO = "harmful_howto"
    DANGEROUS_ADVICE = "dangerous_advice"
    PERSONAL_DATA = "personal_data"
    HARASSMENT = "harassment"
    SPAM = "spam"
    MISINFORMATION = "misinformation"
    COPYRIGHT = "copyright"
    CSAM = "csam"
    OTHER = "other"


class ReportStatus(StrEnum):
    OPEN = "open"
    REVIEWING = "reviewing"
    ACTIONED = "actioned"
    DISMISSED = "dismissed"
    APPEALED = "appealed"
    CLOSED = "closed"


class ModAction(StrEnum):
    HIDE = "hide"
    REMOVE = "remove"
    WARN = "warn"
    LIMIT = "limit"
    SUSPEND = "suspend"
    APPROVE = "approve"
    REJECT = "reject"


class AppealStatus(StrEnum):
    NONE = "none"
    PENDING = "pending"
    UPHELD = "upheld"
    REVERSED = "reversed"


# Maps each CHECK column (table.column) to the enum whose values must match. T-01.
CHECK_ENUMS: dict[str, type[StrEnum]] = {
    "accounts.status": AccountStatus,
    "account_settings.lite_mode": LiteMode,
    "context_keys.value_type": ContextValueType,
    "entries.kind": EntryKind,
    "entries.template": Template,
    "entries.status": EntryStatus,
    "entries.outcome": Outcome,
    "entries.problem_state": ProblemState,
    "entries.license": License,
    "entries.why_status": WhyStatus,
    "entry_links.rel": LinkRel,
    "media.kind": MediaKind,
    "media.status": MediaStatus,
    "media.review_status": ReviewStatus,
    "annotations.shape": AnnotationShape,
    "video_markers.kind": MarkerKind,
    "outcome_reports.verdict": Verdict,
    "helped.target_type": HelpedTarget,
    "helped.kind": HelpedKind,
    "comments.type": CommentType,
    "comments.fix_outcome": FixOutcome,
    "comments.status": CommentStatus,
    "explanations.direction": ExplanationDirection,
    "explanations.state": ExplanationState,
    "explanation_evidence.stance": EvidenceStance,
    "explanation_evidence.kind": EvidenceKind,
    "state_events.entity": StateEntity,
    "trials.status": TrialStatus,
    "trial_participants.status": ParticipantStatus,
    "trial_reports.outcome": TrialOutcome,
    "knowledge_pages.status": PageStatus,
    "page_revisions.state": RevisionState,
    "page_claims.section": ClaimSection,
    "page_claims.strength": ClaimStrength,
    "claim_citations.target_type": CitationTarget,
    "spaces.kind": SpaceKind,
    "space_members.role": SpaceRole,
    "challenges.status": ChallengeStatus,
    "challenge_items.item_type": ChallengeItemType,
    "search_docs.doc_type": DocType,
    "translations.target_type": TranslationTarget,
    "ai_outputs.kind": AiOutputKind,
    "follows.target_type": FollowTarget,
    "notification_settings.mode": NotifyMode,
    "reports.reason": ReportReason,
    "reports.status": ReportStatus,
    "moderation_actions.action": ModAction,
    "moderation_actions.appeal_status": AppealStatus,
}


ALLOWED_VERDICTS: dict[EntryKind, frozenset[Verdict]] = {
    EntryKind.EXPERIENCE: frozenset({Verdict.SAME_FOR_ME, Verdict.NOT_FOR_ME}),
    EntryKind.RESEARCH: frozenset({Verdict.SAME_FOR_ME, Verdict.NOT_FOR_ME}),
    EntryKind.SOLUTION: frozenset({Verdict.WORKED_FOR_ME, Verdict.DIDNT_WORK_FOR_ME}),
    EntryKind.IDEA: frozenset({Verdict.WORKED_FOR_ME, Verdict.DIDNT_WORK_FOR_ME}),
    EntryKind.DISCOVERY: frozenset({Verdict.WORKED_FOR_ME, Verdict.DIDNT_WORK_FOR_ME}),
    EntryKind.PROBLEM: frozenset({Verdict.SOLVED_FOR_ME}),
}
