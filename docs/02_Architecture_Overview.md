# Architecture Overview

## Status
Authoritative high-level architecture guide for the Conditions Translator MVP.

Read this after the PRD and before any subsystem specification.

---

# Purpose

This document explains how the application is organized, how data flows through the system, and how the supporting specifications fit together.

Product requirements belong in the PRD.
Implementation details belong in the supporting specifications.

---

# System Philosophy

- The Document is the central domain object.
- Accepted page text is the source of truth.
- Privacy-first design.
- Build the smallest reliable MVP first.
- Add complexity only after testing demonstrates a need.
- Optimize only after measuring real-world behavior.

---

# High-Level Architecture

Document
├── Pages
├── OCR
├── Generated Sections
└── Source References

Documents become READY before AI may use them.

Chat sessions are temporary and reference one or more READY documents.

---

# Core Lifecycle

Temporary Session
→ Create Document
→ Upload Pages
→ Accept Pages
→ Finish Document
→ PROCESSING
→ READY
→ AI Chat
→ Optional Account Creation
→ Ownership Transfer
→ Dashboard
→ Delete / Retention Cleanup

The uploaded image is the immutable visual source; OCR produces a proposed transcription that the
user reviews, may correct (**OCR transcription correction**, approved post-PRD-freeze — see
`docs/OCR_Master_Implementation_Plan.md` and `docs/Decision_Log.md` ADR-001), and approves per page.
Only accepted page text reaches AI. Correction is approved and documented but not yet implemented.

---

# Ownership Model

Every Document has exactly one owner.

- user_id
OR
- temporary_session_id

Never both.

---

# AI Flow

Each request contains:

- System safety prompt
- Active chat history
- Full accepted text of selected READY documents

The AI explains documents but never replaces supervising officers or the court.

---

# MVP Technology Stack

Frontend
- Next.js
- React
- Tailwind CSS

Backend
- Next.js Route Handlers
- Prisma ORM
- Neon PostgreSQL
- Vercel Blob Storage
- OpenAI API

Deployment
- Vercel

These are implementation choices, not product requirements.

---

# Technology Substitution Guidance

Frameworks and libraries may change if architectural guarantees remain intact.

Potential substitutions include:

- Prisma → another ORM with migrations and transaction support.
- Neon → another PostgreSQL provider.
- Vercel Blob → another secure object store.
- OpenAI → another provider that supports equivalent OCR, structured output, grounding, and safety behavior.
- Tailwind → another styling solution.

Do not casually change:

- Document lifecycle
- Shared ownership model
- Source-grounding rules
- Temporary chat behavior
- Privacy guarantees

---

# Supporting Specifications

1. PRD (authoritative requirements)
2. OCR Specification
3. Schema Specification
4. AI Safety & Persona
5. Account Creation & Temporary Access
6. Launch Readiness Checklist
7. Implementation Roadmap
8. Coding Risk Register

---

# Guiding Principles

1. The Document is the center of the application.
2. Accepted page text is the authoritative source.
3. Documents must reach READY before AI.
4. Shared ownership is enforced through architecture.
5. AI is document-grounded.
6. Temporary chats are not permanent history.
7. Simplicity is preferred until testing justifies additional complexity.
8. Architecture decisions are validated through implementation and testing.

---

# Future

Future revisions may add:

- Architecture diagrams
- Deployment topology
- API overview
- Sequence diagrams
- Performance considerations
- Direct links to all specifications
