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

## AI

Prompt contains:
- Safety instructions
- Active chat history
- Full accepted text of selected READY documents

Generated sections improve readability only.
Accepted page text remains the authoritative source.

Retrieval optimization is deferred until a future production release.
