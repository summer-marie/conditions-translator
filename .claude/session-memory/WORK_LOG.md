# Work Log

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
