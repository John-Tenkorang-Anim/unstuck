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

Authentication is deliberately fail-closed: tests inject session tokens into
`MemoryRepository.sessions`; there is no public account-ID header or development
login bypass. Passkey registration and login remain unimplemented. Uploads are
limited to accounts explicitly enrolled in `MemoryRepository.pilot_accounts`.
The fake blob upload tickets are test objects, not network-accessible upload URLs.

## Run the frontend

Requires Node.js 24. The frontend has a custom responsive interface, searchable
field notes, open questions, saved entries, and a private draft composer.

```sh
cd apps/web
npm ci
npm run dev -- --port 3100
```

Open http://127.0.0.1:3100. See [the web README](apps/web/README.md) for backend
connection, production commands, and tests. The default notebook uses labeled
fictional examples. Bookmarks and drafts stay on the current device; community
publishing awaits identity integration.

## Platform architecture

Rendering and media architecture are documented in the
[platform decision record](docs/architecture/0001-platform-foundations.md).
The web client now validates versioned API/media contracts and renders approved
photos and short videos with accessible, bandwidth-aware fallbacks. Media
encoding, real object storage, persistent repositories and identity remain
production prerequisites. `APP_ENV=production` refuses the development storage
adapters instead of starting with data that would be lost on restart.

## Implementation status

See [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) for tested behavior and the
remaining specification work. A declared route or schema does not imply that its
implementation is complete; remaining scaffold routes return HTTP 501.
