# Architecture Decision Log

## Status

Formal, committed record of approved architecture decisions for Conditions Translator.

This is a historical record of decisions that were **already approved** by the Project Owner. It
documents decisions; it is not the mechanism that grants approval. It complements — and does not
replace — the frozen PRD (`docs/01_MVP_PRD.md`) and the subsystem specifications. Agent-facing
working notes live in `.agent-memory/DECISIONS.md` (local, gitignored); this file is the tracked
record.

---

## ADR-001 — OCR Transcription Correction Approved After PRD Freeze

- **Date:** July 2026
- **Status:** Approved
- **Owner:** Project Owner
- **Authority:** `docs/OCR_Master_Implementation_Plan.md` (Approved, v1.0)

### Context

The frozen PRD (`docs/01_MVP_PRD.md` §7) states: "Manual OCR editing is not supported." After the
PRD was frozen, the Project Owner approved the OCR Master Implementation Plan, which makes user
correction of the proposed OCR transcription a non-negotiable part of the OCR subsystem (Master
Plan Decision 3 and §6–7). Two approved sources therefore conflict.

Per `AGENTS.md` (instruction precedence and architecture-change process) and the Master Plan's own
§1, such a conflict must be recorded here and reconciled through the approved architecture-change
process — not by silently rewriting the PRD.

### Decision

The Project Owner approved a page-level **OCR transcription correction** workflow, superseding the
PRD's "Manual OCR editing is not supported" statement **for the OCR subsystem only**. The approved
workflow:

- The **uploaded image is immutable** — the authoritative visual record. The user corrects the
  transcription, never the source document.
- **OCR produces a proposed transcription.** The user may correct transcription errors, then
  approves the page (**page approval**).
- **Accepted page text** (reviewed, optionally corrected, approved) is the factual source of truth
  and the only text available to AI.
- **Raw or unaccepted OCR text never reaches AI context.**
- A **persistent user-responsibility notice** is shown during review.

### Consequences

- `docs/01_MVP_PRD.md` is left **unchanged** (frozen). Its §7 statement is superseded for OCR
  editing by this ADR; PRD history is not rewritten.
- Downstream documentation (OCR Specification, Schema Architecture, Roadmap, Launch Readiness
  Checklist, testing documents, Architecture Overview, Project Status) acknowledges this approved
  architecture and references the Master Plan and this ADR, without asserting the PRD was modified.
- Raw-vs-accepted text and suggested edit metadata (`acceptedAt`, `wasUserEdited`, OCR model id,
  prompt version) are documented as **architectural concepts**, not mandated database fields. Any
  schema change is deferred to the implementation of the correction workflow.

### Implementation status

**Approved and documented, not yet implemented.** Current code exposes read-only extracted text
with Accept / Re-upload / Delete only, and stores a single immutable `OcrResult.extractedText` (no
raw-vs-accepted split, no edit metadata). Building the correction workflow — including any schema
decision and migration — is a future task with its own branch and tests.

### References

- `docs/OCR_Master_Implementation_Plan.md`
- `docs/01_MVP_PRD.md` §7 (frozen; superseded for OCR editing only)
- `docs/03_OCR_Specifications.md`, `docs/04_Schema_Architecture.md`
- `AGENTS.md` (instruction precedence / architecture-change process)
