# Project Status

## Current Version

Documentation v1.3

Architecture Frozen

## Current Phase

Phase 10 (UI Refinement) is in progress, extensive; Phase 9 (Cleanup, Reliability, Demo
Validation) is complete and merged. Phases 1–9 are implemented and merged to `main` (Phase 9 via
PR #25, its cron cadence adjusted to daily via PR #26 for Vercel Hobby-plan compatibility). Phase
E2E (stabilization) is complete — all previously-tracked E2E fixes are merged; no known unmerged
fixes remain in any historical branch. OCR transcription correction (previously listed as
"approved, not yet implemented") has shipped and is live on `main`. Landing-page content/visual
polish (PR #27) is also merged — see Phase 10 below. An installed-PWA redirect-loop bug fix is in
progress on branch `fix/pwa-redirect-loop` (tested, not yet merged — see "In Progress" below).

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
- Phase 9 — Cleanup, Reliability, Demo Validation: **implemented, tested, merged** to `main` (PR
  #25). A scheduled cleanup sweep (`lib/cleanup/sweep.ts`, once daily via Vercel Cron, `vercel.json`
  — daily rather than hourly because the project runs on the Vercel Hobby plan, which does not
  allow more-frequent cron schedules; migrating to GitHub Actions is a possible future option, not
  needed today) now actually deletes expired temporary sessions/Documents/Pages/Blob images and
  expired chat sessions, reusing the existing Phase 8 deletion pipeline for retry-safety. No schema
  change was needed. See `docs/TESTING_GUIDE.md`'s Phase 9 entry for full test detail, including a
  live-DB verification
  run. A logging/privacy audit found and fixed 4 routes logging raw error objects; no sensitive
  content (page/chat text, secrets) was found logged anywhere.
- Phase 10 — UI Refinement and Documentation: **in progress, extensive**. Design tokens, shared
  components, shared nav (desktop sidebar + mobile bottom tabs/hamburger + document list +
  overflow actions), dark mode, accessibility, public marketing landing page, About/Terms/FAQ
  pages, light-mode visual overhaul, and document-organization UI (Sections view for finished
  documents) are all merged. A usability audit (`docs/USABILITY_UI_AUDIT.md`) found 8 further
  issues; roughly half fixed, half deferred per the audit's own priority order. Landing-page
  content/visual pass (PR #27, merged): FAQ page added; landing hero/how-it-works/bottom-CTA copy
  rewritten; a token-derived ambient "glow" background system added across the landing page, the
  About/Terms/FAQ pages, and the public header (light mode fully, dark mode ported and
  intensity-tuned per explicit feedback — CTA section kept full intensity, hero/features/workspace
  sections deliberately more subdued); the landing page converted to a rem-first fluid `clamp()`
  sizing system for headings/spacing/gaps (replacing discrete Tailwind breakpoint jumps), plus a
  follow-up fix narrowing two headings' pre-breakpoint max-widths to remove a real measured
  200-490px heading-width "snap" at the `lg` grid-column breakpoint; a sitewide (not landing-only)
  `@media (any-pointer: fine)` pointer-cursor rule was also added in `app/globals.css` for
  genuinely interactive elements only.

## In Progress

**Installed-PWA redirect loop fix** — branch `fix/pwa-redirect-loop` (2 commits, tested, not yet
merged). Root cause: the temporary-session cookie (`lib/session/temporary.ts`) was set with
`SameSite=Strict`; a Strict cookie set mid-redirect isn't reliably sent back on the very next
request when the browsing context is a fresh top-level navigation with no same-site referrer —
exactly what an installed PWA relaunch from the OS home screen is — so the app re-triggered its
own `/api/session/bootstrap` redirect forever ("too many redirects"). Fixed by changing that
cookie to `SameSite=Lax` (matching this project's own existing convention for the analogous auth
session cookie) and by adding an explicit `start_url`/`scope` to `public/manifest.json` (it had
neither, so an install could anchor to whatever page was open at install time instead of the
public landing page). A related follow-up fix in the same branch: `app/app/layout.tsx`'s
temp-session gate ran unconditionally regardless of sign-in status, so a signed-in user
deep-linking straight into e.g. `/app/workspace` got bounced through the bootstrap redirect and
landed on `/app/start` instead (not a loop, just the wrong landing spot) — fixed by checking
`getCurrentUser()` first and skipping the temp-session gate entirely for signed-in users. Verified
via raw HTTP redirect-chain/cookie tracing and Playwright fresh-context tests simulating a cold
PWA-style launch; no real installed-PWA/device test was possible in this environment.

## Approved Next Implementation

**OCR transcription correction workflow** — **approved, documented, and implemented.**

`OcrResult.correctedText` (schema column + migration), the `correctPageOcr` Server Action, and
workspace UI for reviewing/correcting a page's transcription before approval all exist on `main`.
Remaining verification: the Launch Readiness Checklist's dedicated OCR-correction checklist items
(§7) have not been formally checked off against the shipped implementation.

## Documentation Status

Up to date as of 2026-07-19 (branch `fix/pwa-redirect-loop`). `.agent-memory/` files are kept
current going forward — see `.agent-memory/WORK_LOG.md` for the fullest chronological detail,
including this update.

## Outstanding Items

- Merge `fix/pwa-redirect-loop` (pending user review — see "In Progress" above).
- Real Vercel Cron invocation on a deployed environment has not been independently confirmed —
  only a manual trigger command is documented (`docs/Deployment_Vercel.md`).
- Remaining `docs/USABILITY_UI_AUDIT.md` findings (deferred items — see that document).
- Known, deliberately unfixed: `createTemporaryDocument` cannot create a document for a
  signed-in user. See `.agent-memory/OPEN_QUESTIONS.md`.
- Next work order (user-stated, 2026-07-17; items 1–2 now complete): (1) Phase 9 — done, merged;
  (2) landing-page content updates — done, merged (PR #27), plus the installed-PWA fix above which
  was reported and fixed in the interim; (3) real-phone OCR validation focused on handwriting —
  not yet started.
- `docs/01_MVP_PRD.md` §4 documents a redirect-only guest journey; the app now also has a public
  marketing landing page, decided and implemented but not reconciled back into the PRD text (PRD
  itself remains frozen/unedited, per architecture rules).
- Duplicate-label warning (Launch Readiness Checklist §10) remains unimplemented.
- The temporary `[ocr-diag]` diagnostic logging (added 2026-07-14 to investigate a real OCR 502 on
  phone photos) is still in place — that investigation remains open.
- Any device that already installed the PWA under the old (missing-`start_url`) manifest cached
  that manifest at install time — the `fix/pwa-redirect-loop` manifest fix only takes effect for
  new installs or after the OS/browser re-fetches an updated manifest (platform-dependent);
  existing installs may need to be reinstalled to pick up the new `start_url`.

## Future Documentation

- Decision Logs (as needed)
- Wireframes (as UI is implemented) — `design-specs/` and `docs/Wireframe_Implementation.md` exist
  and are actively used as the UI reference.
