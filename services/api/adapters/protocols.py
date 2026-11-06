"""Adapters: the only code that touches infrastructure. Each Protocol has a real
implementation and an in-memory fake in adapters/fakes.py with identical behavior
for tests (T-02 runs the same contract tests against both).
"""
from collections.abc import AsyncIterator
from typing import Literal, Protocol

from pydantic import BaseModel


class PresignedPut(BaseModel):
    url: str
    key: str
    headers: dict[str, str] = {}


class BlobInfo(BaseModel):
    key: str
    size: int
    content_type: str


class FetchResult(BaseModel):
    status: int
    body: bytes
    content_type: str


class Event(BaseModel):
    id: str
    name: str
    data: dict


class Outbox(Protocol):
    async def add(self, tx, stream: str, payload: dict) -> None:
        """INSERT outbox_events inside the caller's transaction (INV-06)."""


class EventBus(Protocol):
    async def subscribe(self, channel: str, last_event_id: str | None) -> AsyncIterator[Event]:
        """Replay then follow. Yield resync when last_event_id has been trimmed."""
        ...


class BlobStore(Protocol):
    async def presign_put(self, key: str, content_type: str, max_bytes: int, ttl_s: int = 900) -> PresignedPut:
        """Presigned PUT to the PRIVATE bucket only."""

    async def head(self, key: str) -> BlobInfo | None: ...

    async def get(self, key: str, *, bucket: Literal["private", "public"]) -> bytes: ...

    async def put(self, key: str, data: bytes, content_type: str, *, bucket: Literal["private", "public"]) -> None: ...

    async def copy_to_public(self, private_key: str, public_key: str) -> None:
        """Server-side copy. Idempotent."""

    async def delete_public(self, prefix: str) -> None:
        """Delete public copies and request a CDN purge for the prefix."""


class Embedder(Protocol):
    def embed(self, texts: list[str], *, kind: Literal["query", "passage"]) -> list[list[float]]:
        """Multilingual 384-d vectors, L2-normalized."""


class LLMClient(Protocol):
    async def complete_json(self, prompt: str, schema: dict, *, max_tokens: int, timeout_s: float) -> dict:
        """llama.cpp /completion with a JSON-schema grammar."""


class Translator(Protocol):
    def translate(self, texts: list[str], src: str, tgt: str) -> list[str]:
        """One output per input, same order."""


class RateLimiter(Protocol):
    async def hit(self, key: str, limit: int, window_s: int) -> None:
        """Sliding window. Raise RateLimited(retry_after) when over."""


class SafeFetcher(Protocol):
    async def get(self, url: str, *, max_bytes: int = 524_288, timeout_s: float = 2.0) -> FetchResult:
        """SSRF-safe GET. https only, no private or loopback addresses."""


class Mailer(Protocol):
    async def send(self, to: str, subject: str, text: str) -> None:
        """Bodies never include account ids."""
