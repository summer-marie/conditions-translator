# Current Session

**Date:** 2026-07-21
**Branch:** fix/workspace-upload-queue (new branch off main, not yet merged)

## Task — COMPLETE, awaiting user review/push/merge

Audited (earlier in this conversation, audit-only pass) then implemented, per explicit
"Implement Option 2" instruction: users could not upload additional photos/pages while
earlier uploaded pages were still being OCR-processed.

### Root cause fixed

`app/app/workspace/page.tsx`'s `handleFileUpload` disabled the page-image file input
(`disabled={isUploading}`) for the entire duration of a batch's upload+OCR cycle, because the
handler itself awaited a `for` loop that uploaded each file and then awaited
`runOcrForPage` before moving to the next — and OCR runs synchronously server-side (a real
OpenAI Vision call inside `app/api/documents/[documentId]/pages/[pageId]/ocr/route.ts`, no job
queue). UI-only limitation; server routes/schema were untouched and didn't need to change.

### What was built

- `app/app/workspace/page.tsx`: replaced the blocking loop with a client-side queue
  (`uploadQueueRef`, a ref of `{file, targetId, uploaded}`) plus a serial worker
  (`drainUploadQueue`). `handleFileUpload` now enqueues and returns quickly instead of awaiting
  the whole upload→OCR cycle. The file input's `disabled` now only depends on `isCreating`
  (guarding the one real remaining race: creating a brand-new intake document), not
  `isUploading`. `drainUploadQueue` processes exactly one file at a time (upload, then OCR)
  because page `order` is assigned server-side from the current page count
  (`prisma/schema.prisma`'s `@@unique([documentId, order])`) — concurrent uploads for the same
  document could otherwise collide.
  - 10-page cap check now factors in files already queued (not just committed `pageCount`).
    Found and fixed a real double-counting bug during test-writing: an item flips `uploaded:
    true` right after its own `POST .../pages` succeeds (before its OCR call), so it's not
    counted twice (once via `pageCount`, once via the queue) while its OCR is still pending.
  - `viewedDocumentIdRef` (mirrors `document?.id` via a `useEffect`) guards the `setPages`
    append in `drainUploadQueue`, so a queued upload that finishes after the user has navigated
    to a different document (via the sidenav) doesn't corrupt the wrong document's page list —
    a real correctness risk introduced by delaying processing, not present in the old
    synchronous-loop code.
  - Spinner text now shows a queued-count hint (`"Uploading... (N more waiting)"`) when more
    than one file is queued.
- `tests/e2e/workspace-upload-queue.pw.ts` (new, live-DB Playwright, 2 tests): both `POST
  .../pages` and `POST .../pages/[pageId]/ocr` are intercepted via `page.route()` with fake
  JSON responses (no real Blob storage or billed OpenAI call). Test 1: picker stays enabled and
  a second file queues while the first's OCR is artificially delayed, with a same-test proof
  that requests to both endpoints never overlap (page-order-collision safety, by construction).
  Test 2: the 10-page cap correctly rejects a third file that would overflow once two
  already-queued-but-not-yet-uploaded files are counted (not just the committed page count) —
  this is the scenario that caught the double-counting bug above during development.
- `PROJECT_STATUS.md`: added this fix's "Recent Fixes" entry, and corrected 3 other entries
  found stale during this pass — `fix/signed-in-new-document` (PR #39),
  `feat/chat-legal-disclaimer` (PR #38), and `fix/mobile-chat-scroll-overflow` (PR #37) were all
  still marked "not yet merged" despite `git log` showing all three merged to `main`.

### Notable test-writing gotchas (useful if extending this spec later)

- The upload box (`showUploadBox`/`hasActiveIntakeRoom`, unchanged pre-existing logic) hides
  itself entirely once `pageCount` actually *reaches* 10 while still `IN_PROGRESS` — so the
  queued-cap scenario can only be tested below that ceiling (used 8 existing + 2 queued + 1
  rejected, not 9+1+1).
- `getByText("Page N")` needs `{ exact: true }` — otherwise it also substring-matches the
  same page's (DOM-present-but-closed) `<dialog>` transcript heading, "Page N transcript",
  causing a strict-mode violation.
- A mocked OCR route's response `page.order` gets merged straight into client state
  (`setPages(prev => prev.map(...{...p, ...data.page}))`) — hardcoding it wrong (copy-paste
  leftover) silently overwrites the real order and was the first cause of a flaky-looking
  failure during development.

### Validation

- `tsc --noEmit`: clean.
- `npm run lint`: unchanged at the pre-existing 24-error/6-warning baseline (unrelated files).
- `npm test`: 301/301 (no vitest changes needed/added — no jsdom/component-render harness
  exists in this repo, see `tests/app/workspace/page.test.ts`'s header comment).
- `npx playwright test`: 10/10 passing across both projects (8 pre-existing + 2 new).

## Next steps

None outstanding on this task. Branch `fix/workspace-upload-queue` is not pushed; user
pushes/merges per CLAUDE.md's git workflow rules. No schema/migration changes in this fix.
