# Mobile OCR Test Plan — Conditions Translator

## 1. Goal

Validate that OCR on phone-uploaded images works correctly and
reliably in a Vercel preview / production environment for:

- Temporary sessions
- Signed-in sessions after ownership transfer

## 2. Setup

- Deploy current MVP to Vercel (see `DEPLOYMENT_VERCEL.md`).
- Confirm environment variables and Blob/Neon/OpenAI setup.
- Have a set of test documents ready:
  - Clean scans
  - Phone photos (different lighting/angles)
  - Edge cases (slightly blurry, cut off)

## 3. Test Cases

### Temporary Session OCR

1. Enter temporary mode.
2. Create & label a document.
3. Upload phone photo of a page.
4. Run OCR.
5. Accept page.
6. Repeat for multiple pages.
7. Finish document → PROCESSING → READY.
8. Ask grounded questions.

Log:
- Success/failure per image.
- OCR latency (approx seconds).
- Any errors (502, timeouts, unreadable-page rejections).

### Signed-In Session OCR

1. Create account or sign in.
2. Ensure ownership transfer of temporary documents.
3. Resume an IN_PROGRESS document as a signed-in user.
4. Upload phone photo.
5. Run OCR.
6. Accept page.
7. Finish document → PROCESSING → READY.

Log:
- Same metrics as above.
- Any ownership-related errors (404, NO_ACTIVE_SESSION).
- Differences in behavior vs temporary.

## 4. Edge Cases

- Very large/high-resolution phone images.
- Low-light or slightly blurry photos.
- Cut-off pages.
- Sideways images.

For each, record:
- Whether OCR succeeds.
- Whether UI blocks acceptance or allows it with advisory flags.
- Any timeouts or 502s.

## 5. Reporting

Summarize findings in:
- `docs/TESTING_GUIDE.md` (mobile OCR section)
- `.agent-memory/OPEN_QUESTIONS.md` for issues needing fixes
- Phase/branch notes for future OCR-improvement work