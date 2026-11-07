# Contracts

JSON Schemas shared by the Python API, the Go relay and live gateway, the Rust intake CLI, and the TypeScript web app. The rules are in `docs/SPEC.md` section 10.27.

- `jobs/` — one schema per job in section 9. Every envelope has `"v": 1`.
- `events/` — one schema per live event in section 8. Payloads are absolute values.
- `intake/report.json` — the only stdout of `intake sanitize`.
- `ai/entry_draft.json` — the grammar for "draft my entry" (section 12.3).

`api/entry-view-v1.json` and `media/public-manifest-v1.json` are exported from
canonical Pydantic response models. Their TypeScript types are generated, and the
web server validates network JSON against those same schemas. Media fixtures are
shared by Python, frontend unit tests, and the isolated browser test API.

From the repository root:

```sh
python scripts/export_contracts.py
cd apps/web
npm run contracts:generate
```

CI uses `export_contracts.py --check` and `npm run contracts:check` to detect drift.
Do not edit `apps/web/lib/contracts/` manually. A breaking media change needs a new
manifest version; unsupported media remains unavailable while written entries
stay readable. Additive core API response fields are discarded by older readers.

Other job/event/intake schemas retain their existing contracts. Go/Rust binding
generation and complete T-44 coverage remain future work.
