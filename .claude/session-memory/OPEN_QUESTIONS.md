# Open Questions

## Blocking: how to validate the mobile chat overflow fix with Playwright (2026-07-21)

`fix/mobile-chat-scroll-overflow` (commit `2c283ab`) fixes the layout bug (see WORK_LOG.md), and
`tsc`/`lint`/`npm test` all pass. The one remaining requested validation step — a Playwright mobile
regression test — is blocked on a real infrastructure decision, not just missing code:

- This project has **no Playwright/E2E setup at all** (not a devDependency, no config, no spec
  files). Every existing test is Vitest with fully mocked Prisma.
- `.env.local`'s `DATABASE_URL` (Neon Postgres) and `OPENAI_API_KEY` are real remote credentials —
  there is no test/sandbox database or mocked-AI test seam anywhere in the codebase.
- Reaching the actual long-message chat screen for real requires either (a) writing real rows into
  the user's live dev database (a temp session + READY document/page) and, if a message is
  actually sent, a real billed OpenAI call, or (b) adding a new test-only seam to production code
  (e.g. an injectable OpenAI `baseURL`) that doesn't exist today — outside this fix's minimal scope.

Options to put to the user rather than deciding alone:
1. Install Playwright + seed one real Document directly via Prisma into the live dev DB, reach the
   chat screen via the real UI, then inject a long message into the DOM directly (no real
   `sendMessage`/OpenAI call) to verify the layout — real component tree, real CSS, but writes a
   couple of throwaway rows to the live Neon DB (cleanable after).
2. Skip live app/DB integration; write an isolated Playwright fixture reproducing the exact
   Tailwind class structure to pin down the flexbox mechanism — no DB/API involved, but doesn't
   exercise the real component tree.
3. Skip Playwright for this fix; rely on `tsc`/`lint`/code-reasoning, and note a real
   mobile-device/manual QA pass as a follow-up.


Compiled from a full docs review on 2026-07-20, **corrected same-day**
after discovering PROJECT_STATUS.md itself is stale (last touched at
commit `ae4b107`, before several items below were actually resolved).
Lesson: verify against `git log`/current code before trusting this
project's own status docs — see WORK_LOG.md 2026-07-20 entry.

## RESOLVED — doc said open, code says done (verified 2026-07-20)

- [x] `fix/pwa-redirect-loop` — merged via PR #28 (`8a0b8a2`), confirmed an
      ancestor of current HEAD. PROJECT_STATUS.md still lists it "pending
      user review."
- [x] PRD reconciliation — docs/01_MVP_PRD.md §4 was edited in commit
      `e0f0a27` (2026-07-16) to add the landing-page/privacy-notice steps.
      PROJECT_STATUS.md still says the PRD "remains frozen/unedited."
- [x] Duplicate-label warning (Launch Readiness Checklist §10) —
      `hasDuplicateTitle()` implemented in `d253034` ("Phase 8 dashboard UI
      follow-up improvements"), live at `app/app/dashboard/page.tsx:523`.
      PROJECT_STATUS.md still says "remains unimplemented" (was already
      wrong even when that doc was last edited).

## Still genuinely open (verified against current code 2026-07-20)

- [ ] `createTemporaryDocument` (`lib/actions/document.ts:85`) still only
      resolves a temporary session and throws `NO_ACTIVE_SESSION`
      otherwise — no signed-in-user path exists. Confirmed by reading the
      current function body.
- [ ] `[ocr-diag]` diagnostic logging confirmed still present in
      `lib/ocr/client.ts` and the OCR route.
- [ ] Real Vercel Cron invocation on a deployed environment — not
      re-verified this pass (infra-level, can't confirm from git/code
      alone).
- [ ] Devices that installed the PWA under the old manifest — not
      re-verified this pass (device-dependent, can't confirm from code).

## Not re-verified this pass — treat with suspicion until checked directly

- [ ] Several OCR-correction docs (03, 04, 07 §7, 08 §7, TESTING_GUIDE
      Phase 4 section, Mobile_OCR_Tests_plan §4b, DASHBOARD_UI_AUDIT) said
      "not yet implemented" as of the 2026-07-20 docs review — not
      re-checked against current code in this pass.
- [ ] The 8 usability findings below are from docs/USABILITY_UI_AUDIT.md
      (2026-07-18) and were not re-verified against current code — given
      three other status claims turned out stale today, don't assume these
      are still accurate without checking each one directly first.

- [ ] **OIDC-in-local-dev claim may be outdated**: `lib/storage/blob.ts`'s
      docstring and `docs/Deployment_Vercel.md` both assert OIDC auth
      "isn't usable in the local development environment," which is why
      `BLOB_READ_WRITE_TOKEN` exists as a fallback. On 2026-07-20, `vercel
      link` (CLI 56.4.0) auto-provisioned a fresh `VERCEL_OIDC_TOKEN` into
      `.env.local` for the "development" environment, and `vercel env pull`
      for Development returned *only* `VERCEL_OIDC_TOKEN` — no
      `BLOB_READ_WRITE_TOKEN` was ever registered on the Vercel project.
      With `BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN` both now present locally,
      OIDC may work locally on current Vercel tooling and the
      `BLOB_READ_WRITE_TOKEN` fallback may be unnecessary. Needs an actual
      test (page upload through `lib/storage/blob.ts`) to confirm either
      way; if OIDC does work locally now, `lib/storage/blob.ts`'s docstring
      and `docs/Deployment_Vercel.md` §4 should be corrected.

## Live risks to monitor (docs/09_Coding_Risk_Register.md)

- R-001 AI Prompt Drift (High likelihood / High impact)
- R-002 Shared Ownership Authorization Failure (Medium / Critical)
- R-003 Document State Corruption (Medium / High)
- R-004 Full-Document Context Limits (fixed hard limits, no retrieval strategy)

## Usability findings not yet fixed (docs/USABILITY_UI_AUDIT.md, 2026-07-18)

- [ ] "Upload Pages" advertises drag-and-drop that isn't implemented.
- [ ] `--color-text-meta` on `--color-background-page` fails WCAG AA
      contrast (~3.6:1, needs 4.5:1) — used pervasively.
- [ ] Inconsistent destructive-confirm UX (native `confirm()` vs. custom
      modal).
- [ ] Possible duplicate empty documents from guest onboarding (no
      idempotency guard on `initializeWorkspace()`) — not conclusively
      reproduced against a production build.
- [ ] "Log in" vs. "Save workspace" buttons are near-identical/confusing.
- [ ] Page-review action buttons (~28-30px) are below the ~44px mobile
      touch-target minimum.
- [ ] Emoji-as-icon inconsistent with the app's SVG icon system.
- [ ] Save/sign-in form lacks client-side pre-validation.
