# OpenAI Vision OCR Specification for Conditions Translator MVP (Updated)

## Status
**Reviewed and updated after architecture review.**

This document defines the OCR subsystem's implementation behavior only. Product requirements remain
defined in the PRD. `docs/OCR_Master_Implementation_Plan.md` is the authoritative OCR architecture
document; where architecture and implementation behavior must stay aligned, this specification
defers to it rather than restating it.

> **Approved architecture note (post-PRD-freeze).** The Project Owner approved the OCR transcription
> correction workflow after the PRD was frozen. This supersedes the PRD's "Manual OCR editing is not
> supported" statement for the OCR subsystem only. See `docs/Decision_Log.md` (ADR-001, OCR
> transcription correction) and `docs/OCR_Master_Implementation_Plan.md`. The workflow is
> **approved and documented but not yet implemented** (see §4).

---

# Architectural Principles

## 1. OCR is not the product

OCR is one stage in the **Document Intake Pipeline**.

```text
Create Document
    ↓
Upload Page
    ↓
Validate Image
    ↓
OCR
    ↓
Page Preview
    ↓
Accept / Re-upload / Delete
    ↓
Repeat
    ↓
Finish Document
    ↓
Document Ready
    ↓
AI Sections & Questions
```

---

## 2. Source of Truth

The authoritative source for AI is:

> User-accepted OCR extracted from uploaded pages belonging to a completed document.

Template recognition, when added in the future, is advisory only and never replaces confirmed uploaded text.

---

## 3. Document Model

A Document is a user-labeled collection of one or more pages.

Example:

Document: "Parole Terms"

- Page 1
- Page 2
- Page 3

A document exists as soon as the user creates and labels it.

States:

- In Progress
- Completed
- Deleted

Only completed documents are available for AI.

---

## 4. Page Workflow

The uploaded image is the **immutable uploaded image** — the authoritative visual record. Users
never edit the source document; they correct the proposed OCR transcription of it.

Each page follows:

1. Upload page
2. Validate image
3. OCR (produces a **proposed transcription**)
4. Display image preview and extracted-text preview
5. **OCR transcription correction** — the user may correct transcription errors before approving
   the page (see §5)
6. User chooses:
   - Accept Page (page approval)
   - Re-upload Page
   - Delete Page
7. Continue uploading or Finish Document

Users are not expected to review OCR region-by-region during the MVP. Correction is a whole-page
transcription review, not a region-by-region verification.

**Implementation status.** The upload → validate → OCR → preview → Accept / Re-upload / Delete path
is implemented, with extracted text shown read-only. Step 5, **OCR transcription correction**, is
**approved and documented but not yet implemented** — it is the approved next OCR implementation.
See `docs/OCR_Master_Implementation_Plan.md` and `docs/Decision_Log.md` ADR-001.

---

## 5. Page Acceptance

Confirmation means:

> "Does this page appear complete and accurate enough to include in my document?"

Acceptance is a page-level check, not a legal verification. The application assists with
transcription but does not verify legal accuracy.

### User responsibility and notice

Before approving a page, the user is responsible for confirming that the (optionally corrected)
transcription accurately reflects the uploaded image. A persistent informational notice shall
communicate this responsibility during review.

### Raw OCR vs. accepted page text (architectural concept)

The subsystem distinguishes two logical kinds of text (concepts, not mandated database fields):

- **Raw OCR output** — machine-generated proposed transcription. Never reaches AI context.
- **Accepted page text** — reviewed, optionally corrected, and approved by the user. This is the
  factual source of truth and the only text available to AI.

Current implementation stores a single immutable `OcrResult.extractedText` that becomes the
accepted page text on approval (no separate raw/accepted columns or edit metadata yet). Whether the
correction workflow introduces a raw-vs-accepted split or edit metadata (`acceptedAt`,
`wasUserEdited`, model id, prompt version) is an implementation decision deferred to the build of
that workflow. See `docs/04_Schema_Architecture.md` and `docs/OCR_Master_Implementation_Plan.md` §8.

---

## 6. Finish Document

Selecting Finish Document:

- closes document intake,
- marks the document Completed,
- enables section generation,
- enables document-grounded AI.

Only accepted pages from completed documents are available to AI.

---

## 7. Template Recognition (Future)

Future template recognition may:

- recognize known forms,
- improve validation,
- identify possible missing pages,
- assist quality checks.

It must never replace user-confirmed uploaded text.

---

## 8. Responsibilities

Frontend:
- Create document
- Upload pages
- Show preview
- Accept/Re-upload/Delete
- Finish document

Backend:
- Validate upload
- Run OCR
- Return structured results
- Store accepted pages
- Assemble completed document

AI:
- Operates only on completed documents.

---

## Architecture Decisions Incorporated

- OCR-first architecture.
- Template recognition is optional and future.
- The uploaded image is immutable; OCR output is a proposed transcription.
- OCR transcription correction is approved (page-level, whole-page review; not region-by-region).
- Page-level approval; only accepted page text reaches AI, and raw/unaccepted OCR never does.
- Documents own pages.
- OCR is one stage of the Document Intake Pipeline.

**On "page approval replaces section acceptance"** (Master Plan Decision 4): the application never
implemented section-level *acceptance*. Generated sections are post-Finish readability aids and are
not user-approved. Page approval is therefore the only acceptance step, consistent with the Master
Plan.
