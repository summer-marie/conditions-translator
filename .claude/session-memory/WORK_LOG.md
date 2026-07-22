# Work Log

## 2026-07-22 (Conditions Translator -> Verity rename, last remaining string)

- User requested a full audit of "Conditions Translator" -> "Verity" rename status. First-pass
  grep for the literal phrase across `app/`/`components/` found zero hits, and I incorrectly
  concluded no changes were needed. User asked for a stricter re-audit; re-checked
  `app/app/workspace/page.tsx`, `app/app/start/page.tsx`, `app/layout.tsx` directly and found the
  workspace banner's "Conditions Translator assists with transcription..." text was wrapped
  across two JSX source lines — a single-line-only grep pattern couldn't match across the
  newline, even though the rendered text is one contiguous phrase (JSX collapses the wrap to a
  space at render time). A whitespace-tolerant (`Conditions\s+Translator`, multiline) search
  confirmed this was the only real remaining occurrence in `app/`/`components/`.
  **Takeaway**: default single-line grep patterns can miss real user-facing hits when JSX text
  wraps across source lines — use a whitespace-tolerant/multiline pattern for prose-string
  audits, not just an exact-phrase grep.
- User approved implementing the fix, explicitly said to stay on the current branch
  (`fix/badge-text-centering`) rather than opening a new one for this unrelated rename fix —
  a deviation from CLAUDE.md's default one-branch-per-fix rule, done on direct instruction.
- `app/app/workspace/page.tsx`: added `APP_NAME` to the `@/lib/constants` import; replaced the
  literal text with `{APP_NAME}` interpolation (matching `start/page.tsx`'s and
  `FooterCTA.tsx`'s existing pattern, not a hardcoded "Verity" string).
- Caught own regression during manual verification: `{APP_NAME}` immediately followed by text on
  the next JSX source line rendered "Verityassists" — no space. Root cause: JSX only preserves a
  single space for wrapped *plain static text* across a line break; when one side of the break is
  an `{expression}` container, the adjacent newline+indentation is trimmed to literally nothing.
  Fixed with an explicit `{" "}` right after `{APP_NAME}`.
- Validated: `tsc --noEmit` clean, `npm run lint` unchanged at the 24-error/6-warning baseline,
  `npm test` 301/301. Manual: throwaway (not committed) live-DB Playwright script asserted the
  banner's real `textContent` reads correctly spaced, screenshot-confirmed too; deleted the temp
  test and `test-results/` output afterward.
- Updated `PROJECT_STATUS.md`'s "Recent Fixes" section with this entry.

## 2026-07-22 (badge text centering)

- User shared a screenshot of the mobile workspace page: the "Ready to accept" status badge
  wraps to two lines and the second line ("accept") sits flush-left instead of centered in the
  pill. Asked for a surgical fix.
- Read `components/ui/Badge.tsx`: `baseStyles = "inline-flex items-center px-2.5 py-0.5
  rounded-full font-medium"` — `items-center` is cross-axis (vertical) only; no `text-align` set
  anywhere, so wrapped multi-line text defaults to left. Traced the label itself to
  `statusLabel()` in `app/app/workspace/page.tsx` (`"Ready to accept"` for a non-blocking
  `OCR_COMPLETE` page), rendered via a plain `<Badge>` with no explicit className — confirmed via
  grep that no other `Badge` call site anywhere passes an explicit width class either, so a
  component-level fix is safe and won't visibly affect any single-line usage.
- Created branch `fix/badge-text-centering` off `main`.
- Fix: added `text-center` to `Badge.tsx`'s `baseStyles`. One line.
- Validated: `tsc --noEmit` clean, `npm run lint` unchanged at the 24-error/6-warning baseline,
  `npm test` 301/301.
- Manual verification: needed a real page in `OCR_COMPLETE` status with non-blocking quality
  warnings to genuinely reproduce the "Ready to accept" wrap (not just guess from code), so wrote
  a throwaway (not committed) live-DB Playwright script seeding `TemporarySession` +
  `noticeAcceptedAt` (privacy gate) + `Document` + `Page` (`OCR_COMPLETE`) + `OcrResult` (`warnings:
  {blurry:false, cutOff:false, unreadable:false}`, long enough `extractedText`), screenshotted the
  workspace page list at 375px. First attempt hung on the `/app/start` privacy gate — fixed by
  also setting `noticeAcceptedAt` on the seeded session (same pattern needed as `tmp_session`
  cookie tests always need care about which gates are pre-satisfied). Confirmed both wrapped
  lines now render centered in the pill. Deleted the temp test file and `test-results/` output
  after use.
- Updated `PROJECT_STATUS.md`'s "Recent Fixes" section with this entry.

## 2026-07-22 (shared-nav sign-out, follow-up to check-only audit)

- Earlier in this conversation (check-only, no code): user reported no way to sign out on
  mobile — no logo/dropdown affordance. Audited `components/layout/AppNav.tsx` (mobile
  hamburger, top bar, bottom tab bar, desktop sidebar), `app/app/dashboard/page.tsx`, and
  `app/app/workspace/page.tsx`. Found sign-out worked wherever rendered but was never added to
  the shared nav shell — it existed only inline in Dashboard's `AccountActionsBar` and
  Workspace's inline button, both gated on `savedUserId`/loaded page state, so it was
  unreachable from Chat and from Dashboard's loading/error states. Reported findings; no code
  changed.
- This session: user approved a surgical fix — move sign-out into `AppNav.tsx`, gate to
  signed-in users, remove the page-level duplicates, keep the existing `signOut()` action and
  keep `deleteAccountAction` untouched (out of scope).
- Created branch `feat/shared-nav-signout` off `main`.
- `components/layout/AppNav.tsx`: added `userId`/`isSigningOut` state, a new effect fetching
  `/api/session/status` (same guard/cleanup pattern as the existing `finishedDocuments` effect),
  `handleSignOut` (`signOut()` then `router.push("/")`), a new `SignOutIcon`. Rendered the
  control in the desktop sidebar (new bottom section inside `<aside>`, collapse-aware) and the
  mobile hamburger dropdown (new bordered-top section below Documents), both gated on `userId`.
  Updated the file's top-of-file and `AppNavContent` docstrings to mention it now owns sign-out.
- `app/app/dashboard/page.tsx`: removed `signOut` import, `isSigningOut` state, `handleSignOut`,
  and the entirely-unused `useRouter`/`router` (its only call site was the removed handler;
  confirmed via grep that delete-account uses `window.location.href` instead). Renamed/narrowed
  `AccountActionsBar` to `DeleteAccountButton` (single button, `onClick` prop only) since
  account deletion stays on this page — explicitly out of scope to touch. Updated both call
  sites (empty state, main state) and the function-level docstring.
- `app/app/workspace/page.tsx`: removed `signOut` import, `isSigningOut` state, `handleSignOut`.
  Simplified the `savedUserId ? (...) : (...)` block to drop just the inline sign-out button,
  keeping the "Saved to your account" `Badge` and the signed-out "Log in"/"Save workspace" links
  exactly as they were.
- Validated: `tsc --noEmit` clean, `npm run lint` unchanged at the 24-error/6-warning baseline,
  `npm test` 301/301.
- Manual verification needed a real signed-in user (not just a temporary session), so wrote
  throwaway (not committed) live-DB Playwright scripts reusing the `signInAs` pattern from
  `tests/e2e/chat-disclaimer.desktop.pw.ts` (seed a `User` + `AuthSession` row directly via
  Prisma, attach the `auth_session` cookie). Hit one real gotcha: the sidebar, mobile hamburger,
  and mobile bottom-tab-bar `<nav>` elements all share the literal `aria-label="Main
  navigation"`, so `getByRole("navigation", {name: "Main navigation"})` is ambiguous whenever
  more than one is simultaneously in the accessibility tree (e.g. hamburger open on mobile) —
  fixed by scoping via `#mobile-nav-menu` / `getByRole("complementary")` (the `<aside>`'s
  implicit landmark role) instead. Confirmed: desktop sidebar and mobile hamburger sign-out both
  actually redirect to `/`; Chat and a forced Dashboard error state (mocked `/api/documents` to
  500) both still show "Sign out" via the shared nav; a temporary session shows zero "Sign out"
  matches anywhere; Workspace/Dashboard render with no leftover spacing where the removed
  controls used to sit (screenshot-confirmed for all of the above). Deleted the temp test files
  and `test-results/` output after use.
- Updated `PROJECT_STATUS.md`'s "Recent Fixes" section with this entry.

## 2026-07-22 (chat in-thread thinking bubble)

- Task: after sending a chat message, the log itself stayed static (only the Send button's own
  spinner gave feedback) until the real reply arrived — user wanted a small in-thread
  loading/thinking bubble so the conversation feels alive while waiting.
- Read `app/app/chat/page.tsx` fully (only file genuinely in scope — message list/composer all
  live in this one client component; no separate message-item component exists to touch).
  Confirmed root cause: `isSending` drove only the Send button's `isLoading` prop; the
  `role="log"` `Card` rendered purely from `messages`, with nothing keyed to `isSending`.
- Created branch `feat/chat-thinking-bubble` off `main`.
- Added an `isSending`-gated bubble block right before the `messagesEndRef` sentinel: styled
  identically to a real ASSISTANT bubble (`rounded-bl-md`, `--color-background-subtle` /
  `--color-text-body`), containing three `animate-bounce` dots (staggered 0/150/300ms delays)
  plus an `sr-only` "Assistant is thinking…" label (dots marked `aria-hidden`). Reused Tailwind's
  built-in `animate-bounce`, no new CSS.
- Added `isSending` to the existing scroll-into-view `useEffect`'s deps (was `[messages]` only)
  so the bubble is scrolled into view the instant it appears.
- Kept the Send button's spinner as-is — both together are intentional double feedback, not
  redundant, per the task's explicit instruction.
- Checked `tests/` for any existing test targeting `chat/page.tsx` rendering: none (no
  jsdom/component-render harness in this repo, matching prior sessions' notes). `npm test`
  301/301 unaffected.
- Manual verification: needed a live chat session without triggering a real, billed OpenAI call.
  Tried a standalone Prisma-seeding Node script first — failed, since this project's Prisma
  client is generated as TypeScript-only (`generated/prisma`, `provider = "prisma-client"`, no
  compiled `.js`/no `tsx`/`ts-node` devDependency available to run it standalone). Pivoted to
  writing a temporary `tests/e2e/tmp-chat-bubble-check.pw.ts` (same live-DB seeding pattern as
  `mobile-chat-overflow.pw.ts`, run via the project's existing `npx playwright test`, which
  already has working TS support) — started a real chat session through the real UI, then
  registered a `page.route()` intercept *after* Start Chat completed (registering it earlier
  ended up also delaying/aborting the `startChat` action's own POST to the same route, since
  both server actions post to the same page URL — first attempt broke "Start chat" itself; fixed
  by moving the intercept registration to after the composer became visible), delayed 2.5s then
  aborted the `sendMessage` action's request. Screenshot-confirmed the three-dot bubble appears
  correctly alongside the optimistic user message and the Send spinner while pending, and clears
  correctly (0 count) once the request fails, with the pre-existing rollback/error-alert flow
  taking over unaffected (shown as "Failed to fetch" from the aborted fetch, not a custom
  message — expected, not a bug). Deleted the temp test file and `test-results/` output after
  use; not committed.
- Updated `PROJECT_STATUS.md`'s "Recent Fixes" section with this entry.
- Final validation: `tsc --noEmit` clean, `npm run lint` unchanged at the 24-error/6-warning
  baseline, `npm test` 301/301.

## 2026-07-21 (pointer-cursor gap fix, follow-up to check-only audit)

- Earlier in this conversation (check-only, no code): audited `app/globals.css`'s sitewide
  `@media (any-pointer: fine)` pointer-cursor rule. Found it's real and comprehensive
  (`a[href]`, `button`, native form-control types, `summary`, `label[for]`, `select`,
  `[role="button"/"link"]`, focusable `[tabindex]`, `[onclick]`, `.cursor-pointer` escape
  hatch), but two real gaps: (1) `[onclick]` never matches React's `onClick` prop (confirmed via
  repo-wide grep: zero literal `onclick=` attributes exist), so it's effectively dead code; (2)
  ~6 real backdrop `<div>`s with genuine `onClick` dismiss handlers had no pointer affordance
  since they use none of the rule's other selectors. Reported findings, no code changed.
- This session: user approved a surgical fix, explicitly scoped to only the audited gaps, no
  global-rule redesign, prefer `.cursor-pointer` over adding `role="button"` for backdrops.
- Created branch `fix/mobile-pointer-cursor-gaps` off `main`.
- Patched `app/app/workspace/page.tsx`: delete-page modal backdrop
  (`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4` -> added
  `cursor-pointer`), expanded-image modal backdrop (same pattern, `bg-black/75`). Checked the
  file-upload dropzone `<label>` (implicit-association, no `htmlFor`) — already had
  `.cursor-pointer` from before this session; confirmed correct, no change needed.
- Patched `components/layout/AppNav.tsx`: mobile hamburger-menu backdrop, delete-document modal
  backdrop, document-actions popover backdrop, document-actions bottom-sheet backdrop — added
  `cursor-pointer` to each's existing className.
- Left `app/globals.css` and the modal-content `stopPropagation` divs untouched, per scope.
- Validated: `tsc --noEmit` clean, `npm run lint` unchanged at the 24-error/6-warning baseline.
  Started `next dev`; found the previous session's dev server (port 3000) had been left running
  as an orphaned background process (its tracked task ID no longer resolved) — stopped it after
  reusing it for verification via `Stop-Process`. Two throwaway Playwright scripts (not
  committed, copied into the project root as `.cjs` temporarily to resolve `@playwright/test`
  then deleted): a computed-style check against the real bundled CSS for all 5 patched class
  strings (all resolved `cursor: pointer`), and a live click-through (`/app/start` accept ->
  `/app/workspace` -> open mobile hamburger menu) confirming the real rendered backdrop reports
  `cursor: pointer`, screenshot-verified.
- Updated `PROJECT_STATUS.md`'s "Recent Fixes" section with this entry.

## 2026-07-21 (mobile footer/CTA overflow fix)

- Task described a squeezed/cramped mobile footer "shown in the screenshot" — no image was
  actually attached to the conversation. Proceeded from code inspection instead of asking,
  since the description was specific enough to locate a real, verifiable bug.
- Read `components/landing/FooterCTA.tsx` (renders footer links + `GetStartedCTA` in a fixed
  bottom bar, `flex-col` on mobile / `flex-row` on `sm:+`), `components/landing/GetStartedCTA.tsx`,
  and `components/ui/Button.tsx` to confirm both already support a `className`/`fullWidth` seam
  without needing component changes.
- Started `next dev` and wrote a throwaway (not committed) Playwright script to screenshot the
  fixed-position footer bar at 320/375/390px after scrolling to trigger its mobile
  slide-in (`IntersectionObserver`-driven `nearBottom` state).
- Found the real root cause empirically: `git stash`'d the fix to screenshot the *original*
  code, which showed the CTA button clipped/overflowing past the right edge of the viewport
  ("Add your first document" cut to "d your first document") — not just tight spacing as
  initially guessed from the code alone. `git stash pop` restored the fix afterward.
- Fix: `components/landing/FooterCTA.tsx` — bar container's `gap-3` -> `gap-4` (mobile-only
  effective change; `sm:gap-4` already existed for desktop) and `GetStartedCTA`'s className
  `"shrink-0"` -> `"w-full shrink-0 sm:w-auto"` so the button is full-width only below the `sm`
  breakpoint.
- Re-screenshotted after restoring the fix: confirmed no overflow/clipping at all three widths.
- Validated: `tsc --noEmit` clean; `npm run lint` unchanged at the pre-existing
  24-error/6-warning baseline (unrelated files). No new automated test — pure Tailwind
  class change, no new logic branch.
- Updated `PROJECT_STATUS.md`'s "Recent Fixes" section with this entry.
- Created branch `fix/mobile-footer-cta-overflow` off `main`. Not yet committed/pushed —
  committing next per CLAUDE.md's staging/commit discipline.

## 2026-07-21 (workspace upload queue fix)

- Audit pass (no code, earlier in this same conversation): user reported being unable to
  upload additional photos/pages while other uploaded pages were still being OCR-processed.
  Traced to `app/app/workspace/page.tsx`'s `handleFileUpload`: it awaited a `for` loop that
  uploaded each file then awaited `runOcrForPage` before the next, and `isUploading` (true for
  the whole loop) disabled the file input. OCR runs synchronously server-side (a real OpenAI
  Vision call inside `app/api/documents/[documentId]/pages/[pageId]/ocr/route.ts`, no job
  queue). Confirmed UI-only — no docs described this as intentional, no test covered it.
  Flagged one real server-side constraint: `Page.order` is assigned from a `prisma.page.count()`
  read at request time, unique per `(documentId, order)` — so uploads must stay strictly serial
  per document to avoid a collision. Reported root cause, files involved, complexity (small),
  and recommended "queue uploads visibly but process serially" over true parallel uploads.
- User approved "Implement Option 2" with explicit scope: client-side queue, strictly serial
  upload+OCR processing, no server/schema/architecture changes.
- Created branch `fix/workspace-upload-queue` off `main`.
- `app/app/workspace/page.tsx`: added `uploadQueueRef` (ref-backed FIFO of
  `{file, targetId, uploaded}`) and `drainUploadQueue` (serial worker: upload then OCR per
  item, one at a time). `handleFileUpload` now enqueues and returns instead of awaiting the
  whole cycle. File input `disabled` changed from `isUploading` to `isCreating` (the one
  remaining real race — creating a brand-new intake document). Added `viewedDocumentIdRef`
  (synced via a new `useEffect`) so a queued upload finishing after the user navigates to a
  different document via the sidenav doesn't append into the wrong document's `pages` state.
  10-page cap check now factors in queued files, not just committed `pageCount`.
- While writing the Playwright regression test, found and fixed a real double-counting bug in
  the cap check: a queue item whose `POST .../pages` already succeeded (only its OCR still
  pending) was being counted both via the now-incremented `pageCount` *and* via the queue
  filter (only fully dequeued after OCR too finishes) — over-rejecting batches that actually
  still fit. Fixed by adding a per-item `uploaded` flag, flipped true right after the upload
  call succeeds, and excluding `uploaded` items from the queued-count used in the cap check.
  See DECISIONS.md.
- Added `tests/e2e/workspace-upload-queue.pw.ts` (2 tests, live-DB Playwright). Both `POST
  .../pages` and `POST .../pages/[pageId]/ocr` are intercepted via `page.route()` with fake
  JSON (no real Blob storage or billed OpenAI call). Test 1 (fresh doc): picker stays enabled
  and a second file queues while the first's mocked OCR is artificially delayed 1.2s; asserts
  no overlapping requests to either endpoint (proves the order-collision-safety by
  construction) and both pages land in order. Test 2 (8 pre-seeded pages): selects 2 files at
  once (fills to exactly 10), then immediately a 3rd while the first of the two is still
  mid-upload (pages-POST mocked with an 800ms delay) — correctly rejected because both queued
  files count even though committed `pageCount` hasn't moved yet; this is the exact scenario
  that caught the double-counting bug above during development.
- Debugging notes worth keeping (also in CURRENT_SESSION.md): the upload box hides itself
  entirely once `pageCount` actually reaches 10 while `IN_PROGRESS` (pre-existing, unrelated
  logic) — so the cap test had to stay below that ceiling (8+2+1, not 9+1+1) or the input
  would vanish before the second selection. `getByText("Page N")` needed `{exact:true}` since
  it otherwise substring-matches the same page's closed-but-DOM-present transcript dialog
  heading ("Page N transcript"). An early version of the OCR mock hardcoded `order: 0` in its
  response, which silently overwrote the real page order client-side (the response gets
  spread into existing page state) and caused a confusing "Page 1" appearing twice instead of
  "Page 9"/"Page 10" — fixed by parsing the order back out of the mock's own `pageId`.
- Updated `PROJECT_STATUS.md`: added this fix's entry, and while there, found and corrected 3
  other entries stale relative to `git log` — `fix/signed-in-new-document` (merged PR #39),
  `feat/chat-legal-disclaimer` (merged PR #38), `fix/mobile-chat-scroll-overflow` (merged PR
  #37) were all still marked "not yet merged."
- Final validation: `tsc --noEmit` clean, `npm run lint` unchanged at the pre-existing
  24-error/6-warning baseline, `npm test` 301/301 (no vitest changes — no component-render
  harness exists in this repo), `npx playwright test` 10/10 across both projects (8
  pre-existing + 2 new).
- Committed as 3 commits: `fix:` (page.tsx), `test:` (new Playwright spec), `docs:`
  (PROJECT_STATUS.md). Not pushed; branch `fix/workspace-upload-queue` ready for the user to
  review/push/merge per CLAUDE.md's git workflow rules.

## 2026-07-21 (signed-in "start new document" fix)

- Audit pass (no code): user reported that on mobile, a signed-in account trying to
  add/start a new document got told it "isn't available for signed-in accounts yet." Traced
  the message to `app/app/workspace/page.tsx`'s `newDocumentUploadDisabled` guard, which was
  masking a real gap in `lib/actions/document.ts`'s `createTemporaryDocument`: it resolved
  ownership only via `getTemporarySession()`, never `getCurrentOwner()`, so a signed-in user
  always hit `NO_ACTIVE_SESSION`. Confirmed via `PROJECT_STATUS.md`, `OPEN_QUESTIONS.md`, and
  `WORK_LOG.md` that this was already a known, tracked limitation (not a regression or
  feature flag) — the UI-side gap-masking was the unfinished part. Also found a second,
  worse dead end: a brand-new signed-in account with zero documents never got an
  auto-created intake document (`initializeWorkspace`'s `else if (!status.userId)` branch
  excluded signed-in users), so it fell through to a separate "Unable to load workspace"
  state. Reported both, plus the smallest safe fix (resolve via `getCurrentOwner()`, the
  same precedence every other action in the file already uses), and got approval.
- Created branch `fix/signed-in-new-document` off `main` (after `feat/chat-legal-disclaimer`
  merged via PR #38, commit `8429dee`).
- `lib/actions/document.ts`: rewrote `createTemporaryDocument` to resolve `getCurrentOwner()`
  once, branch on `owner.kind` (`"user"` -> `createOwnedDocument(owner, { title })`, no
  expiry; `"temporary"` -> same as before with a computed `expiresAt`), and pass
  `owner?.kind === "user"` into `isPrivacyAccepted()` so a signed-in caller's already-accepted
  status is honored instead of being checked against a nonexistent temporary session. Dropped
  the now-unused `temporaryOwner`/`getTemporarySession` imports.
- `app/app/workspace/page.tsx`: removed the three signed-in-only bailouts —
  `initializeWorkspace`'s `else if (!status.userId)` (now just `else`, so a zero-document
  signed-in user also gets an auto-created intake document), `handleFileUpload`'s
  `if (savedUserId) { return; }` early exit, and the `newDocumentUploadDisabled` flag plus
  its three render-time usages (disabled input, disabled cursor/hover styling, and the
  "isn't available for signed-in accounts yet" caption).
- Tests: rewrote the `createTemporaryDocument` describe block in
  `tests/lib/actions/document.test.ts` to mock `getCurrentOwner` instead of
  `getTemporarySession`/`temporaryOwner`, added a dedicated signed-in-creation test and a
  privacy-flag pass-through assertion (`isPrivacyAccepted` called with `true`/`false`
  matching owner kind). Added `tests/e2e/signed-in-new-document.pw.ts` (live-DB Playwright,
  mirrors the `chat-disclaimer.desktop.pw.ts` sign-in pattern): a zero-document signed-in
  user reaches a usable workspace instead of "Unable to load workspace," and a signed-in
  user with one existing READY document can start a second one (upload control enabled, old
  message absent).
- Updated `PROJECT_STATUS.md` ("Recent Fixes" entry added, the matching "Known Limitations"
  bullet removed) and `OPEN_QUESTIONS.md` (moved the item to RESOLVED).
- Final validation: `tsc --noEmit` clean, `npm run lint` unchanged at the 24-error/7-warning
  baseline, `npm test` 301/301 (was 300/300 before this session), `npx playwright test` 8/8
  passing (both projects, including the 2 new specs).

## 2026-07-21 (chat legal-disclaimer)

- Audit pass (no code): read CLAUDE.md, docs 01/02/05/06/08/09/10, and traced the actual chat
  code (`lib/chat/prompt.ts`, `lib/chat/client.ts`, `app/app/chat/page.tsx`) plus the existing
  Privacy Notice gate (`components/landing/PrivacyGateModal.tsx`, `lib/session/temporary.ts`,
  `lib/actions/privacy.ts`) to find the actual root cause and reusable patterns. Reported
  findings and asked two clarifying questions (disclaimer scope vs. Privacy Notice; mobile
  popup shape) before implementing.
- User approved with 3 decisions: separate chat-specific disclaimer, compact focus-trapped
  bottom sheet on mobile, server-side enforcement required (not UI-only).
- Created branch `feat/chat-legal-disclaimer`. Baseline before changes: `tsc` clean, 282/282
  vitest, lint at the known 24-error/7-warning baseline.
- Schema: added `User.chatDisclaimerAcknowledgedAt` and
  `TemporarySession.chatDisclaimerAcknowledgedAt` (migration
  `20260721224749_add_chat_disclaimer_acknowledgment`, applied to the live dev Neon DB via
  `npx prisma migrate dev`), regenerated the Prisma client.
- Added `lib/session/chatDisclaimer.ts` (isAcknowledged/acknowledge/require helpers) and
  `lib/actions/chatDisclaimer.ts` (Server Action), mirroring the existing
  `lib/session/temporary.ts`/`lib/actions/privacy.ts` pattern but kept as a fully separate
  module/flag per the confirmed decision.
- Extended `/api/session/status` with `chatDisclaimerAcknowledged`, resolved independently for
  a signed-in user vs. a temporary session.
- Added server-side enforcement: `lib/chat/session.ts`'s `createChatSession` and
  `sendChatMessage` both call `requireChatDisclaimerAcknowledged(owner)` before doing anything
  else, throwing `CHAT_DISCLAIMER_NOT_ACKNOWLEDGED` (403) — so chat entry/use is blocked
  server-side even if the client is bypassed.
- Rewrote `CHAT_SYSTEM_PROMPT`'s CORE RULES bullet 2 (the actual root cause of the "constant
  legal-advice" complaint — see CURRENT_SESSION.md) so the model stops adding a generic
  disclaimer to every answer, while leaving the four required SPECIFIC BEHAVIORS
  (permission/missing-source/conflict/violation) untouched.
- Built `components/chat/ChatDisclaimerSheet.tsx` (mobile bottom sheet, focus-trapped via the
  existing `useFocusTrap` hook, single "Got it" action, `md:hidden`) and wired both it and a
  compact desktop `Alert` banner into `app/app/chat/page.tsx`, gating Start Chat/Send
  client-side too (defense in depth, not the only gate).
- Tests added/updated: `tests/lib/session/chatDisclaimer.test.ts` (new),
  `tests/api/session/status.test.ts` (new), `tests/lib/chat/session.test.ts` (added disclaimer
  enforcement tests + mock), `tests/lib/chat/prompt.test.ts` (added a test for the
  anti-repetition instruction). 282 -> 300 passing.
- Playwright: added a `desktop-chrome` project to `playwright.config.ts`, scoped via a
  `*.desktop.pw.ts` naming convention (`testMatch`/`testIgnore`) so it doesn't affect the
  existing mobile-only spec. Added `tests/e2e/chat-disclaimer.pw.ts` (mobile sheet: appears,
  traps focus, blocks the underlying screen until acknowledged, persists per-session, and a
  genuinely new session re-prompts independently) and
  `tests/e2e/chat-disclaimer.desktop.pw.ts` (desktop banner: appears/hides, and a signed-in
  user's acknowledgment persists per-account regardless of any temporary session). All 6 new
  Playwright tests pass.
- Found and fixed one incidental regression: `tests/e2e/mobile-chat-overflow.pw.ts`'s seeded
  temporary session had never acknowledged the new disclaimer, so the new mobile sheet
  correctly started blocking it (test timed out clicking a covered checkbox). Fixed by having
  that test pre-acknowledge the disclaimer directly via Prisma right after seeding the session,
  since that test is about the mobile-overflow layout bug, not this new flow.
- Final validation: `tsc --noEmit` clean, `npm test` 300/300, `npm run lint` unchanged at the
  24-error/7-warning baseline, `npx playwright test` 6/6 passing (both projects).
- Updated `PROJECT_STATUS.md`'s "Recent Fixes" section and this session-memory set.

## 2026-07-20

- Read README.md, PROJECT_STATUS.md, AGENTS.md,
  REPOSITORY_STRUCTURE_GUIDE.md, CONTRIBUTING.md, CLAUDE.md, and all 22
  files in docs/ to orient on current project state.
- Cross-checked docs against `git log`/`git status`; found PROJECT_STATUS.md
  is stale relative to the current branch (`chore/update-node-version`) and
  found several doc-vs-doc contradictions (logged in OPEN_QUESTIONS.md).
- Confirmed via `git ls-files .claude/` that nothing under `.claude/` is
  currently tracked in git (blanket `.gitignore` rule already covers it).
- Set up `.claude/session-memory/` (CURRENT_SESSION.md, DECISIONS.md,
  OPEN_QUESTIONS.md, WORK_LOG.md) per CLAUDE.md §12.
- Set up persistent Claude memory files (project-current-state,
  project-doc-staleness-and-prd-precedent, reference-docs-map).
- No application code changes made.

- Audited env.example and .env.local against actual codebase usage (grep
  for `process.env.*` across lib/, app/, prisma.config.ts, plus manual
  trace of lib/env.ts, lib/constants.ts, lib/storage/blob.ts, the OpenAI
  client modules, and the cron cleanup route).
- Rewrote .env.local to the 10 vars actually required (values left blank
  for the user to fill in — real values were already stripped by the user
  before this pass).
- Rewrote env.example with [REQUIRED]/[OPTIONAL]/[PLATFORM] tags per var
  and removed sections/vars with zero references in the codebase (Rate
  Limiting, Logging and Diagnostics, Feature Flags, Email/Password
  Recovery, Development and Testing, plus a handful of individual unused
  vars in other sections). Full rationale in DECISIONS.md.
- Confirmed via two independent greps (background `grep -r` over the
  whole tree, and the Grep tool with node_modules excluded) that none of
  the removed vars are referenced anywhere else in the repo (tests,
  configs, workflows).
- Ran full verification before a planned push of `chore/update-node-version`:
  typecheck clean, 282/282 tests passing, build succeeds, lint has only
  the pre-existing baseline (24 errors in tests/lib/session/temporary.test.ts,
  7 warnings unrelated to this branch). No CI workflow files exist to
  reconcile Node-version pins against.
- User pushed back on OPEN_QUESTIONS.md accuracy ("i solved most of those
  already... document must be stale"). Verified directly against git log
  and current code rather than re-reading docs: confirmed
  PROJECT_STATUS.md has not been edited since commit `ae4b107`, which
  predates the actual merge of `fix/pwa-redirect-loop` (`8a0b8a2`, confirmed
  ancestor of HEAD). Found 3 outstanding items were already resolved
  (PWA-fix merge, PRD reconciliation, duplicate-label warning — the last
  one via `git log -S "hasDuplicateTitle"`, added back in Phase 8's
  `d253034`, so PROJECT_STATUS.md was already wrong about it even at last
  edit) and 2 were confirmed still genuinely open by reading current code
  (`createTemporaryDocument`, `[ocr-diag]` logging). Corrected
  OPEN_QUESTIONS.md accordingly; flagged the unverified remainder
  (OCR-doc staleness, 8 usability findings) as "not re-checked, don't
  trust without verifying directly."
- **Takeaway**: don't cite PROJECT_STATUS.md's narrative as current fact
  without a `git log`/code cross-check first — it drifts stale between
  manual updates and multiple items were wrong by the time this session
  read it.
- Branched `docs/close-out-completed-phases` off `main` (not the
  still-unpushed `chore/update-node-version`) per CLAUDE.md's
  dedicated-branch-per-documentation-change rule.
- Marked all phases in docs/08_Conditions_Translator_Implementation_Roadmap.md
  (1–10, E2E, Wireframe Implementation) **Status: Complete**, per user
  direction that the next phase isn't defined yet. Refreshed
  PROJECT_STATUS.md to match: folded the merged PWA fix into Phase 10's
  entry, retitled "Outstanding Items" to "Known Limitations and Backlog"
  (not phase-blocking), removed the 3 items already confirmed resolved
  earlier this session, added explicit "not re-verified" caveats on items
  I didn't re-check (the 8 usability findings). Committed as `ca9972b`.
- Rewrote `.gitignore` to stop ignoring `.claude/session-memory/` (per
  explicit user request to stop losing memory files across machines),
  keeping `.claude/settings.local.json` ignored. Verified with
  `git check-ignore` on 6 representative paths before committing. Caught
  and fixed my own mistake mid-edit: initially dropped the `.env*`
  catch-all as "redundant" with the named `.env.*.local` entries above
  it — it wasn't (it's what actually covers `.env.vercel`/
  `.env.vercel.pull`) — restored it as a single consolidated line.

## 2026-07-21

- Investigated a reported mobile chat bug (long assistant response grows
  past the viewport, composer unreachable). Read
  `app/app/chat/page.tsx`, `components/layout/AppNav.tsx`, and
  `components/ui/Card.tsx`. Confirmed the diagnosis: the chat screen's
  inner flex column (line ~373) had no `min-h-0`, so it kept flexbox's
  default `min-height: auto` and refused to shrink below its content's
  intrinsic height inside the outer, already viewport-height-constrained
  wrapper (`h-[calc(100dvh-7.5rem)]` on mobile) — the message `Card`'s
  existing `overflow-y-auto` never received a bounded height to scroll
  within.
- Fix: added `min-h-0` to that one class list in `app/app/chat/page.tsx`.
  No other files changed (`Card` and `AppNav` were read-only for
  verification). Branched `fix/mobile-chat-scroll-overflow` off `main`;
  staged only the one changed file; committed `2c283ab`.
- Validated: `npx tsc --noEmit` clean; `npm run lint` shows only the
  pre-existing baseline (24 errors/7 warnings, all in unrelated files,
  mainly `tests/lib/session/temporary.test.ts`'s `no-explicit-any`); full
  `npm test` 282/282 passing (no test currently covers this file's
  rendering/layout, so this only confirms no regression elsewhere).
- Updated `PROJECT_STATUS.md` with a new "Recent Fixes (Post-Phase,
  Unscoped)" section documenting the bug, root cause, fix, and validation
  status.
- **Did not** install or run Playwright. Checked first: this project has
  zero E2E/browser-test infrastructure today — every existing test file
  (30 files, 282 tests) is Vitest with fully mocked Prisma via `vi.mock`,
  confirmed by reading `tests/lib/actions/document.test.ts` as a
  representative example. `.env.local`'s `DATABASE_URL` and
  `OPENAI_API_KEY` (confirmed via `env.example`) point to real remote
  services (Neon Postgres, OpenAI) with no test/sandbox separation
  anywhere in the codebase. Standing up a live-integration Playwright test
  for the real chat flow would mean either seeding real rows into the
  user's actual dev database and/or triggering a real paid OpenAI call
  (`sendMessage` → `lib/chat/client.ts`), or adding new test-only seams to
  application code (e.g. an injectable OpenAI `baseURL`) purely to make it
  mockable — the latter would be an unrelated-file change outside this
  bug fix's minimal scope. Logged as an open question rather than
  installing Playwright and picking an approach unilaterally, per
  CLAUDE.md's dependency-check and clarification rules.
- Asked the user via 3 concrete options (live-DB seed + DOM injection /
  isolated CSS fixture / skip Playwright). User chose live-DB seed + DOM
  injection.
- Checked current official Playwright docs (playwright.dev/docs/intro,
  /docs/test-webserver) before installing, per CLAUDE.md's
  testing-framework dependency-check rule: confirmed `npm init
  playwright@latest` is the current scaffolding command, but installed
  manually instead (`npm install -D @playwright/test` +
  `npx playwright install chromium`) to avoid the interactive wizard and
  keep the addition minimal/inspectable.
- Added `playwright.config.ts` (chromium only, `Pixel 5` mobile device
  emulation, `webServer` auto-starting `npm run dev`, `testDir: tests/e2e`,
  `testMatch: **/*.pw.ts` so Vitest's default include glob never picks up
  Playwright spec files — verified: `npm test` still reports exactly 30
  files/282 tests after adding it).
- Wrote `tests/e2e/mobile-chat-overflow.pw.ts`: seeds a real
  `TemporarySession` + READY `Document`/`Page`/`OcrResult` via Prisma
  (reusing `tests/schema/helpers.ts`'s `OwnerCleanup`/`futureDate`/
  `isLiveDbConfigured` directly rather than reinventing them), attaches
  the matching `tmp_session` cookie via `context.addCookies()`, reaches
  the real chat screen through the real UI (confirmed by reading
  `lib/chat/session.ts`'s `createChatSession` first that `startChat`
  makes no OpenAI call), then injects a long assistant message directly
  into the real message-log DOM node (avoiding a real, billed
  `sendMessage` → OpenAI call). Asserts: document doesn't grow past
  viewport, the message log itself has real internal overflow
  (`scrollHeight > clientHeight`), the composer is in the viewport, and
  the bottom nav is in the viewport and doesn't overlap the composer.
- **Verified the test isn't vacuous**: temporarily reverted the `min-h-0`
  fix, reran — test failed exactly as expected (`scrollHeight` 6748 vs a
  729px viewport bound). Restored the fix (confirmed via `git diff`
  showing no drift from the committed version) and reran — passed. This
  round-trip is the actual proof the test catches the regression, not
  just that it runs.
- Added `npm run test:e2e` (`playwright test`) to `package.json`, and
  gitignored Playwright's own output (`test-results/`,
  `playwright-report/`, `blob-report/`, `playwright/.cache/`).
- Committed in two scoped commits: `2c283ab` (already-committed layout
  fix, unchanged), `13a011a` (docs/memory), `202ca53` (Playwright infra +
  test). Updated `PROJECT_STATUS.md`'s "Recent Fixes" entry and
  `OPEN_QUESTIONS.md` to mark the Playwright question resolved.
- Not pushed; branch `fix/mobile-chat-scroll-overflow` is ready for the
  user to review/push/merge per CLAUDE.md's git workflow rules (Claude
  does not push or merge).
