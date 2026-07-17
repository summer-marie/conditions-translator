# Conditions Translator MVP Launch Readiness Checklist (Updated)

## Status
Updated to align with the approved PRD v4 architecture and supporting technical decisions.

This checklist is intended for MVP/demo readiness. Production hardening may require additional controls, monitoring, and operational review.

---

# 1. Document Intake

- [ ] User can create and label a new Document.
- [ ] User can upload one page at a time.
- [ ] Supported image types are validated on both client and server.
- [ ] Pages that fail minimum image-quality requirements cannot be accepted.
- [ ] Failed image-quality checks provide practical guidance for retaking the photo.
- [ ] User can accept, re-upload, or delete each page.
- [ ] Accepted pages remain attached to the correct Document.
- [ ] User can continue adding pages until selecting **Finish Document**.
- [ ] Document page limit is enforced at 10 pages.
- [ ] The system never silently truncates or ignores accepted pages.

## Image-quality guidance shown to users

- [ ] Capture the full page, including all edges.
- [ ] Use good lighting.
- [ ] Avoid shadows and glare.
- [ ] Hold the camera directly above the page.
- [ ] Make sure text is in focus.
- [ ] Retake the image if any important text is unreadable or cut off.

---

# 2. Document Processing States

The required lifecycle is:

```text
IN_PROGRESS
→ COMPLETED
→ PROCESSING
→ READY
```

Failure state:

```text
PROCESSING_FAILED
→ Retry
→ READY
```

Checklist:

- [ ] AI is unavailable while the Document is `IN_PROGRESS`.
- [ ] Selecting **Finish Document** closes intake and moves the Document to `COMPLETED`.
- [ ] Section generation begins immediately after completion.
- [ ] The UI shows a loading state while sections are being generated.
- [ ] The Document becomes `READY` only after section generation succeeds.
- [ ] Only `READY` Documents may be selected for AI chat.
- [ ] If section generation fails, AI remains disabled.
- [ ] Processing failure displays a clear error and Retry action.
- [ ] The system never bypasses section generation by using raw OCR directly.

Suggested user-facing loading copy:

> Organizing your document  
> We’re creating sections from your accepted pages. This may take a moment.

Suggested failure copy:

> We couldn’t finish organizing this document. Please try again.

---

# 3. Temporary Workspace

- [ ] User can use the app without creating an account.
- [ ] User can create Documents, upload pages, finish Documents, generate sections, and ask questions in temporary mode.
- [ ] Temporary Documents are owned by the active temporary session.
- [ ] Temporary Documents include an expiration timestamp.
- [ ] Temporary data expires automatically according to the configured retention policy.
- [ ] User can manually delete temporary Documents before expiration.
- [ ] Canceling account creation returns the user to the temporary workspace.
- [ ] Canceling account creation does not delete current Documents or end the active chat.

---

# 4. Account Creation and Save Flow

- [ ] Account creation is required only when the user chooses to save work.
- [ ] Selecting **Save Document** prompts the user to create an account or sign in.
- [ ] Completing account creation transfers all temporary Documents in the workspace.
- [ ] Pages, OCR data, sections, and source references remain attached to the same Documents.
- [ ] Ownership changes atomically from temporary session to user.
- [ ] Expiration is cleared for saved Documents.
- [ ] No duplicate Documents are created during transfer.
- [ ] The active chat continues seamlessly after account creation.
- [ ] Chat remains temporary even after account creation.
- [ ] Saved Documents appear in the authenticated dashboard.

---

# 5. AI Chat Readiness

- [ ] Chat is available only after at least one selected Document is `READY`.
- [ ] User may select up to 3 Documents for a chat.
- [ ] The UI clearly shows which Documents are active in the chat.
- [ ] Adding a Document affects future answers only.
- [ ] Earlier answers are not silently rewritten.
- [ ] Active chat history remains scrollable during the current session.
- [ ] Chat history is not preserved across separate chat sessions.
- [ ] Chat uses temporary server-side storage.
- [ ] Chat session expiration and cleanup are implemented.
- [ ] Maximum chat length is enforced at 20 user questions / 40 total messages.
- [ ] A warning appears before the message limit is reached.
- [ ] Maximum confirmed source text is enforced at approximately 50,000 characters per chat.
- [ ] The system never silently truncates selected Document text.

Suggested long-chat warning:

> This chat is getting long. For the clearest answers, you may want to start a fresh chat soon.

---

# 6. Source Grounding

- [ ] Each AI request includes the full accepted text from all selected `READY` Documents.
- [ ] Each AI request includes the active chat history needed for conversational context.
- [ ] General AI knowledge is not used to supply missing supervision rules, permissions, obligations, or conclusions.
- [ ] If the selected Documents do not contain relevant source material, the app says no relevant source was found.
- [ ] Every substantive answer identifies the source Document.
- [ ] Page-level source references are available where applicable.
- [ ] Conflicting Documents are identified and flagged.
- [ ] The AI does not decide which conflicting Document controls.
- [ ] Generated sections are used for user clarity and navigation, not as the sole factual source.

---

# 7. OCR and Page Acceptance

- [ ] OCR runs only through a secure server-side route.
- [ ] OpenAI API keys are not exposed to the client.
- [ ] OCR results are validated before display.
- [ ] The uploaded image is preserved as the immutable visual source.
- [ ] User sees the uploaded page preview and extracted-text preview.
- [ ] Page acceptance is a quick page-level quality check.
- [ ] Region-by-region OCR review is not required for MVP.
- [ ] Unaccepted pages are excluded from Document AI context.
- [ ] Raw or unaccepted OCR text never reaches AI context.
- [ ] Failed OCR blocks page acceptance.
- [ ] Obviously blurry, cut-off, sideways, incomplete, or unreadable pages cannot be accepted.
- [ ] User receives clear instructions for improving a failed upload.

## OCR transcription correction (approved architecture — verify once implemented)

These items cover the approved OCR transcription correction workflow. It is approved and
documented but not yet implemented (see `docs/OCR_Master_Implementation_Plan.md` and
`docs/Decision_Log.md` ADR-001); verify these before release once the workflow is built.

- [ ] User can correct the proposed OCR transcription before approving a page.
- [ ] Correction applies to the transcription, never to the uploaded image or the legal document.
- [ ] Corrected, approved text becomes the accepted page text (the AI source of truth).
- [ ] A persistent notice communicates that the user is responsible for confirming the
      transcription reflects the uploaded page.

---

# 8. Sections

- [ ] Sections are generated after **Finish Document**.
- [ ] Sections reorganize the Document into understandable categories.
- [ ] Sections remain traceable to accepted page content.
- [ ] Sections are not treated as a replacement for accepted source text.
- [ ] Section-generation failures are retryable.
- [ ] AI remains disabled until section generation completes successfully.

---

# 9. Deletion

- [ ] User can delete temporary and saved Documents.
- [ ] Deleted Documents become inaccessible immediately.
- [ ] Deletion removes or schedules removal of:
  - [ ] pages
  - [ ] uploaded files
  - [ ] OCR data
  - [ ] extracted text
  - [ ] generated sections
  - [ ] summaries
  - [ ] source references
  - [ ] document-specific links and metadata
- [ ] Object-storage cleanup can continue asynchronously.
- [ ] Failed deletion steps are retried by backend cleanup logic.
- [ ] The UI may explain that final removal can take a few minutes.
- [ ] Deleted Documents cannot remain selectable in active chat.
- [ ] Related chat source references become unavailable or the affected chat session is ended safely.

Suggested deletion copy:

> Document deleted. Final removal from storage may take a few minutes.

---

# 10. Duplicate or Updated Terms

- [ ] Uploading similarly labeled Documents triggers a warning.
- [ ] The app does not automatically decide which Document is newer or controlling.
- [ ] The user is advised to delete older Documents that are no longer current.
- [ ] Old Documents are deleted only by explicit user action.
- [ ] The app does not implement Document versioning for MVP.

Suggested warning:

> You already have a Document with a similar label. Keeping both may cause conflicting answers. Delete the older Document if it is no longer current.

---

# 11. Security and Privacy

- [ ] Every Document has exactly one owner: user or temporary session.
- [ ] A Document may never have both owners simultaneously.
- [ ] Document access is always scoped by owner.
- [ ] The app never queries saved Documents by ID alone.
- [ ] Temporary Documents require expiration.
- [ ] Saved Documents do not expire automatically.
- [ ] Full chat history is not stored permanently.
- [ ] Raw Document text is not written to application logs.
- [ ] Full user questions and full AI responses are not written to persistent logs.
- [ ] Secrets are stored only in secure server-side environment variables.
- [ ] Cross-user and cross-session access tests pass.

---

# 12. MVP Demo Acceptance

The MVP demo is ready when the following complete successfully end-to-end:

- [ ] Temporary user starts without an account.
- [ ] User creates and labels a Document.
- [ ] User uploads and accepts one or more clear pages.
- [ ] User selects **Finish Document**.
- [ ] Section generation completes.
- [ ] Document reaches `READY`.
- [ ] User starts a chat using the ready Document.
- [ ] AI answers only from selected Document content.
- [ ] User can scroll through earlier answers in the active chat.
- [ ] User creates an account or signs in to save work.
- [ ] All temporary Documents transfer to the account.
- [ ] The active chat continues without interruption.
- [ ] Saved Documents appear in the dashboard.
- [ ] User deletes a Document.
- [ ] Deleted Document disappears immediately from user access.
- [ ] Temporary session expiration and cleanup are demonstrated or verified.

For the prerecorded demo, controlled sample files and clean scans are acceptable. Visual polish may remain limited as long as the complete workflow functions correctly.

---

# 13. Demo Blockers

Do not record or present the MVP demo if any of the following are true:

- [ ] An unaccepted or incomplete page can reach AI context.
- [ ] A Document can be used by AI before it reaches `READY`.
- [ ] Section-generation failure is silently bypassed.
- [ ] AI answers from general knowledge when the source Documents do not contain the answer.
- [ ] Selected source text is silently truncated.
- [ ] A user can access another user’s or session’s Documents.
- [ ] Account creation duplicates rather than transfers Documents.
- [ ] Saved work disappears when the active chat ends.
- [ ] Chat history becomes permanent.
- [ ] Document deletion leaves the Document accessible to the user.
- [ ] OpenAI secrets are exposed client-side.
- [ ] The main end-to-end workflow cannot complete successfully.

---

# Dependencies

Authoritative requirements:
- `01_MVP_PRD.md`

Related specifications:
- OCR Specification
- Schema Specification
- Account Creation and Temporary Access Specification
- AI Safety and Persona Specification
- Architecture Decision Log
