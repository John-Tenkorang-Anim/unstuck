# Unstuck web

A Next.js App Router frontend with a custom design system inspired by Apple's
interface language. Use Node.js 24 and npm. No external font or image service is
needed to render the interface.

## Design system

- **Type:** Space Grotesk for headlines and figures, IBM Plex Sans for reading
  and interface text. Both are bundled locally. Light reading uses system fonts
  and never downloads them.
- **Colour:** neutral with small accents. Outcome colours pass the colour vision
  checks in both themes, and each outcome also has its own glyph shape. Coloured
  text uses separate `--*-text` tokens that meet a 4.5:1 contrast ratio.
- **Motion:** entrance and scroll reveals are CSS only, so content never depends
  on scripts to appear. Page and filter changes use React's `ViewTransition`.
  Reduced-motion and light reading turn all of it off.
- **Primitives:** Radix provides the search dialog and the field filter popover.
  Styles live in `app/globals.css` as tokens, and there is no component kit.

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

- A landing page at `/` that introduces Unstuck, with "Get started" leading to
  the platform at `/discover` and "Sign in" leading to `/account`. The sign-in
  form will move onto the landing page later.

- Responsive discovery with an outcome atlas that filters the ledger, search,
  outcome filters, field filters, sorting, empty states, shareable filter
  addresses, a `/` keyboard shortcut, and a `⌘K` search palette.
- Light and dark themes that follow the system, with a remembered override.
- A search page that ranks across text, video moments, photo descriptions,
  explanations and session feedback, links to the exact second or spot, and
  summarises matching outcomes as counts. It renders without JavaScript.
- Critique and inquiry sessions with pinned or time-coded feedback, rounds and
  status. Notes people add are kept on their device.
- Shown working for coursework: maths steps, code with its output, and data
  tables, each step, line and row addressable by feedback. Graded work can be
  marked hints only.
- Shared critique sessions. People choose a display name, publish a photo,
  video, PDF or their working, and others add notes pinned to a spot, page,
  step, line, row or second. Owners move the status and resolve notes. Data
  blocks also draw a scatter chart with an optional best-fit line.

## Shared data

Sharing needs PostgreSQL 16. Start a private local cluster and set the URL:

```sh
npm run db:start        # creates .pgdata/ and listens on 127.0.0.1:5433
export DATABASE_URL=postgresql://unstuck@127.0.0.1:5433/unstuck
```

The app creates its tables in a `web` schema on first use. Without
`DATABASE_URL` it still shows the samples, and publishing explains that a
database is needed. Uploaded file bytes are kept in `.data/` (or
`UNSTUCK_DATA_DIR`); the database holds their details and review status.

- **Accounts:** a name and optional role. The first post shows a recovery code
  once; `/account` uses it to sign in on another device or makes a new one.
- **Moderation:** anyone can report a session, note or field note. Three
  reports from different people hide it. People who enter
  `UNSTUCK_MODERATOR_CODE` on `/account` get the `/moderation` queue, where every
  decision needs a written reason and is logged.
- **Uploads:** identified by content, size-limited, images re-encoded with
  metadata removed, PDFs with scripts or embedded files refused, and an optional
  external scanner (`UNSTUCK_SCAN_URL`). `UNSTUCK_UPLOAD_REVIEW` holds uploads for
  a moderator; it defaults to `all` in production.
- **Rate limits:** per account and per address, enforced in the database.

Tests create and drop their own database. Locally they use the cluster from
`npm run db:start`; in CI, `UNSTUCK_TEST_DATABASE_URL`.

- **Known-abuse imagery:** every photo gets a PDQ hash, the format industry
  hash-sharing programmes distribute. Point `UNSTUCK_HASH_LIST` at a programme's
  list and matching uploads are quarantined where nothing serves them, the
  uploader is suspended, and moderators see an incident with reporting steps.
  Moderators can re-check every stored photo when the list changes. Joining a
  programme and filing reports are steps the operator takes.
- **Appeals:** people can appeal a hidden item or a suspension once, from
  `/account`. A moderator who didn't make the original decision rules on it.
- **File storage:** the local disk by default, or any S3-compatible bucket
  (`UNSTUCK_S3_*`) so several machines can serve the same files.

Videos and PDFs can't be hash-matched yet; in production they wait for a
moderator by default.

## Data modes

Without `UNSTUCK_API_URL`, the frontend shows **explicitly labeled fictional
examples**. Their stories, counts, aliases, and evidence are demonstration data.
Bookmarks and the single active draft are stored only in this browser's local
storage. Nothing is published or submitted as a community report.

To read published entries from FastAPI, copy `.env.example` to `.env.local` and
set the server-only `UNSTUCK_API_URL` to the API's `/api/v1` base URL. An optional
bare HTTPS `UNSTUCK_MEDIA_ORIGIN` prefixes approved `/m/` paths on a real CDN.
The edge must serve those paths only from public derivative storage. Restart the
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
npm run contracts:check
npm run typecheck
npm test
npm run build
npm run test:production
npm run test:media-production
# With a local server running:
npm run test:ssr
```

`npm test` runs component interaction and structural accessibility tests in
JSDOM. `test:ssr` checks actual HTTP responses and parses their HTML without
executing scripts. Set `UNSTUCK_TEST_URL` to test a different local port.

`npm run test:production` starts and stops its own production server and runs
HTTP/SSR checks, including a 50 KiB compressed HTML-document budget. This budget
excludes script, style, font and media transfers; it is not a whole-page budget.

CI runs `npm run test:browser` against an isolated, read-only synthetic API on
loopback. Its media-response fixtures test delivery policy and recovery, not real
codec support or CDN behavior. To run that suite in a suitable test environment,
install Playwright Chromium with `npx playwright install --with-deps chromium`.
The local computer's browser bridge remains unavailable; manual visual review,
actual device playback, assistive-technology testing and Lighthouse measurements
are still required. JSDOM/axe checks do not certify WCAG conformance.

See the [platform architecture decision](../../docs/architecture/0001-platform-foundations.md)
for release gates, media limits and production work still required.
