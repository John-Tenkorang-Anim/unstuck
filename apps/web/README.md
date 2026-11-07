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
- Photos and short video in notes and sessions, by paste, drop or file choice,
  with pinned spots and marked moments. Drafts keep files on the device.
- A video player whose marked moments are keyboard-reachable chapters.

Sample photos and film come from Wikimedia Commons under the licenses shown on
the About page. See the [search, media and sessions note](../../docs/architecture/0002-search-media-and-sessions.md).
- Server-rendered field notes with context, outcome labels, explanations,
  source sections, sharing, and saved-entry controls.
- Open questions and a personal notebook with persistent device-local bookmarks.
- Six contribution kinds and a three-step composer, with validation, private
  draft autosave, restoration, review, and JSON export matching `EntryCreate`.
- Approved-media gallery with responsive image variants, alt text, native video,
  reviewed captions, descriptive transcripts, audio-described variants, explicit
  low-data consent, quality selection, and per-attachment error recovery.
- About/principles pages, missing-page handling, reduced-motion support,
  keyboard focus styles, skip navigation, mobile navigation, and light reading.

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
