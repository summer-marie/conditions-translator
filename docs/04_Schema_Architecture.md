# Schema Architecture Decisions (Approved Draft)

## Core Model

User/Temporary Session
    └── Document
          ├── Pages
          ├── OCR
          ├── Sections
          └── Source References

## Ownership

Exactly one owner:
- user_id
OR
- temporary_session_id

## Document Lifecycle

IN_PROGRESS
→ COMPLETED
→ PROCESSING
→ READY

## Chat

Temporary server-side ChatSession.

Messages belong to ChatSession.

ChatSession references up to 3 completed documents.

## OCR Text: Raw vs. Accepted (architectural concept)

The OCR subsystem distinguishes, conceptually:

- **Raw OCR output** — machine-generated proposed transcription; never available to AI.
- **Accepted page text** — reviewed, optionally corrected, and approved by the user; the factual
  source of truth and the only text available to AI.

These are architectural concepts, not mandatory database fields. The current implementation stores
a single immutable `OcrResult.extractedText` that becomes the accepted page text on page approval;
`PageStatus.ACCEPTED` marks it immutable. There is no separate raw/accepted column and no edit
metadata (`acceptedAt`, `wasUserEdited`, OCR model id, prompt version) at present.

The approved **OCR transcription correction** workflow (see `docs/OCR_Master_Implementation_Plan.md`
§8 and `docs/Decision_Log.md` ADR-001) may later introduce a raw-vs-accepted split and/or the
suggested metadata. That schema decision is deferred to the implementation of the correction
workflow and is out of scope until then; no schema change is prescribed here.

## AI

Prompt contains:
- Safety instructions
- Active chat history
- Full accepted text of selected READY documents

Generated sections improve readability only.
Accepted page text remains the authoritative source.

Retrieval optimization is deferred until a future production release.
