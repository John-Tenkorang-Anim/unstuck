# 0002 Search, media moments and feedback sessions

Status: prototype in `apps/web`, sample data only. Backend support is listed at the end.

## Problem

People arrive with a problem in their own words. They need to find the attempt,
the photo or the exact second of video that answers it, across many fields and
professions. Students and practitioners also need structured feedback on their
own work, not a flat comment thread.

## Information model

- **Field, specialty, profession.** Every entry and session sits in one field and
  one specialty (`lib/taxonomy.ts`). Professions map to specialties and follow the
  ILO's ISCO-08 groups, so adding an occupation is a data change.
- **Kind and outcome** stay as the spec defines them.
- **Anchors** are the unit of retrieval below the entry: a video moment, a photo
  or pin, a story section, an explanation, or a session note. Anything people say
  can point at an anchor, and search can land on one.
- **Sessions** hold feedback. A session has the work, its pins or video moments,
  rounds for revisions, typed notes (issue, suggestion, question, strength for
  critique; hypothesis, evidence, question for inquiry) and a status
  (waiting, in review, revised, resolved).

## Shown working for schools and engineering

Coursework rarely fits in a photo. A session can carry **working blocks**:

- **Steps** with inline maths between `$…$`, typeset by KaTeX with a MathML layer
  for screen readers.
- **Code** with line numbers, its actual output and the expected output.
- **Data** pasted from a spreadsheet or CSV with a header row.

Feedback anchors to a step, a line or a row, the same way it anchors to a pin or
a video second. A session can be marked **hints only** for graded work: reviewers
see a banner asking them to point at the problem and ask guiding questions rather
than post a solution. Sessions also record the course or project.

## Retrieval

`lib/search.ts` is field-weighted BM25 with light stemming. Weights favour titles
and marked video moments, then summaries and explanations, then photo
descriptions and context, then full text and session notes. Coverage of all query
terms and an exact-phrase match add a boost, and "found it useful" counts add a
small quality prior, as in spec section 11.2. Each result returns its best
anchors, so `/search` can link to `?t=116#clip` or a specific pin.

The results page combines three layers:

1. **What the attempts say**: counts of outcomes, the marked failure points and
   the explanations on record, all computed from matching entries, never written
   by a model.
2. **Moments in video**: matching seconds as a row, opening the player there.
3. **Results**, each with the field path, highlighted snippet, matched anchors and
   a thumbnail with duration.

Tabs filter by result type and chips filter by field. The page is server-rendered
and works without JavaScript.

## Media

Notes and sessions accept photos and one video by paste, drop or file choice,
within the spec limits of 8 photos at 15 MB and one 60-second video at 100 MB.
Authors pin spots on photos and mark moments in video. Drafts keep files in
IndexedDB on the device. The player lists marked moments as keyboard-reachable
chapters with text descriptions, so the failure point is understandable without
playback. Light reading never loads photos or video until asked.

## Sharing (decided outside the spec)

The web app owns community data in PostgreSQL, in a `web` schema separate from
the API's tables (`lib/schema.server.ts`, applied at startup under an advisory
lock).

- **Accounts** are a display name and optional role. Each signed-in browser has
  its own token in an HttpOnly, SameSite=Lax cookie; the database stores only
  SHA-256 hashes of tokens and of the recovery code. A recovery code signs the
  account in elsewhere and can be replaced.
- **Writes** require a same-origin `Origin` header, an account that isn't
  suspended, and a rate-limit slot. Limits are counted in `web.rate_events` under
  a transaction-scoped advisory lock, so they hold across processes.
- **Uploads** are identified by their first bytes and size-limited. Images are
  decoded and re-encoded, which strips metadata. PDFs with scripts, launch
  actions, embedded files or forms are refused. An optional scanner can block a
  file or send it for review. Files waiting for review are visible only to their
  owner and moderators. File bytes live on disk outside `public/` and are served
  with `nosniff`, a sandboxing CSP and byte ranges.
- **Moderation:** one report per person per item; three open reports hide it.
  Moderators hide, restore, dismiss, approve or reject files, and suspend
  accounts. Each action requires a reason and is recorded in
  `web.moderation_actions`.
- **Field notes** are published with photos and a video with marked moments,
  and appear in the feed, entry pages and search beside the API's entries.

- **Known-abuse imagery:** photos are hashed with PDQ (`lib/pdq.ts`), checked
  bit-for-bit against Meta's reference implementation. Hashes are stored, matched
  against `UNSTUCK_HASH_LIST` at upload, and re-checked on demand. A match puts
  the original in a `quarantine` storage area that no route serves, suspends the
  uploader and opens an incident with jurisdiction-specific reporting guidance.
  Moderators record the hotline's reference. Joining a hash-sharing programme,
  keeping evidence for the legally required period and filing reports are
  operator responsibilities.
- **Appeals:** one per person per hidden item or suspension. The decision
  needs a written reason, and a moderator can't decide an appeal against their
  own action while another moderator exists. Overturning restores the item or
  lifts the suspension.
- **Storage:** `lib/storage.server.ts` writes to local disk or to an
  S3-compatible bucket, with ranged reads for video seeking.

Not covered: hash matching for video frames and PDF pages, which are held for
moderator review in production instead.

## Not yet backed by the API

- Hybrid keyword and vector search over anchors and transcripts (spec 11.1).
  Live mode searches only the public feed's titles and summaries.
- Public `video_markers` and `annotations` (the tables exist in migration 0001).
- Sessions, session notes and media publishing, which need accounts.
