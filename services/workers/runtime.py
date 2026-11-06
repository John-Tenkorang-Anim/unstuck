"""Shared consumer loop for every worker process. See docs/SPEC.md section 10.18.

run(stream, group, handler, concurrency) will XREADGROUP, retry, XACK and dead-letter.
This module is the contract. The Redis loop lands with the workers that need it (week 5+).
"""


class Permanent(Exception):
    """Raise for errors a retry can't fix (unsupported file, validation). Goes straight to the DLQ."""


async def run(stream: str, group: str, handler, concurrency: int = 1) -> None:
    """Block until a consumer is wired. Importing this module must stay side-effect free."""
    raise RuntimeError(f"consumer for {stream}/{group} is not wired yet")
