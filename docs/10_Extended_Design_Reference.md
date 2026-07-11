# Extended Design Reference

> **Status:** Design Reference (Non-Authoritative)
>
> This document explains the reasoning behind the product decisions in
> `01_MVP_PRD.md`. The PRD is the authoritative source of truth. This
> document captures architectural intent, trade-offs, implementation
> guidance, UX philosophy, and future evolution.

# 1. Purpose

This document exists to answer **why** decisions were made.

Use it when: - implementing features; - designing the database; -
refining prompts; - reviewing pull requests; - extending the
application.

Do not use it to redefine product requirements.

------------------------------------------------------------------------

# 2. Product Philosophy

Conditions Translator is intentionally **document-centric**, not
chatbot-centric.

The product helps people understand supervision documents by translating
confirmed source material into plain language.

The AI is an interpreter, not a decision maker.

It must never determine whether someone is compliant, predict legal
outcomes, or invent missing information.

------------------------------------------------------------------------

# 3. Core Mental Model

Everything revolves around a **Document**.

Document - contains Pages - Pages produce OCR - OCR produces Regions -
Regions produce AI Sections - Sections support AI Answers

This hierarchy mirrors how users naturally think about their paperwork.

------------------------------------------------------------------------

# 4. Why Documents Own Pages

Early concepts centered on uploaded files.

The revised design treats files as implementation details.

A document is the meaningful object.

Benefits: - multi-page support; - simpler dashboard; - better
summaries; - better citations; - easier lifecycle management.

------------------------------------------------------------------------

# 5. Temporary Workspace Philosophy

Temporary mode is not a limited version.

It is a complete experience without permanent storage.

Users should be able to: - upload documents; - review OCR; - ask
questions; - understand conditions.

Creating an account is only required when they want persistence.

------------------------------------------------------------------------

# 6. Promotion Instead of Re-upload

A confirmed temporary document should become a saved document without
requiring another upload.

Reasons: - better UX; - avoids duplicate OCR; - preserves review
effort; - maintains source lineage.

Promotion creates new permanent ownership while retiring the temporary
copy.

------------------------------------------------------------------------

# 7. OCR Philosophy

The MVP is OCR-first.

Reasons: - fastest implementation; - no dependence on external public
records; - works across jurisdictions; - keeps architecture simple.

Version 2 may introduce canonical forms and public record lookups.

------------------------------------------------------------------------

# 8. Confirmation Philosophy

Confirmation does not mean: - legal agreement; - legal understanding; -
legal accuracy.

It means:

"The extracted content accurately represents what appears on this page
and may be used as AI source material."

------------------------------------------------------------------------

# 9. AI Sections

Sections are generated after Finish Document.

Users never organize sections manually.

Sections are navigation aids derived from confirmed content.

Every section should remain traceable back to: - document - page - OCR
region

------------------------------------------------------------------------

# 10. Chat Philosophy

Chats are intentionally ephemeral.

Reasons: - protects privacy; - reduces retained sensitive data; - keeps
retrieval source-grounded; - avoids stale AI memory.

Conversation context exists only while the current chat is active.

Every new session begins with fresh retrieval from confirmed documents.

------------------------------------------------------------------------

# 11. Privacy by Design

Privacy decisions intentionally reduce stored information.

Persist: - documents; - OCR; - sections; - summaries.

Do not persist by default: - chat history; - AI responses; - prompt
history.

------------------------------------------------------------------------

# 12. Safety Philosophy

The safest answer is not always the longest answer.

The assistant should: - explain; - clarify; - cite sources; - admit
uncertainty.

It should not: - guess; - speculate; - encourage evasion; - replace
legal advice.

------------------------------------------------------------------------

# 13. UX Principles

The workflow should feel guided rather than technical.

Key principles: - one decision per screen; - never surprise users; -
never redirect automatically after confirming a page; - keep users in
upload mode until Finish Document.

------------------------------------------------------------------------

# 14. Data Model Rationale

Primary entities:

User Workspace Document Page OCR Run OCR Region Section Interaction
Safety Event

Relationships should reflect ownership first and processing second.

------------------------------------------------------------------------

# 15. Future Evolution

Version 2 ideas: - canonical document matching; - public-record
assistance; - richer OCR tuning; - analytics; - export; - additional
document types.

These should extend the architecture without replacing the core document
model.

------------------------------------------------------------------------

# 16. Engineering Guidelines

Prefer: - explicit relationships; - immutable source records; -
idempotent promotion; - server-side authorization; - short-lived access
URLs; - background cleanup.

Avoid: - duplicated source text; - silent AI assumptions; - permanent
chat logs; - mixing temporary and saved ownership.

------------------------------------------------------------------------

# 17. Decision Summary

Major approved decisions:

-   Document-first architecture.
-   Multi-page documents.
-   OCR-first MVP.
-   AI-generated sections.
-   Privacy-first conversations.
-   Temporary workspace.
-   Automatic promotion to saved profile.
-   No re-upload.
-   Fresh chats every session.
-   Product roadmap separated from implementation enhancements.

------------------------------------------------------------------------

# 18. Guidance for Future Contributors

When adding features, ask:

1.  Does this preserve privacy?
2.  Does this keep documents as the primary entity?
3.  Can every AI answer still be traced to confirmed source material?
4.  Is this a product requirement or merely an implementation choice?
5.  Does it belong in the PRD or only in architecture?

If those questions are answered consistently, the project should remain
cohesive as it grows.
