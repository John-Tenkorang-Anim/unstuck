# Application review — 8 November 2026

This review covers the working tree, the existing engineering specification, and
the supplied writing-block product brief. The user's direction takes precedence
for presentation: simplicity, professional restraint, Apple-inspired hierarchy,
compact photography, and fewer visible borders. This is an implementation review,
not a statement that the entire specification is launch-ready.

## Repaired behavior

| Area | Change | Verification |
| --- | --- | --- |
| Workspace privacy | Restricted outsiders get a directory title only; private teams stay out of the directory. Contents and mutations require the appropriate role. Demoted viewers cannot continue moving old items. | Real PostgreSQL access regression tests |
| Invitations and identity | Duplicate names cannot silently select the wrong account. Invitations accept exact public profile links. Profiles use independent public UUIDs; account tokens expire after 30 days. | Real database identity/invitation/session tests |
| Concurrent edits | Test runs/results and proposal transitions/revisions lock the owning row and commit together. Independent test-plan field edits survive. | Parallel write and one-winner transition tests |
| Proposal drafts | Outsiders cannot comment on or resolve events in unpublished drafts. Proposal listings include real recent activity. Actor identity is not inferred from a display name. | Draft access and activity tests |
| Durable lookup | Older drafts and problem detail pages use direct lookups, rather than searching the first directory page. Related problem queries filter before limiting results. | Old draft and 302-newer-problem regressions |
| Original outcomes | A failed attempt remains failed when a later improvement works. A local success is labelled “Worked here”; supported follow-ups are shown separately. | Knowledge-model tests |
| Comparison integrity | Missing measurements remain missing, incomplete attempts are not success, and descriptive associations never become verified causal conclusions. | Comparison regressions |
| Draft continuity | Ordinary text forms restore their session draft after sign-in; sensitive inputs are excluded. Return paths retain context and reject external redirects. The guided composer retains its existing draft flow. | Form interaction/navigation tests |
| Following | My Space resolves each supported follow type or shows an unavailable record. Activity includes public attempts from followed people/categories/problems and permitted workspace changes. | Real database activity/privacy tests |
| Outages | Database acquisition/query waits are bounded. Relevant read failures reach an error boundary or API error, rather than silently becoming an empty list, missing record, or example replacement. | HTTP upstream-outage check and production build; not a full outage/load exercise |
| Upload publication | Files are staged outside delivery and moderator approval until the publication commits. Ordinary failed publications clean up staged files. Moderators cannot approve quarantined files. | Real SQL publishing/staging tests and HTTP review checks |
| Image rendering | Server-derived dimensions replace client dimensions; sanitized uploaded images fit within 1600 pixels per edge. Compact discovery frames constrain landscape previews. | Forged dimension test and phone/desktop browser checks |
| Accessible playback | New web video uploads require descriptive text and captions for meaningful audio. Both renderers omit media until light-reading consent, keep text on failure, and use native controls. | Component, SSR and Chromium consent/error tests |
| Navigation and reading | Shared controls, phone navigation, context disclosures, shareable discussion tabs, community return links, and empty states work with the current page model. Legacy discussion links remain supported. | Production HTTP and keyboard/browser checks |
| Demonstration data | Examples require explicit opt-in with configured services. Disabling them removes sample attempts, sessions, communities and counts; illustrative library content is labelled. | Live-mode database regression and SSR checks |
| Visual system | Native type and neutral surfaces replace competing palettes/font requests. Compact photographs, text hierarchy and whitespace replace repeated cards and row borders. Stale preview scripts and unused font packages are removed. | Desktop, phone and dark screenshots; browser layout assertions |

## Current architecture

The application contains two implementations. The Python API has normalized
Postgres migrations, scoped aliases, versioned entry/media contracts, and a
persistent core with transactional outbox writes. Its unported workflows still
return 501 in Postgres mode.

The newer Next/Node server modules implement their own `web` schema, recovery-code
identity, publishing, proposals, tests, workspaces, critique and moderation. They
are functional, but do not automatically use the Python identity, evidence,
versioning or worker models. Node upload delivery is not the versioned `/m/`
publication pipeline. Applying the web schema during startup is not a reviewed
migration/deployment process.

`UNSTUCK_API_URL` adds public reads from Python. It does not unify account creation,
permissions, writes, search, media approval or schema ownership. That distinction
is now stated in both READMEs and the implementation ledger.

## Remaining release work

1. Choose and consolidate the system of record, identity and publication rules;
   migrate existing data with a tested rollback and explicit migration role.
   Connect the UI to the resulting versioned write contracts. Preserve scoped
   public identities where the original specification requires them.
2. Complete persistent explanations/knowledge/media workflows, outbox transport,
   durable job leases/retries, live events and scheduled cleanup. Do not replace
   these with synchronous page requests or in-process background work.
3. Deploy sandboxed intake, codec validation/transcoding, bounded responsive
   derivatives, scanners, caption review and secure storage/CDN policy. Web video
   bytes currently retain their uploaded encoding; PDFs use conservative checks,
   not a full rendering/sanitization sandbox. Crash-abandoned staged uploads need
   scheduled retention cleanup.
4. Add durable web edit/version history, pattern/guide/collection authoring,
   complete account/settings/deletion flows, passkeys, and notification coverage.
   Existing Activity is collaboration history, not an immutable version archive.
5. Implement searchable pagination and scalable feeds across the complete corpus.
   Current page and related-record limits are explicit bounds, not completeness
   guarantees for very large communities, profiles or problems.
6. Complete evaluated multilingual/RTL, voice, translation/AI, offline and later
   specification features. Sample comparison data and curated guides do not
   constitute those services.
7. Rehearse backup restoration and data migration, validate monitoring and rate
   limiting behind the deployed proxy, measure load/performance budgets, test
   native playback on actual devices, and conduct assistive-technology and manual
   accessibility review. Automated axe checks are not a WCAG certification.

The [implementation ledger](IMPLEMENTATION.md) retains the detailed Python scope.
The [web README](../apps/web/README.md) describes working application flows and
commands. CI artifacts preserve the synthetic browser layout screenshots.
