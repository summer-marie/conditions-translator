# Account Creation & Temporary Access Specification (Updated)

## Status
Updated to align with the approved MVP architecture.

This specification defines account ownership, temporary access, and document persistence behavior. Product requirements remain defined in the PRD.

---

# Core Principles

- Users may use the application without creating an account.
- Creating an account is only required when the user chooses to save their work.
- A temporary workspace and a saved workspace share the same Document model.
- Chat sessions are temporary and are never stored as permanent history.

---

# Ownership Model

Every Document has exactly one owner.

Owner is either:

- `temporary_session_id`
OR
- `user_id`

Never both.

Ownership changes through a single atomic transfer.

---

# Temporary Workspace

Temporary users may:

- Create documents.
- Upload pages.
- Accept pages.
- Finish documents.
- Generate document sections.
- Ask questions.
- Use multiple completed documents in one chat.

Temporary data expires automatically according to the configured retention policy.

---

# Saving Work

When the user selects **Save Document**:

1. Prompt for Create Account or Sign In.
2. If completed successfully:
   - Transfer ownership of ALL temporary documents.
   - Transfer accepted pages.
   - Transfer OCR data.
   - Transfer generated sections.
   - Continue the active chat session.
3. Remove temporary ownership.
4. Clear document expiration.

No duplicate documents are created.

---

# Canceling Account Creation

If the user cancels account creation:

- Return to the temporary workspace.
- Continue the active chat.
- Keep all temporary documents.
- Allow the user to save again later.
- Temporary expiration continues normally.

---

# Active Chat

Creating an account must not interrupt the active conversation.

The current temporary chat continues seamlessly after ownership transfer.

Chat history remains temporary and is deleted when the chat session expires or ends.

Documents remain saved.

---

# Shared Data Model

Temporary and saved documents use the same underlying tables.

Differences are enforced through:

- ownership
- authorization
- expiration
- cleanup

not duplicate schemas.

---

# Security Rules

- Every document belongs to exactly one owner.
- Authorization is always performed through ownership.
- Never query documents by document ID alone.
- Temporary documents require expiration.
- Saved documents never expire automatically.

---

# Dependencies

Authoritative Requirements:
- 01_MVP_PRD.md

Related Specifications:
- OCR Specification
- Schema Specification
- AI Safety Specification
- Launch Readiness Checklist
