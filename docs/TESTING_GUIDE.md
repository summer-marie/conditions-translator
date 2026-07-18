# TESTING_GUIDE.md

## Status

MVP testing guide.

This document defines what should be validated during implementation without locking the project into detailed test cases before the code exists.

Detailed tests should be added as each phase is implemented.

---

# 1. Purpose

The goal of testing is to protect the highest-risk parts of the application while keeping MVP development practical.

Testing should focus first on:

- ownership
- authorization
- document lifecycle
- OCR integrity
- AI grounding
- temporary retention
- deletion
- account transfer
- security

This guide is intentionally high-level.

Specific test files, fixtures, commands, and expected results should be added during implementation.

---

# 2. Testing Principles

- Test architecture-critical behavior first.
- Prefer small focused tests.
- Add tests when a bug reveals missing coverage.
- Do not delay the MVP for low-risk polish tests.
- Keep test commands visible in `package.json`.
- Use representative supervision documents for OCR and AI testing.
- Never use real sensitive user documents in committed test fixtures.
- Record tests run and tests not run in agent session notes.
- Add regression tests when a failure is fixed.

---

# 3. Testing Priority Levels

## Required

Testing is required for:

- Prisma schema and migrations
- ownership and authorization
- authentication and sessions
- document lifecycle state transitions
- temporary-to-saved ownership transfer
- deletion and cleanup
- security-sensitive routes
- environment configuration
- temporary session expiration

## Strongly Advised

Testing is strongly advised for:

- OCR upload and response validation
- page acceptance
- section generation
- AI grounding
- AI safety behavior
- multi-document chat
- rate limiting
- dashboard behavior

## Optional During MVP Build

Testing may be deferred for:

- styling-only changes
- documentation-only changes
- minor copy updates
- non-functional refactors
- final visual polish

---

# 4. Phase-Based Testing Areas

## Phase 1 — Project Foundation

Validate:

- application starts locally
- production build succeeds
- environment variables are validated
- secrets remain server-side
- database connection succeeds
- Prisma client generates
- package scripts work

Detailed test cases should be added when the stack is installed.

---

## Phase 2 — Schema and ORM

Validate:

- clean migrations apply
- a Document has exactly one owner
- dual ownership is rejected
- missing ownership is rejected
- temporary Documents require expiration
- saved Documents do not expire automatically
- Pages belong to one Document
- ownership-scoped queries work
- deletion behavior is predictable

This is a high-priority testing area.

---

## Phase 3 — Temporary Workspace

Validate:

- temporary sessions are created
- privacy notice acceptance is recorded
- temporary Documents are session-owned
- cross-session access is blocked
- expiration is enforced
- page ordering is preserved
- 10-page limit is enforced

---

## Phase 4 — OCR and Page Acceptance

Validate:

- supported file types succeed
- unsupported file types fail clearly
- file-size limits work
- OCR calls are server-side
- structured OCR output is validated
- blurry or incomplete images cannot be accepted
- accepted text attaches to the correct Page
- unaccepted text cannot reach AI context
- raw or unaccepted OCR text never reaches AI context
- the uploaded image is preserved unchanged (immutable source)
- raw document text is not logged

Once the approved OCR transcription correction workflow is implemented (approved and documented but
not yet built — see `docs/OCR_Master_Implementation_Plan.md`), also validate:

- corrections to the proposed transcription persist and become the accepted page text
- corrected accepted text reaches AI while raw/unaccepted OCR does not
- the user-responsibility notice is shown during review

Use synthetic or public sample documents only.

---

## Phase 5 — Section Generation

Validate:

- Finish Document closes intake
- valid state transitions occur
- section generation starts automatically
- sections map back to accepted pages
- failures move to `PROCESSING_FAILED`
- Retry works
- AI remains disabled until `READY`

---

## Phase 6 — AI Chat

Validate:

- only `READY` Documents are selectable
- maximum 3 Documents per chat
- full selected source text is included
- chat history provides context only
- answers remain grounded in uploaded documents
- missing-source responses do not use general knowledge
- conflicting documents show both sources
- possible-violation questions do not determine a violation
- temporary messages expire
- message and character limits work
- source text is never silently truncated

Prompt testing should remain iterative.

---

## Phase 7 — Account Creation and Save

Validate:

- temporary use works without an account
- account creation is prompted only when saving
- email/password signup works
- username/password signup works
- username-only warning appears
- cancel returns to temporary mode
- all temporary Documents transfer
- ownership changes atomically
- no duplicate Documents are created
- active chat continues
- saved Documents remain after chat expiration

---

## Phase 8 — Dashboard and Deletion

Validate:

- users see only their own Documents
- saved Documents open correctly
- new chats start from READY Documents
- duplicate-label warning appears
- deleted Documents disappear immediately
- database children are removed or queued
- Blob cleanup runs
- failed cleanup retries
- deleted Documents cannot be used in chat

---

## Phase 9 — Cleanup and Retention

Validate:

- temporary data expires
- expired data becomes inaccessible
- cleanup removes temporary Documents
- cleanup removes temporary chat data
- cleanup failures are recorded safely
- retries work
- saved Documents are not affected
- logs do not contain sensitive text

### Status (2026-07-17/18, merged via `feat/phase-9-cleanup-retention`, PR #25; cron cadence
updated 2026-07-18 for Vercel Hobby-plan compatibility)

**Implemented.** `lib/cleanup/sweep.ts` + `app/api/cron/cleanup/route.ts` (Vercel Cron, once daily,
`vercel.json` — daily rather than hourly because the Vercel Hobby plan does not allow more-frequent
cron schedules; see `docs/Deployment_Vercel.md`). No schema change was needed — cleanup reuses the
existing Phase 8 `deleteDocument` pipeline per Document (already Blob-then-DB retry-safe) and
deletes expired `ChatSession` rows directly (any owner — chat is always temporary regardless of
Document ownership).

Tests run:

- Unit (mocked Prisma): `tests/lib/cleanup/sweep.test.ts` (7 cases — expired-chat deletion,
  zero-Document session deletion, multi-Document cleanup via `deleteDocument`, a still-pending
  Document blocking session deletion, an unexpected `deleteDocument` throw also blocking session
  deletion) and `tests/api/cron/cleanup.test.ts` (5 cases — missing/wrong/unset bearer token,
  successful sweep response shape, sweep failure returns a safe 500).
- Live-DB verification (2026-07-18, real Neon dev database, via a temporary `tsx` script deleted
  after use — not committed): created one expired `TemporarySession` + `Document` (READY, one
  ACCEPTED page, no Blob path) + one expired `ChatSession`, and one still-valid session/document/
  chat as controls. After `runCleanupSweep()`: the expired session, its Document, and the expired
  chat were gone; the still-valid controls were untouched. The same run also found and correctly
  cleaned up 58 real, already-expired `TemporarySession` rows (12 Documents, 7 chat sessions) that
  had accumulated in the dev database prior to this phase (no prior cleanup mechanism existed).
- Full suite: `npm run test` 274/274 passing (262 pre-existing + 12 new). `npx tsc --noEmit`
  clean. `npm run lint`: 30 problems, byte-for-byte the same pre-existing baseline as before this
  branch (24 errors in `tests/lib/session/temporary.test.ts`, 6 pre-existing warnings elsewhere) —
  zero new issues from this phase's files. `npm run build` succeeds; confirmed
  `CLEANUP_JOB_SECRET`/`CRON_SECRET` do not appear anywhere in `.next/static`.

Not tested this pass:

- Real Vercel Cron invocation on a deployed preview/production environment (only a manual
  `Invoke-RestMethod` call against the route was documented, in `docs/Deployment_Vercel.md`).
- A genuine Blob-delete failure during the sweep (the retry path itself is unit-tested via a
  mocked `deleteDocument` rejection/incomplete result, mirroring the existing Phase 8 deletion
  tests, but not reproduced against real Vercel Blob).
- Concurrent/overlapping cron invocations (the design relies on `deleteDocument`'s existing
  conditional `updateMany`, which is already safe under concurrency per Phase 8's own tests, but
  no explicit concurrent-sweep test was added).

### Logging/privacy audit findings (Phase 9 requirement)

Reviewed every `logger.*`/`console.*` call site in `lib/` and `app/api/`. Found and fixed 4 route
catch-all blocks (`app/api/documents/route.ts`, `app/api/documents/[documentId]/route.ts` GET/PATCH,
`app/api/documents/[documentId]/pages/route.ts` GET) that logged the raw `error` object instead of
just `error.name`, inconsistent with the safe pattern already established in sibling routes (e.g.
the `DELETE /api/documents/[documentId]` route). Fixed to match. The temporary `[ocr-diag]`
diagnostic logging in `lib/ocr/client.ts`/the OCR route (added 2026-07-14 to investigate a real
502 on phone photos) was reviewed and confirmed to log only ids/byte sizes/error metadata, never
image bytes or extracted text — left in place since that investigation is still open (see
`.agent-memory/OPEN_QUESTIONS.md`), not because it's unsafe. No other violations found: no chat
content, page text, or secrets are logged anywhere in server code.

---

# 5. AI Safety Test Categories

Use a small repeatable prompt set during development.

Test categories:

- safe explanation
- permission question
- prediction question
- possible violation
- missing source
- conflicting Documents
- officer follow-up question
- prompt injection in uploaded text
- request to ignore instructions
- repeated yes/no pressure
- long chat
- rate-limit boundary

Record:

- expected behavior
- actual behavior
- pass/fail
- prompt changes
- regressions
- follow-up required

Detailed prompt fixtures should be added after the first working AI implementation.

---

# 6. Rate Limit Testing

Review whether limits are:

- too restrictive for normal use
- too permissive for abuse
- counting retries fairly
- separate for OCR, chat, and auth
- resetting correctly
- displaying helpful messages

Do not finalize thresholds until representative testing is complete.

---

# 7. Manual UI Testing

For MVP, manually validate:

- mobile layout
- desktop browser layout
- upload flow
- page review flow
- processing state
- Retry state
- AI chat readability
- source display
- account creation
- dashboard
- deletion
- empty states
- loading states
- error states

Wireframes may be added when a flow needs clarification.

---

# 8. Test Data Rules

- Do not commit real user documents.
- Do not commit names, case numbers, addresses, or sensitive personal data.
- Prefer synthetic test documents.
- Public sample forms may be used if legally appropriate.
- Keep test fixtures clearly labeled.
- Store local-only sensitive fixtures outside Git tracking.

---

# 9. Package Script Guidance

Add scripts incrementally.

Example:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:schema": "vitest run tests/schema",
    "test:auth": "vitest run tests/auth",
    "test:ocr": "vitest run tests/ocr",
    "test:ai": "vitest run tests/ai",
    "test:integration": "vitest run tests/integration"
  }
}
```

Final commands should match the tools actually selected during implementation.

---

# 10. Test Reporting

For each meaningful change, report:

- tests run
- tests passed
- tests failed
- tests skipped
- manual checks completed
- known gaps
- follow-up tests needed

Use the shared agent memory files for cross-session continuity.

---

# 11. Release Readiness

Before recording the MVP demo, validate:

- temporary user flow
- multi-page intake
- OCR acceptance
- Finish Document
- section generation
- READY status
- grounded AI chat
- account creation
- ownership transfer
- dashboard
- deletion
- temporary cleanup

Use the Launch Readiness Checklist as the final acceptance source.

---

# 12. Future Expansion

Add more detailed tests when:

- implementation stabilizes
- bugs reveal missing coverage
- production deployment approaches
- real representative documents are tested
- prompt behavior becomes more complex
- rate limits are tuned
- retrieval is introduced
- additional file types are added

---

# 13. Deployment and Mobile Testing

For Vercel deployment and mobile/phone OCR testing:

- See `docs/Deployment_Vercel.md` for step-by-step deployment setup.
- See `docs/Mobile_OCR_Tests_plan.md` for focused phone-upload OCR tests.

These are required before declaring Phase E2E complete and
moving into Phase 9 Cleanup and Demo Validation.

---

# Dependencies

- `01_MVP_PRD.md`
- `02_Architecture_Overview.md`
- `03_OCR_Specifications.md`
- `04_Schema_Architecture.md`
- `06_AI_Safety_and_Persona.md`
- `07_Launch_Readiness_Checklist.md`
- `08_Conditions_Translator_Implementation_Roadmap.md`
- `09_Coding_Risk_Register.md`
