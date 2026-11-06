"""In-memory adapters. Weeks 1–4 run on these. T-02 compares them with the real ones."""
from collections.abc import AsyncIterator
from collections import deque
import math
import time
from copy import deepcopy

from domain.errors import NotBuilt, RateLimited

from adapters.protocols import BlobInfo, Event, FetchResult, PresignedPut


class FakeOutbox:
    def __init__(self) -> None:
        self.rows: list[tuple[str, dict]] = []

    async def add(self, tx, stream: str, payload: dict) -> None:
        self.rows.append((stream, deepcopy(payload)))


class FakeEventBus:
    def __init__(self) -> None:
        self.events: dict[str, list[Event]] = {}

    async def subscribe(self, channel: str, last_event_id: str | None) -> AsyncIterator[Event]:
        order = lambda value: tuple(int(part) for part in value.split('-'))
        items = self.events.get(channel, [])
        if last_event_id and items and order(last_event_id) < order(items[0].id):
            yield Event(id="0-0", name="resync", data={})
            return
        for event in items:
            if last_event_id is None or order(event.id) > order(last_event_id):
                yield event


class FakeBlobStore:
    def __init__(self) -> None:
        self.private: dict[str, tuple[bytes, str]] = {}
        self.public: dict[str, tuple[bytes, str]] = {}

    async def presign_put(self, key: str, content_type: str, max_bytes: int, ttl_s: int = 900) -> PresignedPut:
        return PresignedPut(url=f"memory://private/{key}", key=key, headers={"Content-Type": content_type})

    async def head(self, key: str) -> BlobInfo | None:
        item = self.private.get(key)
        if item is None:
            return None
        return BlobInfo(key=key, size=len(item[0]), content_type=item[1])

    async def get(self, key: str, *, bucket: str) -> bytes:
        store = self.private if bucket == "private" else self.public
        return store[key][0]

    async def put(self, key: str, data: bytes, content_type: str, *, bucket: str) -> None:
        store = self.private if bucket == "private" else self.public
        store[key] = (data, content_type)

    async def copy_to_public(self, private_key: str, public_key: str) -> None:
        self.public[public_key] = self.private[private_key]

    async def delete_public(self, prefix: str) -> None:
        for key in [k for k in self.public if k.startswith(prefix)]:
            del self.public[key]


class FakeEmbedder:
    def embed(self, texts: list[str], *, kind: str) -> list[list[float]]:
        out = []
        for text in texts:
            vec = [0.0] * 384
            vec[0] = float(len(text) % 97) / 97
            vec[1] = 1.0 if kind == "query" else 0.5
            norm = math.sqrt(sum(value * value for value in vec))
            out.append([value / norm for value in vec])
        return out


class FakeLLMClient:
    async def complete_json(self, prompt: str, schema: dict, *, max_tokens: int, timeout_s: float) -> dict:
        raise NotBuilt("LLM client is a fake until week 7")


class FakeTranslator:
    def translate(self, texts: list[str], src: str, tgt: str) -> list[str]:
        return [f"[{tgt}] {text}" for text in texts]


class FakeRateLimiter:
    def __init__(self, clock=None) -> None:
        self.clock = clock or time.monotonic
        self.hits = {}

    async def hit(self, key: str, limit: int, window_s: int) -> None:
        if limit < 1 or window_s <= 0:
            raise ValueError("limit and window must be positive")
        now = self.clock()
        hits = self.hits.setdefault(key, deque())
        while hits and hits[0] <= now - window_s:
            hits.popleft()
        if len(hits) >= limit:
            raise RateLimited("too many requests", retry_after=max(1, math.ceil(hits[0] + window_s - now)))
        hits.append(now)


class FakeSafeFetcher:
    async def get(self, url: str, *, max_bytes: int = 524_288, timeout_s: float = 2.0) -> FetchResult:
        if not url.startswith("https://"):
            raise ValueError("https only")
        return FetchResult(status=200, body=b"", content_type="text/plain")


class FakeMailer:
    def __init__(self) -> None:
        self.sent: list[tuple[str, str, str]] = []

    async def send(self, to: str, subject: str, text: str) -> None:
        self.sent.append((to, subject, text))
