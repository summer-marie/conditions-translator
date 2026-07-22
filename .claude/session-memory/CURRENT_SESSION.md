# Current Session

**Date:** 2026-07-21
**Branch:** fix/signed-in-new-document (new branch off main, not yet merged)

## Task — COMPLETE, awaiting user review/push/merge

Fixed the audited bug (audit-only pass earlier in this same conversation, then approved):
signed-in users could not start/add a new document, on mobile or desktop.

### Root cause fixed

`lib/actions/document.ts`'s `createTemporaryDocument` resolved ownership only via
`getTemporarySession()`, never `getCurrentOwner()`, so a signed-in caller always hit
`NO_ACTIVE_SESSION`. `app/app/workspace/page.tsx` papered over this with a disabled upload
control and the message "Starting a new document isn't available for signed-in accounts yet."
A second, related dead end: a brand-new signed-in account with zero documents never got an
auto-created intake document either, landing on a separate "Unable to load workspace" state.

### What was built

- `lib/actions/document.ts`: `createTemporaryDocument` now resolves `getCurrentOwner()` once
  and branches on `owner.kind` — `"user"` creates via `createOwnedDocument(owner, { title })`
  (no expiry), `"temporary"` keeps the existing expiry-derived path. `isPrivacyAccepted()` now
  receives `owner?.kind === "user"` so a signed-in caller's account-creation-time acceptance is
  honored instead of being checked against a nonexistent temporary session.
- `app/app/workspace/page.tsx`: removed the three signed-in-only bailouts — the
  `!status.userId` guard on auto-create-on-mount (now applies to both owner kinds), the
  `handleFileUpload` early-return for `savedUserId`, and the `newDocumentUploadDisabled` flag
  plus its render-time usages (disabled input/styling and the old caption message).
- Tests: rewrote `createTemporaryDocument`'s tests in `tests/lib/actions/document.test.ts` to
  mock `getCurrentOwner`, added a signed-in-creation case and a privacy-flag pass-through
  assertion. Added `tests/e2e/signed-in-new-document.pw.ts` (live-DB Playwright): zero-document
  signed-in init, and starting a second document after one is already finished.

### Validation

- `tsc --noEmit`: clean.
- `npm run lint`: unchanged at the pre-existing 24-error/7-warning baseline.
- `npm test`: 301/301 (was 300/300 before this session — 1 new test net).
- `npx playwright test`: 8/8 passing across both projects (6 pre-existing + 2 new).

## Known limitation

None functionally. `createOwnedDocument`/ownership plumbing was already correct for
user-owned Documents (used by every other action in the file) — this fix only wired document
*creation* up to the same pattern, so no new architecture or schema change was needed.

## Next steps

None outstanding on this task. Branch `fix/signed-in-new-document` is not pushed; user
pushes/merges per CLAUDE.md's git workflow rules. No schema/migration changes in this fix.
