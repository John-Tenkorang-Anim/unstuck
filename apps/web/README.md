# Unstuck web

The working application for recording attempts, learning from outcomes, proposing
improvements, and testing them with others. Requires Node.js 24 and PostgreSQL.

## Run

```sh
npm ci
npm run db:start
export DATABASE_URL=postgresql://unstuck@127.0.0.1:5433/unstuck
npm run dev -- --port 3100
```

Open http://127.0.0.1:3100. The database command manages a development cluster;
use a separately provisioned database and credentials for deployment. Uploaded
files live in `.data/`, or `UNSTUCK_DATA_DIR`. Configure `UNSTUCK_S3_*` to use
S3-compatible storage. See `.env.example` for the available configuration.

Without a database or API, the app shows labelled examples and disables writes.
`UNSTUCK_SHOW_EXAMPLES=true` explicitly includes sample records alongside live
content; `false` disables them. A configured database/API defaults to live data.

```sh
npm run build
npm run start -- --port 3100
```

## Product and interface

- Discover, Problems, Workspaces, and Lessons are the main destinations.
  Contribute guides an attempt, problem, proposal, or test through its required
  fields. My Space holds drafts, saved records, contributions, and followed work.
- Native system typography, neutral surfaces, blue actions, and outcome labels
  provide a restrained visual language. Spacing groups content; dividers are
  reserved for controls and necessary structure. Discovery uses small landscape
  journey previews, a compact featured photograph, and readable text indexes.
- Attempts separate the original outcome from later supported improvements.
  Evidence, conditions, discussion, related work, and collaboration activity
  remain independently inspectable. Activity is not a version archive.
- Comparisons describe recorded conditions and reported outcomes. They do not
  invent measurements, call an unfinished attempt successful, or establish
  causation from an association. The curated pattern/guide library currently
  contains illustrative examples, not a live authoring workflow.
- Accounts use a display name, an expiring browser session, and a recovery code.
  Public profile handles are distinct from private account IDs. A name is not
  unique: invitations accept an exact public profile link when names collide.
- Private workspaces stay out of the public directory. Restricted workspaces
  disclose their title but require membership to read their contents. Viewer,
  contributor, editor, and owner roles govern mutations on the server.
- Shared critiques support photos, video, PDFs, worked maths, code, and tables,
  with feedback attached to a place or moment. Discussion supports replies,
  helpful marks, proposed explanations, and evidence links.
- Reports, written moderation decisions, review queues, known-image hash
  matching, incident records, and appeals have working web data flows. Operators
  must supply appropriate scanners/hash lists and reporting procedures.

## Media and rendering

Written content is server rendered. In light reading, photo and video elements,
posters, caption tracks, and source URLs are omitted until requested. Transcripts
and image descriptions remain readable. Playback uses native controls, no
autoplay, and `preload="none"`, with retry and text alternatives on failure.

Web uploads are sniffed and size limited. Images are decoded, re-encoded without
metadata, scanned against the configured hash list, and bounded to 1600 pixels
per edge. Actual dimensions determine layout. Video publishing requires a
descriptive transcript plus timed plain-text WebVTT captions, unless the author
confirms that the recording has no meaningful audio. This is author-supplied
text, not independent accessibility review. Staged files cannot be delivered or
approved before the publication transaction commits; failed publications clean
up ordinary staged files. Quarantined moderation evidence is retained.

`UNSTUCK_UPLOAD_REVIEW` defaults to `all` in production. Video and PDF are not
transcoded or deeply validated in this web upload path. Production needs the
sandboxed intake/encoding pipeline, real scanner integration, native device
playback checks, object-store policies, and manual accessibility review.

## Two data systems currently exist

The Node server modules in `lib/*.server.ts` own a PostgreSQL `web` schema for
accounts, publishing, communities, collaboration, moderation, and critiques.
`lib/schema.server.ts` applies additive schema setup on startup under a lock.
This is separate from the Python API's normalized tables and migration runner.
Recovery-code accounts and web uploads are **not** automatically Python API
accounts or versioned `/m/` assets.

`UNSTUCK_API_URL` can additionally read the Python API's public feed and entry
contracts. Those contracts have a separate validated media renderer with
responsive renditions and reviewed accessibility metadata. A failed API request
does not become sample content or a false missing-entry result. Live API search
still indexes the loaded summaries, not the full upstream corpus. Web search
indexes the bounded loaded web records; neither is a scalable search service.

Unifying identity, publication, evidence rules, migration ownership, search, and
media delivery is required before operating this as one production platform.
See [the review record](../../docs/REVIEW.md) and the
[implementation ledger](../../docs/IMPLEMENTATION.md). Installing a different
frontend framework would not resolve these data boundaries.

## Verification

```sh
npm run contracts:check
npm run typecheck
npm test
npm run build
UNSTUCK_TEST_PORT=3106 npm run test:production
npm run test:media-production
npm run test:browser
```

Store tests create and drop their own database using the local development
cluster, or `UNSTUCK_TEST_DATABASE_URL`. Production HTTP checks own their test
servers and stop if a port is occupied. They do not restart an existing dev
server. Chromium tests use a synthetic API, record phone/desktop layout
screenshots, and check media consent, error recovery, keyboard navigation, and
compact journey images. They require Playwright Chromium to be installed.

JSDOM/axe and synthetic browser checks do not certify WCAG conformance, real
codec playback, CDN behavior, recovery from a machine failure, or launch scale.
