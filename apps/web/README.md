# Unstuck web

A Next.js App Router frontend with a custom design system inspired by Apple's
interface language. Use Node.js 24 and npm. No external font or image service is
needed to render the interface.

## Design system

- **Type:** Space Grotesk for headlines and figures, IBM Plex Sans for reading
  and interface text. Both are bundled locally. Light reading uses system fonts
  and never downloads them.
- **Colour:** Cherenkov Blue `#2F5BFF` is the signature, for primary buttons,
  links and the logo. H-alpha Magenta `#C2399B` is a second accent for
  people, communities and new activity. Community icons take the colours of
  stellar spectral classes. Outcome colours appear only where they encode
  results, always with a glyph and a label. They were checked for every common
  kind of colour blindness, including blue-yellow: worked `#00A37A`, didn't
  work `#B8321A`, mixed `#E0A800`, and still being tested in the brand blue.
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

- A landing page at `/` that introduces Unstuck: a morning photograph of
  dew-covered rice seedlings (Aqsis Bey, CC BY-SA 4.0) and Sankofa, the Akan
  Adinkra symbol for going back to learn from what came before. "Get started"
  leads to `/discover` and "Sign in" to `/account`.
- Discover is drawn as a star chart. Its bright stars are real questions,
  pink while they wait for an answer, and each opens its question.
- The community directory is one line per community, searched, filtered and
  sorted in the database, thirty to a page. Links from a community carry
  `?from=` so notes and the composer keep that community as the way back.

- Three places in the menu: Discover, Communities and Notebook, plus one Ask
  button. Discover is a single box. Suggestions appear as you type, using the
  same forgiving search, and Enter shows full results at `/search`, which
  counts as part of Discover. An empty `/search` goes back to Discover. A `⌘K`
  palette opens search from any other page.
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
- A "Why it happened" discussion on every field note, built for very long
  threads. Explanations are ranked by how many different people bring
  supporting or disputing evidence. Responses split into all, questions and
  tried-it, and can be searched, sorted by most helpful, newest or oldest,
  and paged. Long responses are clamped, and replies load on request.
- A field note reads on its own. Its discussion opens as a pane beside it
  only when someone asks for it, and `?discuss=1` keeps that open in a link.
  On phones the discussion is a full-screen sheet.
- Open communities at `/communities`. Anyone can start, join, read and post
  in one. Each community has its own questions, a library of notes shelved by
  outcome, and a members list. Joining opens a dialog with what members get
  and the community's rules. People agree to the rules and can introduce
  themselves. Founders write the rules when they create a community.
- When posting, people choose where it appears: everyone, one or more
  communities, or both. Community-only posts stay out of the public feed and
  search.
- From the results people open a note to respond, or ask. The ask card keeps
  the words typed and suggests the community where similar problems were
  posted. Open questions, videos and critiques are tabs of the results, and
  `/questions` redirects there. Search forgives misspellings and says
  "Showing results for …". It knows common synonyms, and supports
  `"exact phrases"` and `-excluded` words.
- Ask and the old "New note" are one composer at `/new`. People choose to ask
  for help or share what happened, or to get feedback on a piece of work. What
  they post appears in their notebook.
- The notebook at `/notebook` holds what is yours: your posts with new and
  unanswered counts, replies to you, your critiques, saved notes and your
  communities. The critiques tab lists the feedback you gave on other
  people's work and the work you shared for critique. `/you` redirects there.
- Maths anywhere people write: responses, field notes, critique notes and
  worked steps. A Σ palette inserts fractions, powers, roots, integrals, Greek
  letters and operators. ⌘/Ctrl+M starts an equation, and a live preview
  typesets it. Inline maths goes between `$…$` and display maths between
  `$$…$$`. Prices such as "$20 and $30" stay plain text.
- Replies work like YouTube or X. Reply on any reply and the new one is
  labelled "Replying to …", so nobody has to type a name to tag someone.

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

To try a large discussion locally, seed one with
`node scripts/seed-discussion.mjs <entry-id> [responses] [people]`.

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
It uses port 3100 (3200 for the media checks) and stops if something is already
running there, such as `npm run dev`. Set `UNSTUCK_TEST_PORT` to use another
port.

CI runs `npm run test:browser` against an isolated, read-only synthetic API on
loopback. Its media-response fixtures test delivery policy and recovery, not real
codec support or CDN behavior. To run that suite in a suitable test environment,
install Playwright Chromium with `npx playwright install --with-deps chromium`.
The local computer's browser bridge remains unavailable; manual visual review,
actual device playback, assistive-technology testing and Lighthouse measurements
are still required. JSDOM/axe checks do not certify WCAG conformance.

See the [platform architecture decision](../../docs/architecture/0001-platform-foundations.md)
for release gates, media limits and production work still required.
