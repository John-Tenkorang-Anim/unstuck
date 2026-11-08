# Unstuck

A community knowledge platform specified in [docs/SPEC.md](docs/SPEC.md).

## Run the implemented development API

Requires Python 3.12 or newer.

```sh
python3 -m venv .venv
.venv/bin/python -m ensurepip
.venv/bin/python -m pip install -r services/requirements.lock
.venv/bin/python -m pip install --no-deps -e services
.venv/bin/uvicorn main:app --reload
```

Open http://localhost:8000/docs for the API contracts.

```sh
.venv/bin/python -m pytest -q
```

The default application uses **process-local memory and fake blob storage**. State
is lost on restart and is not shared between processes. Run one process only.
This configuration is for development and tests, not deployment.

## Run the persistent core with Postgres

Use a dedicated Postgres 16 database with pgvector 0.8 or newer available. After
installing the Python dependencies, configure the database in your environment
or an untracked `.env` file. Do not commit credentials.

```sh
export DATABASE_BACKEND=postgres
export DATABASE_URL='postgresql://app:app@127.0.0.1:5432/unstuck'
.venv/bin/python scripts/migrate_db.py
.venv/bin/uvicorn main:app
```

Replace the example development credentials. Run migrations with a migration
role; the runtime role needs only application DML and schema-version reads.
The app checks the schema before serving requests and closes its pool on shutdown.
`/readyz` reports database availability separately from process health.

Entries, history, aliases, comments, tried-it reports, counts, problem resolutions,
links and impact signals now persist in Postgres. Business changes and outbox
events commit atomically. The Why board, knowledge revision and media write
routes return HTTP 501 in this mode until their persistent integrations exist.
See [the durable-core decision](docs/architecture/0002-durable-core.md).

To run the real-database contracts, point the test runner at a **disposable test
database** whose name contains `test`:

```sh
export UNSTUCK_TEST_DATABASE_URL='postgresql://app:app@127.0.0.1:5432/unstuck_test'
.venv/bin/python -m pytest -q
```

Tests create and drop isolated schemas in that database. The test role requires
extension/schema creation privileges. Without this variable, real Postgres tests
are explicitly skipped; memory tests do not substitute for them. CI provisions
its own Postgres/pgvector service and runs both.

Authentication is deliberately fail-closed: tests inject session tokens into
`MemoryRepository.sessions`; there is no public account-ID header or development
login bypass. Passkey registration and login remain unimplemented. Uploads are
limited to accounts explicitly enrolled in `MemoryRepository.pilot_accounts`.
The fake blob upload tickets are test objects, not network-accessible upload URLs.

## Run the frontend

Requires Node.js 24. The application has Discover, Problems, Workspaces, and
Lessons, with guided contributions and a personal space for saved work and drafts.
Its Node server implements accounts, publishing, communities, collaboration,
critiques, and moderation in a separate PostgreSQL `web` schema.

```sh
cd apps/web
npm ci
npm run db:start
export DATABASE_URL=postgresql://unstuck@127.0.0.1:5433/unstuck
npm run dev -- --port 3100
```

Open http://127.0.0.1:3100. Without database/API configuration it uses labelled
examples. A configured database defaults to live records;
`UNSTUCK_SHOW_EXAMPLES=true` explicitly adds examples. See the
[web README](apps/web/README.md) for configuration, media behavior, and tests.

**The web and Python data systems are not unified.** They have separate account,
publication, and media models. `UNSTUCK_API_URL` enables read-only public API
integration; it does not synchronize identities or writes. See the
[review record](docs/REVIEW.md) for current capabilities and remaining release work.

## Platform architecture

Rendering and media architecture are documented in the
[platform decision record](docs/architecture/0001-platform-foundations.md).
The web client now validates versioned API/media contracts and renders approved
photos and short videos with accessible, bandwidth-aware fallbacks. Core
transactional persistence is implemented; media encoding, real object storage,
the remaining repositories and identity remain
production prerequisites. `APP_ENV=production` refuses the development storage
adapters instead of starting with data that would be lost on restart.

## Implementation status

See [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) for tested behavior and the
remaining specification work. A declared route or schema does not imply that its
implementation is complete; remaining scaffold routes return HTTP 501.
