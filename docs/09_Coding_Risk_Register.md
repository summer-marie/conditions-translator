# Coding Risk Register (Updated)

## Status
Approved MVP coding risk register aligned with the frozen PRD and supporting architecture.

This register is intended to guide implementation, testing, and future refinement.

---

# Risk Categories

Each risk contains:

- Description
- Impact
- Likelihood
- Severity
- Mitigation
- Testing Advised

---

## R-001 AI Prompt Drift

Description:
Small prompt changes improve one behavior while unintentionally degrading another.

Impact:
Inconsistent AI behavior and regressions.

Likelihood:
High

Severity:
High

Mitigation:
- Make one prompt change at a time.
- Maintain a standard prompt test library.
- Record observations in the AI Development Journal.
- Revert changes that introduce larger regressions.

Testing Advised:
Run the same prompt library after every meaningful prompt change.

---

## R-002 Shared Ownership Authorization Failure

Description:
Incorrect ownership checks expose another user's or temporary session's documents.

Impact:
Critical privacy and security failure.

Likelihood:
Medium

Severity:
Critical

Mitigation:
- Centralize authorization.
- Never query by Document ID alone.
- Always scope by user or temporary session.
- Validate expiration for temporary documents.

Testing Advised:
Cross-user, cross-session, expired-session, and ownership transfer tests.

---

## R-003 Document State Corruption

Description:
Documents become stuck or skip lifecycle states.

Impact:
AI unavailable, duplicate processing, inconsistent application state.

Likelihood:
Medium

Severity:
High

Mitigation:
- Treat lifecycle as a strict state machine.
- Allow only valid transitions.
- Log failures.
- Support retry from PROCESSING_FAILED.
- Never enable AI before READY.

Testing Advised:
State transition and retry testing.

---

## R-004 Full-Document Context Limits

Description:
Representative documents may exceed reliable model context, latency, or response limits.

Current MVP Strategy:
- Send full selected document text.
- Optimize for correctness rather than retrieval.

Mitigation:
- 10-page limit.
- 3 documents per chat.
- Approx. 50,000 confirmed characters.
- 20 user questions / 40 total messages.
- Never silently truncate source text.

Future Mitigation (if testing indicates problems):
- Simplify prompts.
- Improve formatting efficiency.
- Adjust operational limits.
- Introduce retrieval only after validating answer quality.
- Reevaluate model selection if needed.

Testing Advised:
Use representative supervision documents and record latency, quality, omissions, context failures, and API errors.

---

# Architecture Assumptions to Validate

- Full-document context is practical for representative documents.
- Current document/chat limits are appropriate.
- Shared ownership remains maintainable.
- OCR quality is acceptable.
- Section generation improves usability.
- Simple system prompts provide sufficient behavior.
- Temporary workspace flow is intuitive.

Validate through implementation and real-world testing.

---

# Decision Review Triggers

Review architecture if:

## OCR
- Frequent re-uploads.
- Poor OCR quality.
- Acceptance failures become common.

## AI Context
- Frequent context errors.
- High latency.
- Missing important conditions.

## Shared Ownership
- Authorization bugs appear.
- Ownership logic becomes difficult to maintain.

## Section Generation
- Frequent failures.
- Poor organization quality.
- Users ignore generated sections.

## AI Safety
- Excessive refusals.
- Hallucinations.
- Prompt regressions.
- Unhelpful officer follow-up questions.

## Rate Limits
- Legitimate users frequently hit limits.
- Abuse bypasses protections.
- Limits harm normal workflows.
- API usage becomes impractical.

---

# Dependencies

Authoritative:
- 01_MVP_PRD.md

Related:
- AI Safety & Persona
- Implementation Roadmap
- Launch Readiness Checklist
- Schema Specification
- Architecture Overview
