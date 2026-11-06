import math
from adapters.fakes import FakeEmbedder, FakeEventBus, FakeRateLimiter
from adapters.protocols import Event
from domain.errors import RateLimited
import pytest


def test_embeddings_are_384_dimensional_and_normalized():
    vectors = FakeEmbedder().embed(['hello', 'bonjour'], kind='query')
    assert len(vectors) == 2
    assert all(len(v) == 384 and math.isclose(sum(x*x for x in v), 1) for v in vectors)


async def test_sliding_rate_window_and_retry_after():
    now = [0.]
    limiter = FakeRateLimiter(clock=lambda: now[0])
    await limiter.hit('key', 1, 10)
    now[0] = 8
    with pytest.raises(RateLimited) as error:
        await limiter.hit('key', 1, 10)
    assert error.value.retry_after == 2
    now[0] = 10
    await limiter.hit('key', 1, 10)


async def test_stream_ids_compare_numerically():
    bus = FakeEventBus()
    bus.events['entry'] = [Event(id='9-0', name='stats.updated', data={}),
                           Event(id='10-0', name='stats.updated', data={})]
    assert [e.id async for e in bus.subscribe('entry', '9-0')] == ['10-0']
    assert [e.name async for e in bus.subscribe('entry', '8-0')] == ['resync']
