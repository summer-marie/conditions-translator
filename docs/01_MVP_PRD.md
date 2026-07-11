# Conditions Translator MVP PRD

> **Status:** Authoritative Product Requirements Document
>
> **Note:** This document reflects the approved product decisions from
> the collaborative design review and replaces the previous PRD as the
> project source of truth.

# 1. Vision

Conditions Translator is a privacy-first web application that helps
users understand supervision documents by translating confirmed document
content into plain language without giving legal advice or determining
compliance.

# 2. Product Principles

-   Privacy by design.
-   OCR-first MVP.
-   Source-grounded AI only.
-   Temporary-first experience.
-   No account required to try the product.
-   Chats are never permanently stored.
-   Documents, not pages, are the primary user object.

# 3. Core Concepts

Workspace - Temporary Workspace - Saved Workspace

Document - One document contains one or more uploaded pages.

Page - OCR is performed per page.

Section - AI generates document sections after the document is finished.

# 4. User Journey

Guest → Create Document → Upload Page → OCR → Confirm Page → Upload More
Pages → Finish Document → AI Sections → Ask Questions → Create Account →
Promote Documents → Dashboard

# 5. Document Model

A document is a user-labelled collection of one or more uploaded page
images.

Pages: - belong to exactly one document - are processed individually -
are confirmed individually

A document becomes available for AI only after the user explicitly
selects Finish Document.

# 6. AI Behaviour

-   AI answers only from confirmed document content.
-   AI never stores conversation history.
-   Active chat context exists only for the current session.
-   If one document exists, AI uses it.
-   If multiple documents exist, AI asks which document(s) to use.
-   AI never silently chooses between conflicting documents.

# 7. OCR Strategy

-   OCR-first MVP.
-   OpenAI Vision extracts visible text.
-   No canonical matching in MVP.
-   Printed text, handwriting, checkboxes and financial values may be
    used when sufficiently confident and confirmed.
-   Manual OCR editing is not supported.

# 8. Temporary and Saved Documents

Temporary mode: - No account required. - Documents expire 24 hours after
creation. - Activity does not extend expiry.

Saved mode: - Account required. - All completed temporary documents are
promoted when creating an account. - No re-upload required.

# 9. Privacy

-   Chats are not permanently stored.
-   Documents remain until deleted.
-   Users may delete documents.
-   Account deletion is part of the roadmap and product requirements.

# 10. Roadmap

Future versions may include: - Canonical document matching -
Public-record lookup - OCR tuning improvements - Enhanced rate limiting

# 11. Presentation MVP

The demonstration proves: 1. Temporary upload 2. Multi-page document 3.
OCR review 4. Finish document 5. AI-generated sections 6.
Source-grounded Q&A 7. Account creation 8. Automatic promotion of all
documents 9. Fresh chat after reopening 10. Document deletion

# Appendix

This document is based on the approved design-review decisions. The
approved decision log should be treated as a companion reference.
