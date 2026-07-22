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

- **Chat legal-disclaimer UX + prompt de-repetition (2026-07-21, branch
  `feat/chat-legal-disclaimer`, not yet merged).** The chat system prompt
  (`lib/chat/prompt.ts`) previously instructed the model to "add a brief, calm disclaimer
  where appropriate" on every substantive answer, on top of four SPECIFIC BEHAVIORS
  categories (permission/missing-source/conflict/violation questions) that each separately
  encode a hedge — since real supervision questions land in one of those categories almost
  every time, this produced constant "not legal advice"-style boilerplate. Root cause fixed
  by moving the standing "not legal advice" disclaimer into the product UI (acknowledged
  once) and rewriting CORE RULES to tell the model not to repeat a generic disclaimer per
  answer, restricting inline caveats to the four behaviors and only when actually triggered.
  All four required safety behaviors (`docs/06_AI_Safety_and_Persona.md` §4) are unchanged.

  Added a new, separate chat-specific disclaimer acknowledgment (deliberately distinct from
  the existing Privacy Notice gate — `components/landing/PrivacyGateModal.tsx` /
  `noticeAcceptedAt` — which covers data retention, not legal-advice framing):
  `User.chatDisclaimerAcknowledgedAt` (once per account, never re-prompted) and
  `TemporarySession.chatDisclaimerAcknowledgedAt` (once per temporary session — a new session
  always re-prompts) via a new migration
  (`20260721224749_add_chat_disclaimer_acknowledgment`), `lib/session/chatDisclaimer.ts`, and
  `lib/actions/chatDisclaimer.ts`. `/api/session/status` now also reports
  `chatDisclaimerAcknowledged`. Desktop shows a compact `Alert` banner at the top of the chat
  box (`app/app/chat/page.tsx`); mobile shows a new focus-trapped, non-full-screen bottom
  sheet (`components/chat/ChatDisclaimerSheet.tsx`, `md:hidden`). Enforcement is
  defense-in-depth, not UI-only: `createChatSession`/`sendChatMessage`
  (`lib/chat/session.ts`) call `requireChatDisclaimerAcknowledged` server-side and throw
  `CHAT_DISCLAIMER_NOT_ACKNOWLEDGED` (403) regardless of client state; the UI additionally
  disables Start Chat/Send until acknowledged.

  Validated: `tsc --noEmit` clean; `npm run lint` at the pre-existing 24-error/7-warning
  baseline (unrelated files); full `npm test` 300/300 (18 new: chat-disclaimer helper,
  extended chat-session enforcement tests, extended prompt tests, new `/api/session/status`
  tests); and 6 new Playwright tests across both a new `desktop-chrome` project (Desktop
  Chrome viewport, scoped via a `*.desktop.pw.ts` naming convention so it doesn't affect the
  existing mobile-only spec) and the existing `mobile-chrome` project — covering: the mobile
  sheet appears, traps focus, and blocks the underlying screen until acknowledged; a new
  temporary session is prompted independently of another session's acknowledgment; the
  desktop banner appears/hides correctly; and a signed-in user's acknowledgment persists
  per-account regardless of any temporary session. Fixed one incidental regression this
  surfaced: `tests/e2e/mobile-chat-overflow.pw.ts`'s seeded session now pre-acknowledges the
  new disclaimer directly via Prisma, since that test is about layout, not this flow. Real
  model-output frequency (whether live answers actually repeat less) is not
  Playwright-testable without a real billed OpenAI call — validated via the prompt's static
  test assertions only; recommend a manual spot-check against a few live chat turns before
  merge.

- **Mobile chat layout overflow (2026-07-21, branch `fix/mobile-chat-scroll-overflow`, not yet
  merged).** On mobile, a long assistant response in `/app/chat` grew past the viewport instead of
  scrolling inside the message log, making the composer unreachable. Root cause: the chat screen's
  inner flex column (`app/app/chat/page.tsx`) was missing `min-h-0`, so it kept CSS flexbox's
  default `min-height: auto` and refused to shrink below its content's intrinsic height inside the
  outer viewport-height-constrained wrapper — the message `Card`'s existing `overflow-y-auto` never
  got a bounded height to scroll within. Fix: added `min-h-0` to that inner flex column (one class,
  one line).

  Validated: `tsc --noEmit` clean; `npm run lint` shows only the pre-existing 24-error/7-warning
  baseline (unrelated files); full `npm test` (282/282) unaffected; and — after checking with the
  user, since this project had zero E2E infrastructure before this fix — a new Playwright regression
  test (`tests/e2e/mobile-chat-overflow.pw.ts`, `npm run test:e2e`) that seeds a real
  TemporarySession + READY Document/Page directly via Prisma (same live-DB pattern as
  `tests/schema/helpers.ts`), reaches the real chat screen through the real UI (no OpenAI call
  involved in `startChat`), and injects a long assistant message directly into the DOM to avoid a
  real billed OpenAI call. Confirmed the test genuinely catches the regression: reverting the
  `min-h-0` fix reproduced a 6748px document height against a 729px mobile viewport and failed the
  test; restoring the fix passes it. This is the project's first Playwright/E2E test — see
  `playwright.config.ts` and `.claude/session-memory/OPEN_QUESTIONS.md` for the infra-gap context
  that preceded it (now resolved for this fix; future live-integration tests should still be
  discussed with the user given the live Neon DB is shared with real dev use).

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
