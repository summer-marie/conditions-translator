# Current Session

**Date:** 2026-07-21
**Branch:** feat/chat-legal-disclaimer (new branch off main, not yet merged)

## Task — COMPLETE, awaiting user review/push/merge

Implemented the audited chat legal-disclaimer plan (an audit-only pass earlier in this same
conversation, then approved with three confirmed decisions: separate from the Privacy Notice
gate, compact focus-trapped bottom sheet on mobile, and server-side enforcement in addition to
UI).

### Root cause fixed

`lib/chat/prompt.ts`'s `CHAT_SYSTEM_PROMPT` told the model to "add a brief, calm disclaimer
where appropriate" on every substantive answer, stacked on top of four SPECIFIC BEHAVIORS
categories that each separately encode a hedge (permission/missing-source/conflict/violation).
Real supervision questions land in one of those four categories almost every time, so the
model was repeating "not legal advice"-style boilerplate constantly. Fixed by moving the
standing disclaimer into the product UI (acknowledged once) and rewriting the CORE RULES bullet
to tell the model not to repeat a generic disclaimer per answer — the four required safety
behaviors themselves are untouched.

### What was built

- Schema: `User.chatDisclaimerAcknowledgedAt` + `TemporarySession.chatDisclaimerAcknowledgedAt`
  (migration `20260721224749_add_chat_disclaimer_acknowledgment`) — deliberately separate from
  `noticeAcceptedAt` (the existing Privacy Notice gate).
- `lib/session/chatDisclaimer.ts` (isAcknowledged/acknowledge/require helpers),
  `lib/actions/chatDisclaimer.ts` (Server Action).
- `/api/session/status` now also returns `chatDisclaimerAcknowledged`.
- Server-side enforcement: `lib/chat/session.ts`'s `createChatSession`/`sendChatMessage` both
  call `requireChatDisclaimerAcknowledged` and throw `CHAT_DISCLAIMER_NOT_ACKNOWLEDGED` (403) —
  chat use does not rely on client state alone.
- UI: compact `Alert` banner at the top of the chat box (desktop, `hidden md:flex`) and a new
  `components/chat/ChatDisclaimerSheet.tsx` (mobile-only, `md:hidden`, focus-trapped via the
  existing `useFocusTrap` hook, single "Got it" action, no Escape/backdrop dismiss) wired into
  `app/app/chat/page.tsx`. Start Chat/Send are disabled client-side until acknowledged too.

### Validation

- `tsc --noEmit`: clean.
- `npm run lint`: unchanged at the pre-existing 24-error/7-warning baseline.
- `npm test`: 300/300 (was 282/282 before this session — 18 new tests: chat-disclaimer helper,
  extended chat-session enforcement tests, extended prompt tests, new `/api/session/status`
  tests).
- `npm run test:e2e` (Playwright): 6/6 passing across two projects — the existing
  `mobile-chrome` (Pixel 5) plus a new `desktop-chrome` (Desktop Chrome) project, scoped via a
  `*.desktop.pw.ts` naming convention (`playwright.config.ts`) so it doesn't run against the
  pre-existing mobile-only spec. Covers: mobile sheet appears/traps focus/blocks the screen
  underneath until acknowledged; a new temporary session is prompted independently of another
  session's acknowledgment; desktop banner appears/hides; signed-in user's acknowledgment
  persists per-account regardless of any temporary session.
- Fixed one incidental regression: `tests/e2e/mobile-chat-overflow.pw.ts`'s seeded session now
  pre-acknowledges the new disclaimer directly via Prisma (that test is about layout, not this
  flow) — without this it timed out because the new sheet correctly blocked it.

## Known limitation

Whether real live chat answers actually repeat the disclaimer less often is **not**
Playwright-testable without a real, billed OpenAI call — validated only via
`tests/lib/chat/prompt.test.ts`'s static assertions on the prompt text. Recommend a manual
spot-check against a handful of live chat turns before merging, per
`docs/09_Coding_Risk_Register.md` R-001 (prompt-change testing advice).

## Next steps

None outstanding on this task. Branch `feat/chat-legal-disclaimer` is not pushed; user
pushes/merges per CLAUDE.md's git workflow rules. A real migration was applied to the shared
dev Neon DB (`20260721224749_add_chat_disclaimer_acknowledgment`) — routine schema work, not a
live-integration-test decision (see [[project-test-infrastructure-gap]] for the distinct
concern that memory tracks, which is about *test* writes to the live DB, not schema migrations).
