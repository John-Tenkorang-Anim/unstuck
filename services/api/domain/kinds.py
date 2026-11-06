"""Publish-time requirements per entry kind (F-01). Template JSON Schema is separate.

Checked by EntryService.publish. Drafts may omit these fields (AC-01.1 applies at publish).
"""
from domain.enums import EntryKind, Outcome

# Core column names that must be non-empty, plus allowed outcomes (None = no outcome).
KIND_RULES: dict[EntryKind, dict] = {
    EntryKind.EXPERIENCE: {
        "fields": ("approach", "result", "outcome"),
        "outcomes": frozenset({Outcome.WORKED, Outcome.FAILED, Outcome.MIXED}),
    },
    EntryKind.PROBLEM: {
        "fields": ("goal", "approach"),
        "outcomes": frozenset(),
        "sets_problem_state": "open",
    },
    EntryKind.SOLUTION: {
        "fields": ("approach", "result", "outcome"),
        "outcomes": frozenset({Outcome.WORKED, Outcome.MIXED}),
    },
    EntryKind.IDEA: {
        "fields": ("approach",),
        "outcomes": frozenset(),
    },
    EntryKind.DISCOVERY: {
        "fields": ("result", "outcome"),
        "outcomes": frozenset({Outcome.WORKED, Outcome.MIXED, Outcome.ONGOING}),
    },
    EntryKind.RESEARCH: {
        "fields": ("outcome",),
        "type_fields": ("method",),
        "outcomes": frozenset({Outcome.WORKED, Outcome.FAILED, Outcome.MIXED}),
    },
}
