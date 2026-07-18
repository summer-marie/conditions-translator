# Project Status

## Current Version

Documentation v1.2

Architecture Frozen

## Current Phase

Phase 10 (UI Refinement) and Phase 9 (Cleanup, Reliability, Demo Validation) are both active/
recently completed. Phases 1–9 are implemented on `main` (Phase 9 on branch
`feat/phase-9-cleanup-retention`, not yet merged as of this writing). Phase E2E (stabilization) is
complete — all previously-tracked E2E fixes are merged; no known unmerged fixes remain in any
branch. OCR transcription correction (previously listed as "approved, not yet implemented") has
shipped and is live on `main`.

> Status terms used below: **approved** (decided/documented), **planned** (sequenced, not started),
> **in progress** (partially built), **implemented** (code exists on `main` or a ready-to-merge
> branch), **tested** (verified by the test suite and/or documented manual testing).

## Progress by Phase

- Phase 1 — Project Foundation: **implemented**.
- Phase 2 — Schema, ORM, and Ownership: **implemented, tested** (schema/ownership suites).
- Phase 3 — Temporary Workspace and Document Intake: **implemented**.
- Phase 4 — OCR and Page Acceptance: **implemented**, including the approved OCR transcription
  correction workflow (see below) — implemented, not just documented.
- Phase 5 — Finish Document and Section Generation: **implemented**.
- Phase 6 — Temporary AI Chat and Safety Behavior: **implemented**.
- Phase 7 — Account Creation and Ownership Transfer: **implemented, tested** (live-DB transfer).
- Phase 8 — Dashboard and Deletion: **implemented, tested**, including a document-level
  overflow-actions menu (Review pages / Delete document) in the sidenav/hamburger nav.
- Phase E2E — Stabilization: **complete**. All fixes identified during E2E manual testing are
  merged to `main`. No outstanding unmerged branch was found (verified: every branch in the repo
  other than `main` has zero commits ahead of it).
- Phase 9 — Cleanup, Reliability, Demo Validation: **implemented, tested** on
  `feat/phase-9-cleanup-retention` (not yet merged). A scheduled cleanup sweep
  (`lib/cleanup/sweep.ts`, hourly via Vercel Cron, `vercel.json`) now actually deletes expired
  temporary sessions/Documents/Pages/Blob images and expired chat sessions, reusing the existing
  Phase 8 deletion pipeline for retry-safety. No schema change was needed. See
  `docs/TESTING_GUIDE.md`'s Phase 9 entry for full test detail, including a live-DB verification
  run. A logging/privacy audit found and fixed 4 routes logging raw error objects; no sensitive
  content (page/chat text, secrets) was found logged anywhere.
- Phase 10 — UI Refinement and Documentation: **in progress, extensive**. Design tokens, shared
  components, shared nav (desktop sidebar + mobile bottom tabs/hamburger + document list +
  overflow actions), dark mode, accessibility, public marketing landing page, About/Terms pages,
  light-mode visual overhaul, and document-organization UI (Sections view for finished documents)
  are all merged. A usability audit (`docs/USABILITY_UI_AUDIT.md`) found 8 further issues; roughly
  half fixed, half deferred per the audit's own priority order.

## Approved Next Implementation

**OCR transcription correction workflow** — **approved, documented, and implemented.**

`OcrResult.correctedText` (schema column + migration), the `correctPageOcr` Server Action, and
workspace UI for reviewing/correcting a page's transcription before approval all exist on `main`.
Remaining verification: the Launch Readiness Checklist's dedicated OCR-correction checklist items
(§7) have not been formally checked off against the shipped implementation.

## Documentation Status

Up to date as of 2026-07-18 (Phase 9 branch). `.agent-memory/` files are kept current going
forward — see `.agent-memory/WORK_LOG.md` for the 2026-07-17 reconciliation sweep and the Phase 9
implementation entry.

## Outstanding Items

- Merge `feat/phase-9-cleanup-retention` (pending user review).
- Real Vercel Cron invocation on a deployed environment has not been independently confirmed —
  only a manual trigger command is documented (`docs/Deployment_Vercel.md`).
- Remaining `docs/USABILITY_UI_AUDIT.md` findings (deferred items — see that document).
- Known, deliberately unfixed: `createTemporaryDocument` cannot create a document for a
  signed-in user. See `.agent-memory/OPEN_QUESTIONS.md`.
- Next work order (user-stated, 2026-07-17): (1) Phase 9 — now implemented, pending merge;
  (2) landing-page content updates; (3) real-phone OCR validation focused on handwriting.
- `docs/01_MVP_PRD.md` §4 documents a redirect-only guest journey; the app now also has a public
  marketing landing page, decided and implemented but not reconciled back into the PRD text (PRD
  itself remains frozen/unedited, per architecture rules).
- Duplicate-label warning (Launch Readiness Checklist §10) remains unimplemented.
- The temporary `[ocr-diag]` diagnostic logging (added 2026-07-14 to investigate a real OCR 502 on
  phone photos) is still in place — that investigation remains open.

## Future Documentation

- Decision Logs (as needed)
- Wireframes (as UI is implemented) — `design-specs/` and `docs/Wireframe_Implementation.md` exist
  and are actively used as the UI reference.
