# Unstuck

A community knowledge platform specified in [docs/SPEC.md](docs/SPEC.md).

## Run the implemented development API

Requires Python 3.12 or newer.

```sh
python3 -m venv .venv
.venv/bin/python -m ensurepip
.venv/bin/python -m pip install -e './services[dev]'
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

## Implementation status

See [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md) for tested behavior and the
remaining specification work. A declared route or schema does not imply that its
implementation is complete; remaining scaffold routes return HTTP 501.
