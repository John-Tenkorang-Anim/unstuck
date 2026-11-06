"""Shared validation for composer drafts, publication, and outcome context."""
import json
import math
from functools import lru_cache
from pathlib import Path

from domain.context_keys import CONTEXT_KEYS
from domain.errors import ValidationFailed
from domain.kinds import KIND_RULES


def validate_context(context, template):
    definitions = {row['key']: row for row in CONTEXT_KEYS}
    for key, value in context.items():
        row = definitions.get(key)
        if row is None or (row['templates'] and template not in row['templates']):
            raise ValidationFailed('unknown context key for this template')
        if not isinstance(value, str) or not value.strip() or len(value) > 256:
            raise ValidationFailed('context values must be nonempty strings up to 256 characters')
        if row['allowed'] and value not in row['allowed']:
            raise ValidationFailed('invalid context value')
        if row['value_type'] == 'country' and (len(value) != 2 or not value.isascii() or not value.isupper() or not value.isalpha()):
            raise ValidationFailed('country must be an uppercase two-letter code')


@lru_cache
def template_schema(template):
    return json.loads((Path(__file__).parent / 'templates' / f'{template}.json').read_text())


def validate_entry(entry, *, publish=False):
    validate_context(entry.context, entry.template)
    schema = template_schema(entry.template)
    for key, value in entry.type_fields.items():
        rule = schema['properties'].get(key)
        if rule is None:
            raise ValidationFailed('unknown template field')
        expected = rule['type']
        valid = (isinstance(value, str) if expected == 'string' else
                 type(value) is int if expected == 'integer' else
                 type(value) in (int, float) and math.isfinite(value))
        if not valid:
            raise ValidationFailed('invalid template field type')
    if not publish:
        return
    rule = KIND_RULES[entry.kind]
    for field in ('title', 'goal', *rule['fields']):
        value = getattr(entry, field)
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValidationFailed(f'{field} is required before publishing')
    for field in rule.get('type_fields', ()):
        if not entry.type_fields.get(field):
            raise ValidationFailed(f'{field} is required before publishing')
    if (entry.outcome is not None and entry.outcome not in rule['outcomes']):
        raise ValidationFailed('outcome is not allowed for this entry kind')
    for media in entry.media:
        if media.kind == 'image' and not (media.alt_text or '').strip():
            raise ValidationFailed('images need alt text before publishing')
