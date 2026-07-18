# Conditions Translator MVP Implementation Roadmap

## Status
Updated build-order plan aligned with the frozen MVP PRD and approved supporting architecture decisions.

This roadmap is organized by dependency order rather than calendar days. Additional phases may be added as implementation evolves.

---

# 1. Purpose

This roadmap defines the recommended order for building the Conditions Translator MVP so that foundational systems are completed before dependent features.

The goal is to reduce rework, keep AI coding agents focused, and make it clear when a subsystem is ready for the next phase.

This roadmap supplements, and does not override, the authoritative documentation and precedence defined in `AGENTS.md`.

---

# 2. Build Principles

- Build foundational data and ownership rules before user-facing flows.
- Treat Documents as the central domain object.
- Keep temporary and saved Documents in shared tables with exclusive ownership.
- Build page intake before section generation.
- Require Documents to reach `READY` before AI chat.
- Use accepted page text as the factual source of truth.
- Keep chat temporary and server-side.
- Add testing where failure would create likely architectural rework.
- Defer visual polish until the end-to-end flow works.

---

# 3. Phase Overview

```text
Phase 1 — Project Foundation
    ↓
Phase 2 — Schema, ORM, and Ownership
    ↓
Phase 3 — Temporary Workspace and Document Intake
    ↓
Phase 4 — OCR and Page Acceptance
    ↓
Phase 5 — Finish Document and Section Generation
    ↓
Phase 6 — Temporary AI Chat and Safety Behavior
    ↓
Phase 7 — Account Creation and Ownership Transfer
    ↓
Phase 8 — Dashboard and Deletion
    ↓
Phase 9 — Cleanup, Reliability, and Demo Validation
    ↓
Phase 10 — UI Refinement and Documentation
```

---

# 4. Phase 1 — Project Foundation

## Goal

Create a stable project shell and configure the external services required by later phases.

## Build

- Initialize Next.js, React, and Tailwind.
- Establish the application directory structure.
- Configure local environment files.
- Configure Vercel project settings.
- Configure Neon Postgres.
- Configure Prisma.
- Configure Vercel Blob.
- Configure OpenAI server-side environment variables.
- Add project-level constants for:
  - temporary retention period;
  - maximum pages per Document;
  - maximum Documents per chat;
  - maximum confirmed-text characters per chat;
  - maximum chat message count.
- Create baseline error handling and logging utilities.
- Ensure secrets are never exposed through `NEXT_PUBLIC_` variables.
- Add a minimal health or environment verification route if useful.

## Completion Criteria

- Application runs locally.
- Production build can start.
- Database connection succeeds.
- Prisma can generate a client.
- Required server-side environment variables are documented.
- OpenAI, Neon, and Blob credentials remain server-side.

## Testing Advised

Testing is advised here because configuration errors can block every later phase.

Suggested checks:

- local app startup;
- production build;
- database connection;
- Prisma client generation;
- environment-variable validation;
- secret exposure review.

---

# 5. Phase 2 — Schema, ORM, and Ownership

## Goal

Implement the shared data model and enforce ownership before building workflows.

## Build

Create the core models for:

- User
- AuthSession
- TemporarySession
- Document
- Page
- OCR data
- Generated Section
- Section-to-source references
- ChatSession
- ChatMessage
- ChatSessionDocument
- ChatMessageSource
- Safety/Event metadata where required

Implement shared Document ownership:

```text
user_id
XOR
temporary_session_id
```

Required rules:

- A Document has exactly one owner.
- Temporary Documents require `expires_at`.
- Saved Documents do not expire automatically.
- Pages belong to exactly one Document.
- Chat sessions may reference only eligible Documents.
- Ownership is checked through centralized service functions.
- No saved Document query uses Document ID alone.

Implement Document lifecycle:

```text
IN_PROGRESS
→ COMPLETED
→ PROCESSING
→ READY
```

Deletion lifecycle:

```text
ACTIVE
→ DELETE_PENDING
→ DELETED
```

## Completion Criteria

- Migrations apply successfully.
- Shared ownership constraints are enforced.
- Temporary Documents can be created.
- Saved Documents can be created.
- Invalid dual ownership is rejected.
- Child records cannot exist without their required parent.
- Basic cascade or controlled deletion behavior is defined.

## Testing Advised — High Priority

ORM and ownership tests are strongly advised because schema mistakes will affect every later phase.

Suggested tests:

- migration applies from a clean database;
- Prisma model generation;
- temporary Document ownership;
- saved Document ownership;
- rejection of both owners;
- rejection of no owner;
- temporary `expires_at` requirement;
- page-to-Document relationship;
- ownership-scoped Document lookup;
- delete behavior for child records.

---

# 6. Phase 3 — Temporary Workspace and Document Intake

## Goal

Build the no-account workflow and the Document container before OCR integration.

## Build

- Create a temporary server-side session.
- Require privacy/safety notice acceptance before first upload.
- Allow the user to create and label a Document.
- Create the Document immediately in `IN_PROGRESS`.
- Allow one page upload at a time.
- Preserve page order.
- Enforce a maximum of 10 pages per Document.
- Support:
  - upload next page;
  - remove page;
  - restart page upload;
  - abandon Document.
- Keep the user in intake mode until **Finish Document**.
- Do not create an account requirement during temporary use.
- Do not expose incomplete Documents to AI.

## Completion Criteria

- A user can enter temporary mode without signing in.
- A labeled `IN_PROGRESS` Document is created.
- Pages attach to the correct Document.
- Page order remains stable.
- The 10-page limit is enforced.
- Temporary Document ownership and expiration are present.
- The user can leave and re-enter the current intake flow while the temporary session remains valid.

## Testing Advised

Suggested checks:

- temporary session creation;
- notice acceptance;
- Document creation;
- multi-page ordering;
- page deletion;
- 10-page limit;
- cross-session access denial;
- expiration check.

---

# 7. Phase 4 — OCR and Page Acceptance

> **Status note (2026-07-17/18):** The "Approved next OCR implementation" section below describes
> OCR transcription correction as approved-but-not-yet-built. It has since shipped (PR #20, merged
> to `main`) — `OcrResult.correctedText` and the `correctPageOcr` Server Action are implemented.
> See `.agent-memory/DECISIONS.md` and `docs/Decision_Log.md` ADR-001 for the current record; this
> phase section's text is left as historical planning detail, not rewritten.

## Goal

Convert uploaded page images into accepted source text using the approved page-level review flow.

## Prerequisites — Blob Credentials for Local Development

This phase requires Vercel Blob to store uploaded page images. The Blob store was
created with **private access** during Phase 1 setup. As of Vercel Blob GA (June 2026),
private stores use OIDC authentication — no static `BLOB_READ_WRITE_TOKEN` is generated.

**Before writing any Blob integration code, run:**

```powershell
vercel env pull .env.local
```

This populates `.env.local` with the correct `BLOB_STORE_ID` and related credentials
tied to your private store. Re-run if credentials appear to have rotated.

- Do NOT hardcode `BLOB_READ_WRITE_TOKEN` — it is not used for private stores.
- Do NOT commit the values pulled into `.env.local`.
- On Vercel infrastructure (production/preview), authentication is automatic via OIDC.

## Build

- Create a secure server-side OCR route.
- Validate supported image types:
  - JPG
  - JPEG
  - PNG
  - WEBP
- Validate file size.
- Preprocess images only as needed.
- Correct EXIF orientation where feasible.
- Send the page image to OpenAI Vision.
- Require structured OCR output.
- Validate the OCR response schema.
- Display:
  - original page preview;
  - extracted-text preview;
  - image-quality feedback.
- Offer:
  - Accept Page;
  - Re-upload Page;
  - Delete Page.
- Block acceptance for clearly:
  - blurry;
  - cut-off;
  - sideways;
  - incomplete;
  - unreadable pages.
- Provide practical retake guidance.
- Store accepted page text as the authoritative page source.
- Do not implement region-by-region review for MVP.
- Do not implement canonical template matching for MVP.

## Approved next OCR implementation — OCR transcription correction

The Project Owner approved a page-level **OCR transcription correction** workflow after the PRD was
frozen (see `docs/OCR_Master_Implementation_Plan.md` and `docs/Decision_Log.md` ADR-001). The
implemented Phase 4 flow above exposes read-only extracted text with Accept / Re-upload / Delete;
correction is **approved and documented but not yet built** and is the next OCR implementation
target. When sequenced, it must:

- Keep the uploaded image immutable; the user corrects the transcription, not the source document.
- Let the user correct the proposed transcription before page approval.
- Make corrected, approved text the accepted page text (the AI source of truth).
- Continue to keep raw or unaccepted OCR text out of AI context.
- Show a persistent user-responsibility notice during review.
- Decide, at build time, whether a raw-vs-accepted split or edit metadata is needed (schema change
  is out of scope until then — see `docs/04_Schema_Architecture.md`).

## Completion Criteria

- OCR occurs only server-side.
- The OpenAI key is not exposed.
- OCR output is schema-validated.
- A successful scan can be accepted.
- A failed or poor-quality scan cannot be accepted.
- Re-upload and delete paths work.
- Accepted text remains attached to the correct page.
- Unaccepted pages cannot reach Document AI context.

## Testing Advised — High Priority

Suggested image tests:

- clean scan;
- clean phone photo;
- screenshot;
- slightly angled page;
- low-light image;
- blurry image;
- cut-off page;
- sideways image;
- unsupported format;
- oversized image.

Also verify:

- API key is absent from browser bundles;
- raw source text is not written to logs;
- failed OCR cannot be accepted.

---

# 8. Phase 5 — Finish Document and Section Generation

## Goal

Close intake, generate user-facing organization, and move the Document to `READY`.

## Build

- Implement **Finish Document**.
- Verify the Document has at least one accepted page.
- Prevent additional page intake after completion unless the user explicitly restarts or creates a new Document.
- Change status:

```text
IN_PROGRESS
→ COMPLETED
→ PROCESSING
```

- Assemble all accepted page text in page order.
- Generate plain-language sections.
- Store sections and their source-page references.
- Display a processing screen.
- On success, change status to `READY`.
- On failure, change status to `PROCESSING_FAILED`.
- Provide Retry.
- Keep AI disabled until `READY`.
- Treat sections as user navigation and readability aids.
- Keep accepted page text as the factual source of truth.

## Completion Criteria

- Finish Document closes intake.
- Section generation starts automatically.
- Loading state appears.
- Successful processing produces sections.
- Every section is traceable to accepted pages.
- Failed section generation does not enable AI.
- Retry can move the Document to `READY`.
- Only `READY` Documents are selectable for chat.

## Testing Advised

Suggested tests:

- finish with one accepted page;
- finish with multiple pages;
- finish with no accepted pages;
- section-generation success;
- section-generation failure;
- retry after failure;
- source mapping;
- status transition enforcement.

---

# 9. Phase 6 — Temporary AI Chat and Safety Behavior

## Goal

Build an ephemeral, multi-Document chat that answers only from selected READY Documents.

## Build

- Create temporary server-side ChatSession storage.
- Allow selection of up to 3 READY Documents.
- Clearly display the selected Documents.
- Include in every AI request:
  - system safety rules;
  - full accepted text of all selected Documents;
  - Document and page labels;
  - active chat history;
  - latest user question.
- Enforce approximately 50,000 confirmed-text characters per chat.
- Enforce 20 user questions / 40 total messages.
- Warn before the chat limit is reached.
- Never silently truncate selected source text.
- Persist messages only for the active temporary chat session.
- Store temporary answer source references.
- Allow the user to scroll through earlier messages.
- Delete chat data when the session ends or expires.

Implement the approved behavioral foundation:

- safe explanations use source text and plain language;
- permission questions explain relevant requirements without granting permission;
- missing-source questions return no relevant source found;
- conflicting Documents show both sources and a neutral officer question;
- violation questions do not determine whether a violation occurred;
- general model knowledge may not fill supervision gaps.

## Completion Criteria

- A READY Document can be selected.
- Up to 3 Documents can be selected.
- Full selected source text is included.
- Follow-up questions use active chat context.
- Earlier messages remain scrollable.
- Answers identify supporting Documents/pages.
- Missing-source behavior works.
- Conflict behavior works.
- Chat is not permanently retained.
- Limits are enforced without truncating source text.

## Testing Advised — High Priority

Safety testing is strongly advised even if the full regression suite is deferred.

Suggested minimum prompts:

- safe explanation;
- permission question;
- prediction question;
- violation question;
- missing-source question;
- multi-Document conflict;
- prompt injection inside uploaded text;
- request to ignore source restrictions.

Also verify:

- answers are grounded in selected Documents;
- unrelated model knowledge is not used;
- chat expires correctly;
- messages do not appear in a new chat session.

---

# 10. Phase 7 — Account Creation and Ownership Transfer

## Goal

Allow the user to save the entire temporary workspace without interrupting the active chat.

## Build

- Implement email/password signup.
- Implement username/password signup.
- Support optional recovery email.
- Require explicit warning acknowledgment for username-only accounts without recovery email.
- Use secure password hashing.
- Use secure HTTP-only cookies.
- Add sign-in and sign-out.
- Trigger account creation/sign-in only when the user chooses to save.
- If account creation is canceled:
  - return to temporary mode;
  - preserve temporary Documents;
  - preserve active temporary chat;
  - continue normal expiration.
- On successful signup/sign-in:
  - transfer all temporary Documents in the workspace;
  - change ownership atomically;
  - clear Document expiration;
  - preserve pages, OCR, sections, and source references;
  - avoid duplicate Documents;
  - continue the same active chat.
- Keep chat temporary after ownership transfer.

## Completion Criteria

- Temporary use remains available without an account.
- Both account types work.
- Passwords are hashed and not logged.
- Secure session cookies are used.
- Cancel returns safely to temporary mode.
- All temporary Documents transfer on successful save.
- No duplicate Document is created.
- Active chat continues.
- Saved Documents remain after chat expiration.

## Testing Advised — High Priority

Suggested tests:

- email signup;
- username signup;
- recovery warning acknowledgment;
- sign-in failure behavior;
- secure cookie behavior;
- canceled signup;
- ownership transfer;
- transfer of multiple Documents;
- duplicate-click/idempotency handling;
- cross-user access denial;
- chat continuity after transfer.

---

# 11. Phase 8 — Dashboard and Deletion

## Goal

Provide minimal saved-Document management and complete deletion behavior.

## Build

- Show saved Documents in the dashboard.
- Display:
  - title;
  - type;
  - READY/processing state;
  - created date where useful.
- Open a saved Document.
- View generated sections.
- Start a fresh chat using selected READY Documents.
- Warn when similarly labeled Documents may conflict.
- Do not determine which Document is newer or controlling.
- Allow user-initiated deletion.

Deletion flow:

1. Remove user access immediately.
2. Mark deletion pending.
3. Delete related database children.
4. Delete stored page images/files.
5. Retry failed storage deletion.
6. Mark deletion complete.

User-facing copy may state that final storage cleanup can take a few minutes.

## Completion Criteria

- Saved Documents appear only for their owner.
- READY Documents can start new chats.
- Duplicate-label warning appears where intended.
- Deleted Documents disappear immediately.
- Deleted Documents cannot be selected in chat.
- Database cleanup runs.
- Blob cleanup runs or is queued.
- Failed cleanup can be retried.

## Testing Advised — High Priority

Suggested tests:

- dashboard ownership scope;
- open saved Document;
- start fresh chat;
- similarly labeled Document warning;
- delete database children;
- delete Blob objects;
- simulated Blob failure;
- retry path;
- deleted Document access denial.

---

# Phase E2E — End-to-End User Flow Testing and Stabilization

> **Status note (2026-07-17/18):** All fixes identified during the E2E testing pass described
> below are merged to `main` (verified: every non-`main` branch in the repo other than the active
> Phase 9 work is fully merged, zero unique commits ahead of `main`). The real-Vercel-deployment +
> real-phone-camera validation bar stated below has partial documented evidence (the mobile
> camera-first upload change) but has not been independently reconfirmed end-to-end.

Runs after Phase 8 and before Phase 9 Cleanup, Reliability, and Demo Validation. This phase validates all implemented user-facing flows (upload, OCR, READY, chat, account creation, transfer, dashboard, deletion) via realistic testing and fixes any blockers before cleanup and demo work.

Phase E2E is not considered complete until the app has also been exercised on a real Vercel deployment with real phone-camera uploads, not just local browser testing — OCR latency/quality and ownership-transfer behavior can differ on deployed infrastructure. See `docs/Deployment_Vercel.md` for deployment setup and `docs/Mobile_OCR_Tests_plan.md` for the mobile OCR test cases. Findings from this pass are recorded in `docs/TESTING_GUIDE.md` (§13, Deployment and Mobile Testing) and `.agent-memory/OPEN_QUESTIONS.md`.

---

# Phase Wireframe Implementation — UI Design Handoff

Between Phase E2E and Phase 9, finalized wireframes are added to `docs/Wireframe_Implementation.md`, which becomes the central reference for all UI/UX implementation tasks. See that document for:

- Links to final wireframe designs (Figma exports, PDFs, or mockups)
- Screen-by-screen implementation notes and responsive behavior specs
- State machine reference (loading, empty, success, error states)
- Component and page file locations
- Deferred items and open UX questions

All agents implementing features from wireframes must read `AGENTS.md`, `CLAUDE.md`, and session-memory files before starting, per the required reading order in `Wireframe_Implementation.md`.

---

# 12. Phase 9 — Cleanup, Reliability, and Demo Validation

> **Status note (2026-07-17/18, `feat/phase-9-cleanup-retention`):** Retention and cleanup are
> implemented — a serverless cron (Vercel Cron, `vercel.json`, hourly) hits a protected route
> (`app/api/cron/cleanup/route.ts`) running `lib/cleanup/sweep.ts`, which deletes expired chat
> sessions directly and, for each expired temporary session, cleans up its Documents via the
> existing Phase 8 deletion pipeline before removing the session row. No schema change was needed.
> See `docs/TESTING_GUIDE.md`'s Phase 9 entry for full test detail (unit + live-DB verification).
> Not yet independently confirmed: a real Vercel Cron invocation on a deployed environment (only a
> manual trigger was verified). This phase's own text below is left as historical planning detail.

## Goal

Validate retention, cleanup, and the complete end-to-end demo path.

## Build

- Implement 24-hour temporary retention.
- Implement cleanup through:
  - scheduled job;
  - serverless cron;
  - cleanup-on-access;
  - or a combination.
- Delete expired:
  - temporary sessions;
  - temporary Documents;
  - page files;
  - OCR data;
  - generated sections;
  - temporary chats and messages.
- Add minimal cleanup logs that contain no sensitive text.
- Add deletion retry handling.
- Review raw application logs for sensitive content.
- Verify no full permanent chat history exists.
- Verify source text is not logged.
- Verify secrets are server-side.
- Run the end-to-end controlled demo path.

## Demo Path

1. Enter temporary mode.
2. Create and label a Document.
3. Upload clear pages.
4. Accept each page.
5. Finish Document.
6. Generate sections.
7. Reach `READY`.
8. Ask grounded questions.
9. Create an account.
10. Transfer all temporary Documents.
11. Continue the active chat.
12. Open dashboard.
13. Delete a Document.
14. Verify immediate access removal.

## Testing Advised

Testing is advised for:

- temporary expiration;
- cleanup job;
- cleanup failure;
- deletion retry;
- full happy path;
- cross-user isolation;
- no-secret exposure;
- no-sensitive logging.

For a prerecorded demo, controlled clean documents are acceptable.

---

# 13. Phase 10 — UI Refinement and Documentation

## Goal

Improve usability only after the full functional path is working.

## Build

- Refine mobile navigation.
- Improve upload instructions.
- Improve processing and retry states.
- Improve section readability.
- Improve chat source display.
- Improve dashboard clarity.
- Add basic accessibility improvements.
- Add loading, empty, and error states.
- Update README links.
- Update known limitations.
- Update environment setup notes.
- Add direct links to:
  - PRD;
  - Architecture Overview;
  - OCR Specification;
  - Schema Specification;
  - AI Safety Specification;
  - Account & Temporary Access Specification;
  - Risk Register;
  - Launch Readiness Checklist.

## Completion Criteria

- Core mobile flow is understandable.
- One decision is presented per screen where practical.
- Errors explain what the user can do next.
- Documentation matches the implemented system.
- The demo flow is easy to record.

## Testing Advised

Suggested lightweight checks:

- mobile viewport;
- desktop viewport;
- keyboard navigation;
- readable source text;
- loading and error states;
- complete prerecorded demo rehearsal.

---

# 14. MVP Cut Line

Cut or defer first:

1. DOCX support.
2. PDF support.
3. HEIC/HEIF support.
4. Advanced image preprocessing.
5. Rich visual polish.
6. Copy/export.
7. Template recognition.
8. Retrieval optimization.
9. Persistent chat history.
10. Advanced analytics.
11. Multi-provider OCR fallback.

Do not cut:

- temporary no-account flow;
- shared ownership rules;
- accepted page source integrity;
- Finish Document lifecycle;
- section generation before `READY`;
- document-grounded AI;
- temporary chat behavior;
- ownership-scoped access;
- account transfer;
- deletion;
- temporary cleanup;
- basic AI safety behavior.

---

# 15. Agent Handoff Guidance

For each phase:

1. Give the coding agent the PRD.
2. Give it the Architecture Overview when available.
3. Give it the relevant subsystem specification.
4. Give it only the current phase of this roadmap.
5. Require it to report:
   - files changed;
   - assumptions;
   - tests run;
   - tests not run;
   - known limitations;
   - next dependency.

Agents should not implement later phases unless explicitly requested.

---

# 16. Dependencies

Authoritative requirements:
- `01_MVP_PRD.md`

Related specifications:
- Architecture Overview
- Schema Specification
- OCR Specification
- AI Safety & Persona Specification
- Account Creation & Temporary Access Specification
- Coding Risk Register
- Launch Readiness Checklist
