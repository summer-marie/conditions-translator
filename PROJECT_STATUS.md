# Project Status

## Current Version

Documentation v1.4

Architecture Frozen

## Current Phase

**All phases defined in `docs/08_Conditions_Translator_Implementation_Roadmap.md` are complete**
(Phase 1 through Phase 10, Phase E2E, and the Wireframe Implementation handoff). Phases 1–9 are
implemented and merged to `main` (Phase 9 via PR #25, its cron cadence adjusted to daily via PR #26
for Vercel Hobby-plan compatibility). Phase E2E (stabilization) is complete — all previously-tracked
E2E fixes are merged; no known unmerged fixes remain in any historical branch. OCR transcription
correction (previously listed as "approved, not yet implemented") has shipped and is live on
`main`. Phase 10 (UI Refinement) is complete: landing-page content/visual polish (PR #27) and the
installed-PWA redirect-loop fix (PR #28) are both merged — see Phase 10 below.

**No next phase is currently defined.** Remaining known issues and deferred work are tracked under
"Known Limitations and Backlog" below, not as an open phase — the next phase will be scoped
separately when work resumes.

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
- Phase 10 — UI Refinement and Documentation: **complete**. Design tokens, shared
  components, shared nav (desktop sidebar + mobile bottom tabs/hamburger + document list +
  overflow actions), dark mode, accessibility, public marketing landing page, About/Terms/FAQ
  pages, light-mode visual overhaul, and document-organization UI (Sections view for finished
  documents) are all merged. A usability audit (`docs/USABILITY_UI_AUDIT.md`) found 8 further
  issues; roughly half fixed, half deferred per the audit's own priority order — the deferred
  items are tracked under "Known Limitations and Backlog" below, not as blockers to this phase's
  closure. Landing-page content/visual pass (PR #27, merged): FAQ page added; landing
  hero/how-it-works/bottom-CTA copy rewritten; a token-derived ambient "glow" background system
  added across the landing page, the About/Terms/FAQ pages, and the public header (light mode
  fully, dark mode ported and intensity-tuned per explicit feedback — CTA section kept full
  intensity, hero/features/workspace sections deliberately more subdued); the landing page
  converted to a rem-first fluid `clamp()` sizing system for headings/spacing/gaps (replacing
  discrete Tailwind breakpoint jumps), plus a follow-up fix narrowing two headings'
  pre-breakpoint max-widths to remove a real measured 200-490px heading-width "snap" at the `lg`
  grid-column breakpoint; a sitewide (not landing-only) `@media (any-pointer: fine)`
  pointer-cursor rule was also added in `app/globals.css` for genuinely interactive elements only.
  Also merged as part of Phase 10: the installed-PWA redirect-loop fix (PR #28) — the
  temporary-session cookie (`lib/session/temporary.ts`) was changed from `SameSite=Strict` to
  `SameSite=Lax` (a Strict cookie set mid-redirect isn't reliably sent back on the very next
  request when the browsing context is a fresh top-level navigation with no same-site referrer —
  exactly what an installed PWA relaunch from the OS home screen is, so the app was
  re-triggering its own `/api/session/bootstrap` redirect forever), and an explicit
  `start_url`/`scope` was added to `public/manifest.json`. A related fix in the same PR:
  `app/app/layout.tsx`'s temp-session gate now checks `getCurrentUser()` first and skips the gate
  entirely for signed-in users, so a signed-in user deep-linking into e.g. `/app/workspace` lands
  there directly instead of being bounced to `/app/start`. Verified via raw HTTP
  redirect-chain/cookie tracing and Playwright fresh-context tests simulating a cold PWA-style
  launch; no real installed-PWA/device test was possible in that environment — devices that
  installed the PWA under the old manifest won't get the fix until reinstalled or the OS/browser
  re-fetches the manifest (platform-dependent).

## Recent Fixes (Post-Phase, Unscoped)

- **Mobile chat layout overflow (2026-07-21, branch `fix/mobile-chat-scroll-overflow`, not yet
  merged).** On mobile, a long assistant response in `/app/chat` grew past the viewport instead of
  scrolling inside the message log, making the composer unreachable. Root cause: the chat screen's
  inner flex column (`app/app/chat/page.tsx`) was missing `min-h-0`, so it kept CSS flexbox's
  default `min-height: auto` and refused to shrink below its content's intrinsic height inside the
  outer viewport-height-constrained wrapper — the message `Card`'s existing `overflow-y-auto` never
  got a bounded height to scroll within. Fix: added `min-h-0` to that inner flex column (one class,
  one line). Verified: `tsc --noEmit` clean, `npm run lint` shows only the pre-existing 24
  errors/7 warnings baseline (unrelated, in `tests/lib/session/temporary.test.ts` and elsewhere),
  full `npm test` suite (282/282) unaffected. **Not yet verified**: a real mobile-browser/Playwright
  visual regression check — this project currently has zero Playwright/E2E infrastructure (the
  entire test suite is Vitest with fully mocked Prisma), and `.env.local`'s `DATABASE_URL`/
  `OPENAI_API_KEY` point to real remote services (Neon, OpenAI) with no test/sandbox separation, so
  standing up a live-integration browser test is a real infrastructure decision, not a quick
  addition — flagged to the user rather than done unilaterally. See
  `.claude/session-memory/OPEN_QUESTIONS.md`.

## Historical: OCR Transcription Correction

**OCR transcription correction workflow** — **approved, documented, and implemented.** This was
the last "approved next implementation" tracked in this document; it has since shipped and there
is currently no new approved-but-unbuilt implementation queued. Future work will be scoped as a
new phase when defined.

`OcrResult.correctedText` (schema column + migration), the `correctPageOcr` Server Action, and
workspace UI for reviewing/correcting a page's transcription before approval all exist on `main`.
Remaining verification: the Launch Readiness Checklist's dedicated OCR-correction checklist items
(§7) have not been formally checked off against the shipped implementation.

## Documentation Status

Up to date as of 2026-07-21. `.claude/session-memory/` (tracked in git as of this update — see
`.gitignore`) holds ongoing session detail; see `.claude/session-memory/WORK_LOG.md` for the
fullest chronological detail, including this update. **Note:** this file is hand-maintained and
has previously gone stale between updates (e.g. this revision found three items in the previous
"Outstanding Items" list that were already resolved) — verify against `git log`/current code
before trusting its narrative as current fact.

## Known Limitations and Backlog

Not tied to any current phase — the phases that produced these are complete, but the items below
remain true limitations or deferred work. Pick up as a newly-scoped phase when ready.

- Real Vercel Cron invocation on a deployed environment has not been independently confirmed —
  only a manual trigger command is documented (`docs/Deployment_Vercel.md`).
- Remaining `docs/USABILITY_UI_AUDIT.md` findings (2026-07-18, deferred items — see that
  document). **Not re-verified since that audit** — confirm each against current code before
  treating any specific one as still open.
- `createTemporaryDocument` (`lib/actions/document.ts`) cannot create a document for a signed-in
  user — confirmed still true by reading current code as of 2026-07-20.
- The temporary `[ocr-diag]` diagnostic logging (added 2026-07-14 to investigate a real OCR 502 on
  phone photos) is still in place as of 2026-07-20 — that investigation remains open.
- Any device that already installed the PWA under the old (missing-`start_url`) manifest cached
  that manifest at install time — the redirect-loop fix's manifest change only takes effect for
  new installs or after the OS/browser re-fetches an updated manifest (platform-dependent);
  existing installs may need to be reinstalled to pick up the new `start_url`.
- Real-phone OCR validation focused on handwriting (user-stated priority, 2026-07-17) — not yet
  started.

## Future Documentation

- Decision Logs (as needed)
- Wireframes (as UI is implemented) — `design-specs/` and `docs/Wireframe_Implementation.md` exist
  and are actively used as the UI reference.
