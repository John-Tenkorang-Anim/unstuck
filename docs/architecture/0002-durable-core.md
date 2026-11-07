# ADR 0002 — Transactional persistence for the entry core

Status: implemented for the core workflows below. Identity ceremonies, media
processing and the remaining specification are not production-complete.

## Boundary and scope

The same entry, outcome, discussion, link, problem and impact services now run
against `CoreRepository` transactions. They do not construct a memory adapter or
issue SQL. The app factory selects memory explicitly for development, or Postgres
with `DATABASE_BACKEND=postgres`.

Postgres persists the normalized tables from the specification: entries,
versions, per-entry aliases, context, topics, links, stats, outcome reports,
comments, impact signals, problem resolutions, state events, retry keys and the
transactional outbox. Public models never contain account IDs. No whole-database
JSON snapshot or process-local cache is used as the source of truth.

The Why board, knowledge revision and media write services still use the older
development interfaces. In Postgres mode their routes return HTTP 501. They do
not silently write to memory. Identity registration/login also remains HTTP 501;
the implemented session reader is not a complete identity system. There is no
public test-account or account-ID authentication bypass.

## Transaction rules

- Each write borrows one connection and explicitly begins one transaction. The
  entry row is the lock for its aggregate. Reports, counts and the absolute-count
  outbox event commit together. Independent entry writes can proceed concurrently.
- Actor status is reloaded inside each write and protected against concurrent
  suspension for that transaction. Session cookies are looked up by SHA-256 digest;
  expired, revoked and inactive-account sessions cannot authorize requests.
- Edits check the supplied version after acquiring the row lock. A concurrent
  stale edit receives HTTP 412 rather than overwriting the winner.
- State transitions and version snapshots commit with the affected business rows.
  An outbox failure rolls the whole mutation back. External delivery is a separate
  relay responsibility; a committed outbox row is not proof of event delivery.
- Create retries reserve `(account, operation, key)` inside the transaction. A
  canonical request digest rejects conflicting reuse. Successful retries return
  the original response for 24 hours. Failed mutations leave no reservation.
  Expired keys may be reused; scheduled physical cleanup is still required.
- Multi-entry operations acquire entry locks in UUID order. Next-attempt graph
  changes additionally take a transaction-scoped graph lock so concurrent edges
  cannot create a cycle across otherwise independent entry rows. Traversals stop
  at 1,000 nodes. Stale-problem sweeps process at most 100 rows and skip rows locked
  by another sweeper or request.
- Read operations use a repeatable-read, read-only transaction. Written content,
  aliases, counts and related rows therefore come from one consistent snapshot.
  Related feed rows are fetched in batches for the selected page, rather than
  one query per relation per card.

Connections, waiting requests, statement duration and lock waits are bounded.
Transient database and pool failures return a generic HTTP 503 with Retry-After,
without exposing connection strings or SQL. `/healthz` reports process health;
`/readyz` checks database availability. No failed Postgres request falls back to
memory or demonstration data.

## Search and classification

The persistent feed filters publication state and requested fields in SQL before
ranking and pagination. Its lexical ranking uses literal substring matching;
it is not the specified multilingual/vector hybrid search. Keyset cursors bind
score, publication time and ID to the query, filters and viewer context. New
publications do not shift subsequent pages. Text edits or context changes can
still change ranking; cursors do not freeze an entire search across requests.

The database's topic names and high-stakes flags are resolved when topics change.
Authors cannot downgrade a classified topic by re-submitting its slug. The local
safety screen remains heuristic; the specified evaluated classifier and human
moderation workflow are still required.

Approved media reads expose only valid, matching public manifests. Private
processing variants are never returned. Invalid or unsupported attachments are
withheld while the written entry remains readable. Real media writes are disabled
in this adapter until the storage and processing integrations are implemented.

## Migrations and operation

Run `scripts/migrate_db.py` explicitly before application startup. Migrations are
ordered, checksummed, serialized by a database lock, and applied transactionally.
An altered applied migration or an unknown database migration stops the runner.
The application checks the required schema version and never performs startup DDL.
Use a separate migration role; the runtime role does not need schema ownership.

`0001_init.sql` is unchanged. `0002_core_transactions.sql` adds runtime constraints,
retry-key namespaces, problem resolutions and a separate public manifest column.
The original context seed moved to `0003_context_keys.sql` so fresh databases
receive the validation vocabulary through a tracked migration, without duplicate
seed files. An existing database created manually without migration history needs
an explicitly reviewed baseline; the runner does not guess or adopt it.

Default per-process connection limits are 1–8 connections, 64 waiting requests,
a 5-second acquisition wait, a 5-second statement timeout and a 3-second lock
timeout. Include **all API and worker processes** when sizing against the database
connection limit. These are conservative bounds, not benchmarked capacity claims.

Keep `APP_ENV=development` for the currently runnable Postgres development path.
`APP_ENV=production` continues to reject missing/fake object storage. Complete
identity, origin/CSRF enforcement, real storage, queue delivery, backups/restore,
retention cleanup, authorization review and measured load testing before opening
the platform to real accounts.

## Evidence

`tests/integration/test_persistence.py` runs shared behavior contracts against
memory and a real Postgres/pgvector database. It also checks independent connection
pools, concurrent counts/edits/graph changes, outbox-failure rollback, session
expiry/revocation/suspension, stable feed pagination, consistent snapshots, bounded
pool waits, migration drift, readiness, private-media suppression and a terminated
writer process. CI provisions a digest-pinned pgvector/Postgres 16 container and
applies migrations to fresh isolated schemas. These tests are not a backup restore,
power-loss test, failover test or production load test.

Primary references:

- [Psycopg transaction contexts](https://www.psycopg.org/psycopg3/docs/basic/transactions.html)
- [Psycopg connection pools](https://www.psycopg.org/psycopg3/docs/advanced/pool.html)
- [Postgres row and advisory locks](https://www.postgresql.org/docs/16/explicit-locking.html)
- [pgvector installation and Docker images](https://github.com/pgvector/pgvector)
