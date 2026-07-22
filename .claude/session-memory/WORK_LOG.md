# Work Log

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
