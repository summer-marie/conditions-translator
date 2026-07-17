# OCR Master Implementation Plan & Architectural Decision Record (ADR)

**Project:** Conditions Translator
**Status:** Approved
**Version:** 1.0
**Owner:** Project Owner
**Date:** July 2026

---

# 1. Purpose

This document is the authoritative implementation plan for the OCR subsystem of Conditions Translator.

Its purpose is to define the approved architecture, implementation strategy, testing methodology, and future direction for OCR so that all repository documentation and implementation remain synchronized.

Within the repository’s established documentation authority hierarchy, this document is the approved implementation authority for OCR-specific planning and execution. It governs downstream OCR specifications, roadmap details, testing plans, schema documentation, and implementation decisions. It does not silently override the frozen PRD, `AGENTS.md`, security requirements, ownership rules, document lifecycle requirements, or AI-grounding invariants. Any direct conflict must be identified, recorded in the Decision Log, and resolved through the project’s approved architecture-change process.


This document exists to prevent architectural drift, reduce documentation inconsistencies, and provide a single source of truth for future development.

---

# 2. Scope

This document governs:

* OCR architecture
* OCR implementation decisions
* OCR user workflow
* OCR testing strategy
* OCR data flow
* OCR acceptance workflow
* OCR-related documentation updates

This document **does not** redefine overall product goals established by the PRD. Instead, it defines the approved implementation strategy for achieving those goals.

---

# 3. Guiding Principles

The following principles govern every OCR-related implementation decision.

## 3.1 OCR is Assistive

OCR provides a proposed transcription of uploaded documents.

OCR is never considered legally authoritative.

---

## 3.2 Users Make Final Decisions

The user—not the OCR model—determines the final accepted transcription.

The system assists the user in reviewing extracted text but never claims correctness.

---

## 3.3 Accepted Text is the Source of Truth

Only accepted page text may be used by the AI assistant.

Draft OCR output must never be included in prompts or retrieval.

---

## 3.4 Images Remain Immutable

Uploaded images are preserved exactly as submitted.

Users never edit the original document.

---

## 3.5 Grounded AI is Preserved

Grounded AI behavior remains unchanged.

Every AI response must originate exclusively from accepted document text.

---

# 4. Non-Negotiable Architectural Decisions

The following decisions are approved and shall not be changed without an explicit architecture review.

## Decision 1

Uploaded images remain immutable.

---

## Decision 2

OCR generates proposed transcriptions only.

---

## Decision 3

Users edit OCR transcriptions—not original documents.

---

## Decision 4

Page acceptance replaces section acceptance.

Users approve an entire page after review.

---

## Decision 5

Accepted page text becomes the application's authoritative representation.

---

## Decision 6

AI never consumes unaccepted OCR output.

---

## Decision 7

Image uploads remain the only supported document format for MVP.

PDF and DOCX remain future enhancements.

---

# 5. Approved MVP Scope

The current MVP includes:

* Image uploads
* Mobile uploads
* Camera photos
* Gallery images
* Multi-page image documents
* Page-by-page OCR
* Page review
* Page approval
* Grounded AI

The MVP explicitly excludes:

* PDF uploads
* DOCX uploads
* Automatic handwriting interpretation
* User edit history
* OCR confidence visualization
* OCR preprocessing pipeline
* Batch OCR optimization

These items remain future work.

---

# 6. OCR Workflow

The approved workflow is:

1. User uploads an image.
2. Image is stored unchanged.
3. OCR processes the image.
4. OCR generates proposed page transcription.
5. User reviews extracted page.
6. User corrects OCR mistakes if necessary.
7. User approves the page.
8. Approved page text becomes accepted text.
9. Only accepted text becomes available to AI.
10. AI remains grounded exclusively in accepted text.

---

# 7. OCR Review & Correction

## Philosophy

Users are correcting OCR mistakes.

They are **not editing legal documents.**

The uploaded image always remains the authoritative visual record.

---

## Editable Content

Users may correct:

* Handwriting
* OCR omissions
* Incorrect characters
* Dates
* Dollar amounts
* Names
* Checkbox interpretations
* Short handwritten notes
* Other transcription errors

---

## User Responsibility

Before approving a page, users are responsible for confirming that the transcription accurately reflects the uploaded document.

The application assists in transcription but does not verify legal accuracy.

A persistent informational notice shall communicate this responsibility during the review process.

---

## Accepted Text

After approval:

* accepted text replaces draft OCR
* accepted text becomes AI context
* accepted text becomes searchable
* accepted text becomes the application's working representation

---

# 8. Data Model Decisions

The implementation should distinguish between machine-generated output and accepted user content.

Recommended logical fields include:

Original Image

* immutable uploaded image

Raw OCR Output

* machine generated
* never used by AI

Accepted Text

* reviewed by user
* AI source of truth

Suggested metadata:

* acceptedAt
* wasUserEdited
* OCR model identifier
* OCR prompt version

Exact implementation details may evolve while preserving these concepts.

---

# 9. OCR Testing Strategy

Development shall proceed using evidence-based testing rather than assumptions.

---

## Phase 1 — Baseline

Test the current implementation without modifying OCR.

Document:

* upload success
* latency
* extraction quality
* page approval
* AI grounding

---

## Phase 2 — Real Device Testing

Test on physical mobile devices using:

* clean pages
* angled photos
* low lighting
* blurry photos
* rotated pages
* partially cropped pages

---

## Phase 3 — Handwriting

Evaluate:

* neat handwriting
* difficult handwriting
* mixed printed and handwritten pages
* handwritten dates
* handwritten names
* handwritten conditions
* handwritten monetary values
* handwritten checkboxes

---

## Phase 4 — User Correction

Verify:

* corrections persist
* corrections become accepted text
* accepted text reaches AI
* rejected OCR never reaches AI

---

## Phase 5 — Regression Testing

Verify existing functionality remains intact.

---

# 10. Failure Classification

All OCR issues should be categorized before solutions are implemented.

Categories include:

* Upload failure
* Image quality
* OCR extraction
* Prompt design
* Model limitations
* Validation failures
* User workflow issues
* Grounding issues

Solutions should target the correct category rather than assuming the OCR model is the root cause.

---

# 11. Documentation Update Requirements

Once this document is approved, repository documentation shall be synchronized.

Expected updates include:

* OCR specification
* OCR testing plan
* Mobile testing plan
* Architecture documentation
* Schema documentation (if required)
* Decision log
* Project status
* Implementation roadmap (where applicable)

The Product Requirements Document should **not** be modified casually.

Any change affecting product scope shall follow the project's documented decision process.

---

# 12. Future Scope

The following items are intentionally deferred:

* PDF uploads
* DOCX uploads
* Automatic page preprocessing
* OCR confidence visualization
* User edit history
* OCR model comparison framework
* Automatic handwriting confidence scoring
* Batch OCR optimization
* Advanced document parsing

These items are outside the current MVP.

---

# 13. Architectural Invariants

The following rules define the permanent architecture of the OCR subsystem.

1. Original uploaded images remain immutable.

2. OCR is assistive rather than authoritative.

3. Users correct OCR transcriptions—not source documents.

4. Accepted page text is the only text available to AI.

5. AI responses remain fully grounded in accepted text.

6. Users approve pages rather than individual document sections.

7. OCR failures must fail safely.

8. Future document formats must integrate into the same page acceptance workflow.

These invariants shall guide future architectural decisions.

---

# 14. Success Criteria

The OCR subsystem is considered production-ready when all of the following are true:

* Mobile image uploads work reliably.
* OCR successfully extracts common court documents.
* Users can review and correct transcription errors before approval.
* Handwritten additions can be corrected by users.
* Users approve one page at a time.
* Original images remain unchanged.
* Accepted page text becomes the only AI context.
* Grounded AI answers exclusively from accepted text.
* OCR failures degrade gracefully.
* Mobile OCR testing passes approved scenarios.
* Repository documentation is synchronized with this implementation plan.

---

# 15. Maintenance

This document is the long-term implementation authority for the OCR subsystem.

Future OCR architectural decisions should update this document only when they affect long-term system behavior.

Routine implementation choices should instead be recorded in the project's Decision Log.

The goal is to maintain a single authoritative architectural reference while avoiding duplication across repository documentation.
