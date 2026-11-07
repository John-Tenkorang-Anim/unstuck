# Unstuck web

A Next.js App Router frontend with a custom field-notebook design system.
Use Node.js 24 and npm. Fonts are bundled locally; no external font or image
service is needed to render the interface.

## Run

```sh
npm ci
npm run dev -- --port 3100
```

Open http://127.0.0.1:3100. For a production build:

```sh
npm run build
npm run start -- --port 3100
```

## What works

- Responsive discovery feed with search, outcome tabs, field filters, sorting,
  empty states, and a `/` keyboard shortcut.
- Server-rendered field notes with context, outcome labels, explanations,
  source sections, sharing, and saved-entry controls.
- Open questions and a personal notebook with persistent device-local bookmarks.
- Six contribution kinds and a three-step composer, with validation, private
  draft autosave, restoration, review, and JSON export matching `EntryCreate`.
- About/principles pages, missing-page handling, reduced-motion support,
  keyboard focus styles, skip navigation, mobile navigation, and light reading.

## Data modes

Without `UNSTUCK_API_URL`, the frontend shows **explicitly labeled fictional
examples**. Their stories, counts, aliases, and evidence are demonstration data.
Bookmarks and the single active draft are stored only in this browser's local
storage. Nothing is published or submitted as a community report.

To read published entries from FastAPI, copy `.env.example` to `.env.local` and
set the server-only `UNSTUCK_API_URL` to the API's `/api/v1` base URL. Restart the
web server. The public feed and entry detail adapters use that URL. They never
silently replace failed live requests with sample stories. Filtering currently
applies to the entries loaded from the first feed page.

Account/session UI, community publishing, report submission, moderation actions,
media uploads, translation/RTL, voice input, live events, knowledge-page editing,
and offline caching still need their respective backend integrations and UI.
The current frontend deliberately offers private drafts instead of claiming
unavailable publishing works. Live explanation retrieval is not available in
the current backend; the Why board shows an empty state in live mode.

## Verification

```sh
npm run typecheck
npm test
npm run build
# With a local server running:
npm run test:ssr
```

`npm test` runs component interaction and structural accessibility tests in
JSDOM. `test:ssr` checks actual HTTP responses and parses their HTML without
executing scripts. Set `UNSTUCK_TEST_URL` to test a different local port.

JSDOM does not measure layout or color contrast. The browser automation bridge
was unavailable during this implementation, so desktop/mobile visual QA remains
outstanding. No visual-snapshot or Lighthouse claim is implied by these tests.
