# Decisions

Durable decisions made during Claude Code sessions on this project.
Formal architecture ADRs belong in docs/Decision_Log.md, not here — this
file is for smaller working decisions worth remembering across sessions.

## 2026-07-21 — Chat legal-disclaimer: separate flag, not a Privacy Notice extension

Confirmed by the user during the approval step (not assumed): the new chat-specific "not
legal advice" disclaimer is a genuinely separate acknowledgment from the existing Privacy
Notice gate (`components/landing/PrivacyGateModal.tsx` / `TemporarySession.noticeAcceptedAt`),
which covers data retention/handling and is shown before first upload, not legal-advice
framing. Implemented as its own fields (`User.chatDisclaimerAcknowledgedAt`,
`TemporarySession.chatDisclaimerAcknowledgedAt`) and its own module
(`lib/session/chatDisclaimer.ts`), not a reuse/extension of `lib/session/temporary.ts`'s
existing privacy-acceptance flag.

**Why:** cleaner separation of concerns per the user's explicit reasoning — the two notices
cover genuinely different content, and merging them would have conflated "we don't keep your
data forever" with "this isn't legal advice."
**How to apply:** any future notice/disclaimer/consent gate on this project should default to
its own flag+module unless the user explicitly asks for reuse — don't assume acknowledgment
flags are interchangeable just because the acceptance UX pattern (modal/sheet + timestamp
column) looks similar.

## 2026-07-21 — Mobile disclaimer UX: focus-trapped bottom sheet, not a toast

Confirmed by the user: the mobile chat disclaimer is a compact, focus-trapped bottom sheet
(`components/chat/ChatDisclaimerSheet.tsx`) rather than an auto-dismissing toast/snackbar.

**Why:** an explicit "Got it" tap gives real acknowledgment semantics for legal-adjacent copy;
a passive tap-away/auto-dismiss toast would be a weaker signal that the user actually saw and
agreed to the disclaimer, and this codebase had no existing toast component to reuse anyway
(the closest precedent, `PrivacyGateModal`, is already a focus-trapped dialog, just full-screen
instead of a bottom sheet).
**How to apply:** future mandatory (not merely informational) mobile acknowledgments on this
project should default to a focus-trapped sheet/dialog with an explicit confirm action, not a
toast — reserve toasts for non-mandatory, purely informational feedback (which doesn't exist
in this codebase yet either).

## 2026-07-21 — Chat disclaimer server-side enforcement: check in lib/chat/session.ts, not lib/actions/chat.ts

Enforcement (`requireChatDisclaimerAcknowledged`) was added as the first line of
`createChatSession`/`sendChatMessage` in `lib/chat/session.ts`, not in `lib/actions/chat.ts`'s
`requireOwner()`.

**Why:** `requireOwner()` only resolves *who* the owner is; it's shared by `loadChat` too,
which must keep working to refresh an already-started session's state even if acknowledgment
bookkeeping were ever in an inconsistent state — gating belongs at the chat *entry/action*
points (start a session, send a message), matching where message-limit enforcement already
lives in the same file.
**How to apply:** any future chat-specific gate (rate limits, additional consent, etc.) should
default to the same choke points in `lib/chat/session.ts` rather than the thin Server Action
wrappers in `lib/actions/chat.ts`.

## 2026-07-20 — Trimmed .env.local and env.example to actual codebase usage

Audited every var in env.example/.env.local against real reads in the
codebase (grep for `process.env.X`, plus manual trace of `lib/env.ts`,
`lib/constants.ts`, `lib/storage/blob.ts`, the three OpenAI client
modules, and `app/api/cron/cleanup/route.ts`).

- `.env.local` now holds only the 8 vars that are read with no fallback
  and either crash/error the app or fail its own `/api/health` contract:
  `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `OPENAI_API_KEY`,
  `OPENAI_OCR_MODEL`, `OPENAI_SECTION_MODEL`, `OPENAI_CHAT_MODEL`,
  `BLOB_STORE_ID`, `BLOB_READ_WRITE_TOKEN`, `CLEANUP_JOB_SECRET`.
- `env.example` keeps every var still read by the app (required or with a
  fallback), tagged `[REQUIRED]` / `[OPTIONAL]` / `[PLATFORM]`. Removed
  vars with zero references anywhere in the codebase: the whole Rate
  Limiting, Logging and Diagnostics, Feature Flags, Email/Password
  Recovery, and Development/Testing sections, plus
  `CLEANUP_INTERVAL_MINUTES`, `DELETE_MAX_RETRIES`,
  `DELETE_RETRY_DELAY_SECONDS`, `BLOB_ACCESS_MODE`, and several
  never-read OCR tuning vars.
- Corrected 5 premises from the original audit request: `BLOB_PATH_PREFIX`
  has a real fallback (not required); `NEXT_PUBLIC_APP_URL` is dead code
  (`app/layout.tsx` hardcodes `metadataBase`); `CRON_SECRET` is
  Vercel-platform-only, never read by app code, not needed locally;
  `AUTH_SECRET` and `BLOB_STORE_ID` are required only because
  `lib/env.ts`'s `validateServerEnv()` gates `/api/health` on them, not
  because any feature consumes them directly.

**Why:** the previous `.env.local` was carried over from an old computer
and env.example had drifted from the code (several vars documented as
active were never wired up, e.g. rate limiting, password reset).
**How to apply:** trust env.example's `[REQUIRED]`/`[OPTIONAL]`/`[PLATFORM]`
tags going forward; re-verify before adding a new var back if a feature
(rate limiting, email/password-reset) actually gets built.

## 2026-07-20 — Closed out all roadmap phases; started tracking .claude/session-memory/ in git

User confirmed all phases in docs/08_Conditions_Translator_Implementation_Roadmap.md are done
and the next phase isn't defined yet ("i will have to create myself"). Marked all phases
(1–10, E2E, Wireframe Implementation) **Status: Complete** in that doc, and refreshed
PROJECT_STATUS.md to match — including correcting the 3 stale "Outstanding Items" found in the
prior pushback (see WORK_LOG). Existing caveats (Phase E2E's real-device testing gap, Phase 9's
unconfirmed real Vercel Cron trigger) were kept as factual notes, not deleted — closing a phase
doesn't mean erasing what wasn't independently verified.

Also, per explicit user request ("start tracking the claude folder so i dont have to worry about
losing memory files again"): removed `.claude/session-memory/` from `.gitignore` so
CURRENT_SESSION.md, DECISIONS.md, OPEN_QUESTIONS.md, and WORK_LOG.md are now tracked in git.
Scoped narrowly — `.claude/settings.local.json` stays gitignored (the `.local` suffix is Claude
Code's own convention for per-machine config, not memory content). Also fixed two unrelated
.gitignore issues found while editing that same block: a garbled duplicate `.vscode/` line, and
an accidental drop of the `.env*` catch-all during cleanup (would have stopped protecting
`.env.vercel`/`.env.vercel.pull`, which aren't covered by the specific `.env.*.local` entries) —
consolidated to a single `.env*` line instead.

**Why:** CLAUDE.md §12 designates CURRENT_SESSION.md/WORK_LOG.md as "local only," but also says
"never commit... unless explicitly told to do so" — this session's explicit request is exactly
that carve-out.
**How to apply:** these 4 files are now part of the normal commit/push flow going forward: stage
them by name like any other tracked file when they change. `settings.local.json` is not
committable without a further explicit request to change scope.

## 2026-07-21 — Added Playwright as this project's first E2E/browser-test tool; live-DB-seed pattern approved

Before this date the project had zero Playwright/E2E infrastructure — every test was Vitest with
fully mocked Prisma. A mobile chat layout bug fix (`min-h-0` missing in
`app/app/chat/page.tsx`, branch `fix/mobile-chat-scroll-overflow`) needed real-browser validation,
so this was surfaced to the user as a genuine infrastructure decision rather than made
unilaterally — `.env.local`'s `DATABASE_URL`/`OPENAI_API_KEY` point to real remote Neon/OpenAI
services with no test/sandbox separation, so any live-integration browser test necessarily touches
real infrastructure.

User chose: install `@playwright/test` (chromium only), seed a real `TemporarySession` + READY
`Document`/`Page`/`OcrResult` directly via Prisma for setup, and inject a long assistant message
directly into the DOM rather than triggering a real `sendMessage` call (which would hit the real,
billed OpenAI API). Implemented as `playwright.config.ts` + `tests/e2e/mobile-chat-overflow.pw.ts`
+ `npm run test:e2e`.

- Reused `tests/schema/helpers.ts`'s existing `OwnerCleanup`/`futureDate`/`isLiveDbConfigured`
  rather than inventing new seed/cleanup helpers — that file already established the live-DB test
  pattern (gated behind `isLiveDbConfigured()` so it auto-skips without a real `DATABASE_URL`).
- Playwright test files use the `.pw.ts` suffix (not `.spec.ts`/`.test.ts`), and
  `playwright.config.ts` sets `testMatch: "**/*.pw.ts"` explicitly, so Vitest's default include
  glob never picks them up — verified `npm test` still reports the same file/test count after
  adding it.
- Verified the new test isn't vacuous by temporarily reverting the `min-h-0` fix and confirming it
  fails (reproduced the real bug: 6748px document height against a 729px mobile viewport), then
  restored the fix and confirmed it passes.

**Why:** CLAUDE.md requires checking current docs before installing a testing framework and
flagging decisions with real infrastructure/cost implications rather than making them
unilaterally — this one touches the live dev database and could otherwise trigger real OpenAI
spend.
**How to apply:** this establishes the precedent for future browser-driven tests on this project:
seed via Prisma reusing `tests/schema/helpers.ts`'s cleanup helpers, avoid real OpenAI calls by
injecting content directly or stubbing at the seam that exists, and always verify a new regression
test actually fails without the fix before trusting it. Still ask the user before adding *another*
live-integration test rather than assuming this precedent is blanket permission — each one touches
the same shared live dev database. See [[project-test-infrastructure-gap]].
