# Contracts

JSON Schemas shared by the Python API, the Go relay and live gateway, the Rust intake CLI, and the TypeScript web app. The rules are in `docs/SPEC.md` section 10.27.

- `jobs/` — one schema per job in section 9. Every envelope has `"v": 1`.
- `events/` — one schema per live event in section 8. Payloads are absolute values.
- `intake/report.json` — the only stdout of `intake sanitize`.
- `ai/entry_draft.json` — the grammar for "draft my entry" (section 12.3).

`make contracts` will generate Python, Go, and TypeScript bindings (T-44). The generators are not wired yet; the schemas are the source of truth.
