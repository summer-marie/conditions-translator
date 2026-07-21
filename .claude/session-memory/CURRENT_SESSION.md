# Current Session

**Date:** 2026-07-21
**Branch:** fix/mobile-chat-scroll-overflow (1 commit ahead of main, working tree clean)

## Task

Fix a mobile-only layout bug in `/app/chat`: a long assistant response grew
the chat screen past the viewport instead of scrolling inside the message
log, making the composer unreachable. Root cause confirmed by reading
`app/app/chat/page.tsx`, `components/layout/AppNav.tsx`, and
`components/ui/Card.tsx`: the inner flex column (line ~373) was missing
`min-h-0`, so CSS flexbox's default `min-height: auto` kept it from
shrinking below its content's intrinsic height inside the outer,
already-viewport-height-constrained wrapper. Fix: added `min-h-0` to that
one class list — no other files changed. Committed
(`2c283ab fix: prevent mobile chat layout from overflowing past viewport`).
`PROJECT_STATUS.md` updated with a "Recent Fixes (Post-Phase, Unscoped)"
entry.

## Key context for continuation

- Validated: `tsc --noEmit` clean, `npm run lint` shows only the
  pre-existing 24-error/7-warning baseline (all in unrelated files, mainly
  `tests/lib/session/temporary.test.ts`'s `no-explicit-any`), full
  `npm test` (282/282) passing.
- **Not validated**: real mobile-browser/Playwright confirmation. This
  project has **zero Playwright/E2E infrastructure** — every existing test
  is Vitest with fully mocked Prisma (`vi.mock`), no live-DB or
  browser-driven tests anywhere. `.env.local`'s `DATABASE_URL` and
  `OPENAI_API_KEY` point to real remote services (Neon, OpenAI) with no
  test/sandbox separation — standing up a live Playwright test means either
  writing real rows to the user's actual dev DB and/or risking a real paid
  OpenAI call, or adding new test-seam code to the app purely for testing
  (`lib/chat/client.ts` has no injectable base URL today). This is a real
  infrastructure decision, flagged to the user rather than made
  unilaterally — see OPEN_QUESTIONS.md.
- Prior orientation-session context (2026-07-20) still holds: architecture
  frozen, all phases (1-10, E2E, Wireframe Implementation) closed per
  PROJECT_STATUS.md/DECISIONS.md; `.claude/session-memory/` is now tracked
  in git (see DECISIONS.md 2026-07-20 entry) so these 4 files are staged
  and committed like any other tracked file.

## Next steps

Awaiting the user's decision on how (or whether) to validate this fix with
Playwright given the infra gap above. Branch is not pushed; user pushes/
merges per CLAUDE.md workflow rules.
