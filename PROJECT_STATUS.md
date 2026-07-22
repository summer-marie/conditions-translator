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

- **Last "Conditions Translator" user-facing string renamed to Verity (2026-07-22, same branch
  `fix/badge-text-centering` per explicit user instruction to stay on it, not yet merged).**
  Follow-up to a same-day audit pass. The workspace page's page-review warning banner
  (`app/app/workspace/page.tsx`) hardcoded "Conditions Translator assists with transcription..."
  — the one real user-facing occurrence of the old product name left in `app/`/`components/`.
  A prior naive single-line `grep` for the exact phrase had missed it because the phrase was
  wrapped across two source lines in JSX; a corrected whitespace-tolerant search caught it and
  confirmed it as the only remaining instance. Fixed by importing `APP_NAME` from
  `lib/constants.ts` (already the app's existing pattern — used the same way in
  `app/app/start/page.tsx` and `components/landing/FooterCTA.tsx`) and interpolating
  `{APP_NAME}` in place of the literal text, rather than hardcoding "Verity" directly. Caught and
  fixed one self-introduced regression during manual verification: JSX trims the newline between
  a `{expression}` and immediately-following text on the next source line to nothing (not a
  single space, unlike plain wrapped static text), which rendered as "Verityassists" with no
  space — fixed with an explicit `{" "}`. Validated: `tsc --noEmit` clean; `npm run lint`
  unchanged at the pre-existing 24-error/6-warning baseline; full `npm test` 301/301 unaffected;
  manually confirmed via a throwaway (not committed) live-DB Playwright screenshot that the
  banner now reads "...before accepting it. Verity assists with transcription..." with correct
  spacing. No other `app/`/`components/` files needed changes — `app/app/start/page.tsx` and
  `app/layout.tsx` already used `{APP_NAME}`/"Verity" correctly.

- **Badge text centering (2026-07-22, branch `fix/badge-text-centering`, not yet merged).**
  On narrow mobile widths, a page's status `Badge` (e.g. "Ready to accept" in
  `app/app/workspace/page.tsx`'s page list) wraps its label onto two lines. `components/ui/
  Badge.tsx`'s base styles were `inline-flex items-center` only — `items-center` centers the
  cross-axis (vertical) alignment, but with no `text-align` set, wrapped multi-line text defaults
  to left-aligned, so a shorter second line (e.g. "accept" under "Ready to") sat flush-left
  instead of centered under the line above, reading as off-center within the rounded pill. Fixed
  by adding `text-center` to the component's `baseStyles`. Component-level, one-line change —
  every single-line `Badge` usage in the app is visually unaffected (their pill width already
  matches content width, so left- vs. center-alignment is indistinguishable for one line); only
  labels that wrap gain correct centering. Validated: `tsc --noEmit` clean; `npm run lint`
  unchanged at the pre-existing 24-error/6-warning baseline; full `npm test` 301/301 unaffected.
  Manually verified via a throwaway (not committed) live-DB Playwright screenshot at 375px width,
  seeding a real OCR-complete page so "Ready to accept" genuinely wraps — confirmed both lines
  now sit centered in the pill.

- **Shared-nav sign-out (2026-07-22, branch `feat/shared-nav-signout`, not yet merged).**
  Follow-up to a check-only audit (same day) that found sign-out was implemented twice,
  page-locally (`AccountActionsBar` in `app/app/dashboard/page.tsx`, an inline button in
  `app/app/workspace/page.tsx`), and never added to the shared nav shell
  (`components/layout/AppNav.tsx`) — so it was unreachable from Chat, from Dashboard's
  loading/error states, and absent from the mobile hamburger menu entirely (the user's original
  report). Fixed by moving sign-out into `AppNav.tsx` itself: a new `userId` state (fetched
  once via `/api/session/status`, mirroring the existing `finishedDocuments` fetch pattern)
  gates a "Sign out" control rendered in both the desktop sidebar (bottom, below the nav/document
  list, respecting the collapsed/expanded width) and the mobile hamburger dropdown (below the
  Documents section), each wired to the existing `signOut()` action
  (`lib/actions/auth.ts`) followed by `router.push("/")` — the same pattern the page-level copies
  already used. Because `AppNav` wraps every `/app/*` route uniformly, sign-out is now
  automatically reachable from Chat and from Dashboard's loading/error states too, with no
  page-specific wiring needed. Removed the duplicated page-level sign-out UI:
  `dashboard/page.tsx`'s `AccountActionsBar` was narrowed to a single-purpose
  `DeleteAccountButton` (the delete-account action is dashboard-specific and out of this fix's
  scope, so it stays on the page); `workspace/page.tsx`'s inline sign-out button was removed
  while keeping its "Saved to your account" badge and the signed-out "Log in"/"Save workspace"
  links untouched. Validated: `tsc --noEmit` clean; `npm run lint` unchanged at the pre-existing
  24-error/6-warning baseline; full `npm test` 301/301 unaffected. Manually verified via
  throwaway (not committed) live-DB Playwright scripts covering: desktop-sidebar and
  mobile-hamburger sign-out both actually sign a real signed-in test user out and redirect to
  `/`; Chat and a forced Dashboard error state both still show "Sign out" via the shared nav;
  a temporary (signed-out) session shows no sign-out control anywhere in the nav, mobile or
  desktop; and the Workspace/Dashboard pages render with no leftover spacing gaps where the
  removed controls used to sit — all screenshot-confirmed.

- **In-thread chat "thinking" bubble (2026-07-22, branch `feat/chat-thinking-bubble`, not yet
  merged).** After sending a chat message, the only pending-state feedback was the Send
  button's spinner (`isLoading={isSending}`) — the message log itself (`app/app/chat/page.tsx`'s
  `role="log"` `Card`) only ever rendered from the `messages` array, with no rendering tied to
  `isSending`, so the log stayed static until the real reply landed. Fixed by rendering a small
  assistant-side bubble (three staggered `animate-bounce` dots, styled identically to a real
  assistant message bubble, plus an `sr-only` "Assistant is thinking…" label) directly inside the
  message log whenever `isSending` is true, and adding `isSending` to the log's existing
  auto-scroll effect's dependency array so the bubble scrolls into view immediately on send. The
  existing Send-button spinner was left in place (both together read as consistent double
  feedback, not redundant). No new shared component — the bubble is inline JSX local to this one
  screen. Validated: `tsc --noEmit` clean; `npm run lint` unchanged at the pre-existing
  24-error/6-warning baseline; full `npm test` 301/301 unaffected (no existing test targets this
  file's rendering). Manually verified via a throwaway (not committed) live-DB Playwright script
  that delayed then failed the real `sendMessage` server action's request: the three-dot bubble
  appeared correctly alongside the optimistic user message while pending, and cleared correctly
  once the request failed and the existing rollback/error-alert behavior took over — screenshot-
  confirmed both states. No automated regression test added (not requested; would mean either a
  new live-DB Playwright spec purely for this small UI addition, or intercepting the server
  action's request shape long-term, judged out of scope for a surgical fix).

- **Pointer-cursor gaps on custom clickable backdrops (2026-07-21, branch
  `fix/mobile-pointer-cursor-gaps`, not yet merged).** Follow-up to a check-only audit (same
  day) of the sitewide `@media (any-pointer: fine)` pointer-cursor rule in `app/globals.css`.
  That rule's `[onclick]` selector only matches a literal HTML `onclick="..."` attribute — it
  never matches React's `onClick` prop, since React doesn't render one to the DOM (confirmed:
  zero literal `onclick=` attributes exist anywhere in the codebase). As a result, ~6 real
  full-screen backdrop `<div>`s with real `onClick` dismiss handlers (modal/popover/mobile-nav
  overlays) had no pointer affordance on hover. Fixed by adding the rule's existing
  `.cursor-pointer` escape-hatch class directly to each: the delete-page and expanded-image
  modal backdrops and the file-upload dropzone label check in
  `app/app/workspace/page.tsx` (the dropzone label already had `.cursor-pointer` — confirmed,
  not changed), and the mobile hamburger-menu backdrop, delete-document modal backdrop, actions
  popover backdrop, and document-actions bottom-sheet backdrop in
  `components/layout/AppNav.tsx`. `role="button"` was deliberately not added — these are
  dismiss-on-click-outside backdrops, not semantic buttons, so a class-only visual fix keeps the
  change purely cosmetic. The global rule in `app/globals.css` itself was left unchanged (no
  cleanup was needed). Validated: `tsc --noEmit` clean; `npm run lint` unchanged at the
  pre-existing 24-error/6-warning baseline; verified via Playwright — a computed-style check
  confirmed each patched class string resolves to `cursor: pointer`, and a live interaction test
  (privacy-gate accept -> workspace -> open the mobile hamburger menu) confirmed the real
  rendered backdrop reports `cursor: pointer`. No automated regression test added (styling-only
  class additions, no new logic).

- **Mobile footer/CTA overflow (2026-07-21, branch `fix/mobile-footer-cta-overflow`, not yet
  merged).** On mobile widths, the sticky footer/CTA bar's (`components/landing/FooterCTA.tsx`)
  "get started" button rendered at its intrinsic content width instead of shrinking to the
  available row width, overflowing past the right edge of the viewport — visually the button
  text was clipped (e.g. "Add your first document" cut off to "d your first document").
  Confirmed via before/after Playwright screenshots at 320/375/390px. Fixed by giving the CTA
  row's vertical gap `gap-3` -> `gap-4` (more breathing room between the links row and the CTA
  on mobile; desktop unaffected, already overridden by the existing `sm:gap-4`) and adding
  `w-full sm:w-auto` to the `GetStartedCTA`'s className so the button fills the row's width on
  mobile only, reverting to its normal auto width at the `sm` breakpoint and up. No changes to
  `GetStartedCTA`/`Button` components themselves — both already supported the needed props.
  Validated: `tsc --noEmit` clean; `npm run lint` unchanged at the pre-existing 24-error/6-warning
  baseline (unrelated files); manually verified via Playwright screenshots at 320px/375px/390px
  that the button no longer overflows and fills the row width correctly. No automated regression
  test added (styling-only Tailwind change, no behavior/logic to assert against).

- **Workspace upload queue (2026-07-21, branch `fix/workspace-upload-queue`, not yet merged).**
  `handleFileUpload` (`app/app/workspace/page.tsx`) previously disabled the page-image file
  input for the entire duration of a batch's upload+OCR cycle, so users could not select more
  photos while earlier ones were still being OCR-processed (OCR runs synchronously server-side
  in `app/api/documents/[documentId]/pages/[pageId]/ocr/route.ts`). Fixed with a client-side
  queue: newly selected files enqueue and the handler returns immediately; a single serial
  worker (`drainUploadQueue`) still sends exactly one upload/OCR request pair to the server at a
  time, since page `order` is assigned server-side from the current page count
  (`prisma/schema.prisma`'s `@@unique([documentId, order])`) and concurrent requests could
  otherwise collide. The input is now only disabled while creating a brand-new intake document,
  not while the queue drains. The 10-page cap check now also accounts for files already queued
  (but not yet uploaded) for the same document, not just the committed page count, with a
  per-item `uploaded` flag to avoid double-counting an item whose upload already landed while its
  OCR is still pending. No server-side, schema, or ownership changes.

  Regression coverage: `tests/e2e/workspace-upload-queue.pw.ts` (new, live-DB Playwright) —
  the picker stays enabled and a second file queues while the first is still OCR-processing with
  no overlapping upload/OCR requests; the 10-page cap correctly rejects a selection that would
  overflow once already-queued-but-unsaved files are counted. Both upload endpoints are
  intercepted with fake responses, so no real Blob storage or billed OpenAI call is involved.
  Validated: `tsc --noEmit` clean; `npm run lint` at the pre-existing 24-error baseline
  (unrelated file); full `npm test` 301/301; `npx playwright test` 10/10 (both projects,
  including the 2 new specs).

- **Signed-in "start/add new document" fix (2026-07-21, branch
  `fix/signed-in-new-document`, merged to `main` via PR #39).** `createTemporaryDocument`
  (`lib/actions/document.ts`) previously resolved ownership only via `getTemporarySession()`,
  so a signed-in user could never create a document — the workspace UI (`app/app/workspace/page.tsx`)
  papered over this with a disabled upload control and the message "Starting a new document
  isn't available for signed-in accounts yet." Root cause fixed by resolving ownership through
  `getCurrentOwner()` (the same precedence used by every other owner-aware action) and passing
  the resolved `isAuthenticated` state into `isPrivacyAccepted()`. Also fixed workspace
  initialization so a signed-in user with zero documents no longer lands on the dead-end
  "Unable to load workspace" state — an intake document is now auto-created for both owner
  kinds, not just guests. The signed-in-only UI bailouts (`newDocumentUploadDisabled` and two
  early-return guards) were removed since the action now supports both owner kinds directly.
  Regression coverage: `tests/lib/actions/document.test.ts` (signed-in creation path, privacy-flag
  pass-through) and a new live-DB Playwright spec `tests/e2e/signed-in-new-document.pw.ts`
  (zero-document signed-in init, and starting a second document after one is already finished).

- **Chat legal-disclaimer UX + prompt de-repetition (2026-07-21, branch
  `feat/chat-legal-disclaimer`, merged to `main` via PR #38).** The chat system prompt
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

- **Mobile chat layout overflow (2026-07-21, branch `fix/mobile-chat-scroll-overflow`, merged to
  `main` via PR #37).** On mobile, a long assistant response in `/app/chat` grew past the viewport instead of
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
