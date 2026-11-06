"""Python fallback relay and cron table. Spec 10.25.

The Go relay (week 9) implements the same contract. T-04 runs against both.
"""

CRON = {
    "0 * * * *": ["problems.sweep", "impact.rollup", "trials.tick"],
    "15 3 * * *": [
        "patterns.rebuild",
        "stats.recount",
        "knowledge.refresh_strengths",
        "purge_idempotency_keys",
        "purge_expired_sessions",
    ],
    "30 2 * * *": ["backup_postgres"],
}


async def relay_outbox(db, redis, batch: int = 100) -> int:
    """Move committed outbox rows into Redis. At-least-once, by design."""
    raise RuntimeError("relay_outbox needs Postgres and Redis (week 5)")
