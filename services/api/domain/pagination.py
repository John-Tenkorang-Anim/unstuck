"""Query-bound keyset cursors. New feed entries cannot shift a later page."""
import base64
from dataclasses import dataclass
from datetime import datetime
from hashlib import sha256
import json
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator
from domain.errors import ValidationFailed


@dataclass(frozen=True)
class SearchPosition:
    score: int
    published_at: datetime
    entry_id: UUID


class CursorPayload(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    v: Literal[1] = 1
    query: str = Field(pattern=r'^[a-f0-9]{64}$')
    score: int = Field(ge=0, le=2**63 - 1)
    published_at: datetime
    entry_id: UUID

    @field_validator('published_at')
    @classmethod
    def timezone_required(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError('timezone is required')
        return value


def query_digest(terms, filters, context):
    return sha256(json.dumps([terms, filters, context], sort_keys=True,
                             separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def decode_cursor(value: str | None, query: str) -> SearchPosition | None:
    if not value:
        return None
    try:
        if len(value) > 1024:
            raise ValueError
        raw = base64.b64decode(value + '=' * (-len(value) % 4), altchars=b'-_', validate=True)
        cursor = CursorPayload.model_validate_json(raw)
        if cursor.query != query:
            raise ValueError
        return SearchPosition(cursor.score, cursor.published_at, cursor.entry_id)
    except (ValueError, ValidationError, UnicodeError):
        raise ValidationFailed('invalid cursor; start a new search') from None


def encode_cursor(position: SearchPosition | None, query: str) -> str | None:
    if position is None:
        return None
    payload = CursorPayload(query=query, score=position.score,
                            published_at=position.published_at, entry_id=position.entry_id)
    return base64.urlsafe_b64encode(payload.model_dump_json().encode()).decode().rstrip('=')
