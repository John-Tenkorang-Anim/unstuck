# Implementation ledger

The entire specification is **not yet implemented**. This ledger distinguishes
working development behavior from infrastructure and release requirements that
still need implementation. Nothing here constitutes production-readiness.

## Implemented behavior

The entry, discussion, outcome, link, problem, impact and search workflows now
share a transaction interface with both memory and Postgres implementations.
`test_persistence.py` runs the shared contracts against both and adds real-database
concurrency, rollback, session and process-interruption tests. The Why board,
knowledge and media write workflows below remain development-adapter only.

| Area | Behavior | Verification |
| --- | --- | --- |
| Entries | Partial drafts, idempotent creation with payload conflicts, author-only editing/deletion/publication, optimistic versions, version snapshots | `test_core.py` |
| Validation | Kind requirements, template field types, context keys and values, image alt text at publication | `test_core.py` |
| Privacy | Opaque aliases scoped to each entry; private drafts; public history excludes draft versions; defensive response copies | `test_core.py` |
| Reports | One current report per account/entry; replacement updates counts; concurrent reports serialize; absolute outbox counts | `test_core.py` |
| Context/impact | Small-group context suppression, own-entry impact rejection, impact minimum cohort | `test_core.py` |
| Discussion | Typed comments, escaped plain-text HTML, parent-entry validation, idempotent posting; problem answers update state | `test_core.py` |
| Problems | Resolve with an answer or linked solution; author-only unmark with note; bounded inactivity sweep | `test_core.py`, real-database sweep/revival in `test_persistence.py` |
| Links | Typed relations, solves validation, attempt-chain cycle rejection and public traversal | Concurrent cycle checks in `test_persistence.py` |
| Why board | Promote hypotheses; weighted votes; immutable evidence links; support/dispute transitions; independent aged replications and reviewer verification; belief vs proof; why-status recomputation | `test_explanations.py` |
| Knowledge | Source-checked claims, labeled AI proposals, independent human acceptance, stale-base conflict checks, supersession, computed strength | `test_knowledge.py` |
| Search/feed | Development lexical matching, filters before ranking/pagination, published-only visibility, context matches | Visibility gate in `test_core.py`; not multilingual/vector search |
| Media | Pilot upload admission, private tickets, exact HEAD checks, idempotent finalize/jobs, sanitized-output approval and public takedown | `test_media.py`, using fake storage and simulated clean worker results |
| Intake wrapper | Shell-free invocation, resource limits, bounded stdout, timeout/process-group termination, typed reports, output-directory validation | `test_intake_wrapper.py` uses a subprocess double; real binary/sandbox integration remains |
| Adapter fixes | Normalized fake embeddings, numeric stream-ID replay, expiring sliding rate windows | `test_adapter_contracts.py` |
| API | Typed routes for the above workflows and problem-detail errors | In-process FastAPI acceptance flow |

The original workflow tests use memory. The new persistent-core contracts use
real Postgres/pgvector and independent connection pools, plus a separate writer
process that terminates before commit. They prove the covered transaction and
rollback behavior; they do **not** prove backup restoration, power-loss durability,
failover, actual sanitization/scanning, CDN behavior, or production identity safety.

## Remaining work from the specification

1. **Persistence and infrastructure:** Postgres repositories for explanations,
   knowledge, media and the remaining workflows; Redis streams, S3-compatible
   storage, outbox delivery, retention cleanup, backup/restore rehearsal and load
   testing. Core normalized Postgres storage, checked migrations, bounded pools,
   atomic outbox writes, original-response retries and expiring session reads
   are implemented. Postgres mode returns 501 for unported write workflows.
2. **Identity:** complete WebAuthn ceremonies, challenges and replay protection,
   recovery codes, encrypted optional email, magic links, secure expiring sessions,
   account deletion, CSRF/origin protection, and route rate limiting.
3. **Media:** Rust intake binary, actual image/PDF/CSV/video pipelines, metadata
   removal and fuzzing corpus, malware/hash and content scanners, annotations,
   markers, SSRF-safe embeds, captions/OCR, CDN integration and durable queue wiring.
   An idempotent approval-before-publication method, approved-output snapshots,
   manifest validation and takedown guards now exist with memory-adapter tests.
   Automatic approval stays disabled until all required scanners exist.
4. **Workers and live events:** Redis consumer runtime, Python fallback relay,
   Go relay and SSE gateway, replay/resync, bounded clients, deduplicated jobs,
   retries/dead-letter queues, scheduler tasks, and drift recounts.
5. **AI and multilingual:** real CPU embedding/LLM/translation adapters, model
   configuration, schema-bound drafts and citation validation, plan check,
   translation cache, voice drafting, summaries and required eval datasets.
6. **Safety/community:** evaluated safety classifier (the current local scanner
   is conservative heuristic screening only), moderation queues/actions/appeals,
   reputation, notifications/digests, follows and settings, conflict-of-interest
   coverage and high-stakes reviewer approval routes.
7. **Frontend:** the initial Next.js application now implements discovery,
   search/filtering, field-note reading, local bookmarks, a private draft composer,
   explanatory evidence displays, and light reading mode. See `apps/web/README.md`.
   Remaining: accounts and publication, tried-it submission, knowledge authoring,
   moderation/media controls, six-language translation/Arabic RTL, voice/live/offline
   integration, browser visual QA, and measured performance/accessibility budgets.
8. **Deployment and operations:** Compose, Caddy, sandbox isolation, backups
   and restore rehearsal, metrics/traces, load testing and performance budgets.
9. **v1.1/v2 scope:** trials, spaces, challenges, collections, signed entries,
   offline/read-aloud, exports/public API, Commune integration and later features.

The original specification remains authoritative. Its required tests and evals
are not replaced by the development tests above.

## Frontend verification

The component suite covers search and compound filters, sorting, bookmarks and
storage recovery, composer validation/review/restoration, light reading, and a
structural axe audit. These tests use JSDOM, not a browser. HTTP tests inspect
server-rendered documents without executing scripts. Browser visual QA and
Lighthouse/transfer-budget measurements remain outstanding.

## Platform rendering and media foundations

A canonical Python-exported JSON Schema now drives generated TypeScript bindings
and server-side response validation. API/media schema drift checks, backend tests,
frontend tests, production builds, SSR/HTML budgets, and Chromium regression
checks are configured in `.github/workflows/platform.yml`. Workflow configuration
is not itself evidence that a run passed; consult the corresponding commit's run.

Approved images and short videos have a delivery renderer with descriptions,
reviewed captions, descriptive transcripts, conservative default quality,
per-attachment recovery and Save-Data/cookie-aware server rendering. Lite mode
omits actual media elements until consent. Unknown additive API fields are
ignored, unsupported media versions are withheld, and malformed attachments do
not hide valid written content. A backend outage is no longer a false 404.

See `docs/architecture/0001-platform-foundations.md` for the intended architecture,
limits and remaining gates. Actual encoding, durable cross-worker concurrency,
object-store/CDN security, backup restoration, native playback and manual WCAG
review remain incomplete. Core entry transactions are implemented as described in
`docs/architecture/0002-durable-core.md`; durable media concurrency is still pending.
