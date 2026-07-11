# OpenAI Vision OCR Specification for Conditions Translator MVP (Updated)

## Status
**Reviewed and updated after architecture review.**

This document defines the OCR subsystem only. Product requirements remain defined in the PRD.

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

Each page follows:

1. Upload page
2. Validate image
3. OCR
4. Display image preview and extracted text preview
5. User chooses:
   - Accept Page
   - Re-upload Page
   - Delete Page
6. Continue uploading or Finish Document

Users are not expected to review OCR region-by-region during the MVP.

---

## 5. Page Acceptance

Confirmation means:

> "Does this page appear complete and accurate enough to include in my document?"

Acceptance is a page-level quality check, not a legal or OCR verification.

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
- Page-level acceptance replaces region-by-region review.
- Documents own pages.
- OCR is one stage of the Document Intake Pipeline.
