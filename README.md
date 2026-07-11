# Conditions Translator MVP

## Status
Project documentation index and developer starting point.

This README is intentionally lightweight. Product, architecture, and implementation details live in their dedicated specifications.

---

# Project Overview

Conditions Translator helps probation and parole clients better understand their supervision documents by translating them into plain language using AI grounded only in the user's uploaded documents.

---

# Documentation Index

See `AGENTS.md` for the canonical documentation authority hierarchy and required reading order.

1. MVP PRD (authoritative product requirements)
2. Architecture Overview
3. Supporting Specifications
   - OCR Specification
   - Schema Specification
   - AI Safety & Persona
   - Account Creation & Temporary Access
4. Planning Documents
   - Implementation Plan
   - Risk Register
   - Launch Readiness Checklist

---

# Core Architecture

- Documents are the central domain object.
- Users upload one page at a time.
- Pages are accepted individually.
- Selecting **Finish Document** completes document intake.
- Sections are generated automatically.
- Only READY documents are available to AI.
- AI answers are grounded only in selected uploaded documents.

---

# Tech Stack

Update this section as implementation progresses.

---

# Development Workflow

1. Review the PRD.
2. Review the Architecture Overview.
3. Review the relevant subsystem specification.
4. Implement.
5. Validate against the Launch Readiness Checklist.

---

# Cross References

This README intentionally summarizes the project.

Detailed behavior belongs in the dedicated specifications to avoid duplicated or conflicting documentation.

---

# Future

After implementation, add:

- Repository setup
- Installation steps
- Environment variables
- Local development
- Build/deployment
- Direct links to each specification
- Architecture diagram
- Revision history
