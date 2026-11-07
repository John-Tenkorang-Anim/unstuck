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

## Not yet backed by the API

- Hybrid keyword and vector search over anchors and transcripts (spec 11.1).
  Live mode searches only the public feed's titles and summaries.
- Public `video_markers` and `annotations` (the tables exist in migration 0001).
- Sessions, session notes and media publishing, which need accounts.
