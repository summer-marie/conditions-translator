# Wireframe Implementation and UI Design Handoff

## Purpose

This document serves as the central reference for UI/UX design assets, implementation guidance, and screen-by-screen specifications for the Conditions Translator MVP.

Once finalized wireframes are added to this repository, they will be linked and referenced here. This file is the single source of truth for UI implementation tasks — all coding agents must read and follow this document when implementing features from the wireframes.

---

## Required Reading Before Implementation

All agents implementing features from these wireframes must first read:

1. `AGENTS.md` — universal operating rules, architecture invariants, and instruction precedence
2. `CLAUDE.md` — tool-specific workflow, commit rules, and deployment guardrails
3. `.agent-memory/CURRENT_SESSION.md`, `.agent-memory/DECISIONS.md`, `.agent-memory/OPEN_QUESTIONS.md` — ongoing context and known issues
4. `.claude/session-memory/CURRENT_SESSION.md` (if present) — session-specific continuity

See `AGENTS.md` §4 (Instruction Precedence) for the canonical reading order. Do not invent requirements or deviate from architecture without explicit approval.

---

## Design Assets and References

All finalized wireframes and design assets are stored in the `design-specs/` folder at the repository root:

```
design-specs/
├── wireframes/
│   └── exports/              ← Final visual wireframes (Figma exports, PNG mockups, SVG)
├── tokens/                   ← Color palettes, typography, spacing, breakpoints
└── functionality/            ← Screen-by-screen implementation guidance
```

See `design-specs/README.md` for the complete folder structure and workflow.

### Screens to be wireframed as design work progresses

- [ ] **Temporary Workspace Flow** — initial upload/OCR/accept/finish journey for no-account users
- [ ] **Signed-In Workspace Flow** — saved document resume, new document creation, multi-document browsing
- [ ] **Dashboard** — saved document list, account settings, document management
- [ ] **Chat Interface** — document picker, message history, grounding context display
- [ ] **Account Creation / Sign-In** — registration, login, password recovery
- [ ] **Mobile Optimization** — responsive layout for phone camera uploads and portrait viewing

---

## Implementation Structure

### By Screen / Feature

Each section below will hold:

- **Screen name / Feature**
  - Wireframe reference (image/link)
  - Implementation notes (responsive breakpoints, state handling)
  - Component / page file location
  - Dependencies on other screens/phases
  - Known deferred items or open questions

#### Implementation Guidance Template

Full screen-by-screen implementation guidance lives in `design-specs/functionality/` with one file per screen (e.g., `design-specs/functionality/workspace-intake.md`). See `design-specs/functionality/README.md` for the template and workflow.

**Quick reference for the template:**

```
## [Screen Name]

**Wireframe:** `../../design-specs/wireframes/exports/[filename]`

**Primary purpose:** One-line description

## Responsive Behavior
- **Mobile** (<640px): [brief notes]
- **Tablet** (640–1024px): [brief notes]
- **Desktop** (>1024px): [brief notes]

## States
- **Loading:** [what the user sees while data loads]
- **Empty:** [fallback if no content exists]
- **Success:** [normal, data-present state]
- **Error:** [how errors are displayed; any retry affordances]

## Component Location
- `app/app/[feature]/page.tsx` or `lib/components/[FeatureName].tsx`

## Dependencies
- [Other phase/feature this relies on]

## Deferred / Out of MVP
- [Anything unclear or explicitly out of scope]
```

Store the full version in `design-specs/functionality/[screen-name].md`.

---

## State Machine Notes

### Document Lifecycle States (Reference)

See `prisma/schema.prisma` and `docs/04_Schema_Architecture.md` for the authoritative state model:

- **IN_PROGRESS** — actively being built (upload/OCR/accept flow)
- **COMPLETED** — user finished intake, awaiting processing
- **PROCESSING** — sections are being generated
- **READY** — document is available for AI chat
- **PROCESSING_FAILED** — section generation failed; awaiting retry

Workspace and dashboard screens should reflect these states visually and behaviorally (e.g., only READY documents appear in chat picker; only IN_PROGRESS documents appear in active intake).

### Page Status States (Reference)

See `prisma/schema.prisma`:

- **PENDING** — uploaded, OCR not yet run
- **OCR_COMPLETE** — OCR succeeded, awaiting user accept/re-upload
- **OCR_FAILED** — OCR could not extract usable text
- **ACCEPTED** — user confirmed the text; immutable

UI should show these clearly (e.g., "Needs retake" vs. "Ready to accept").

---

## Responsive Design Principles

From `CLAUDE.md` (§10, UI Rules):

- **Mobile-first:** design for small screens first, enhance for larger
- **Desktop support:** must also work in desktop browsers, not just mobile
- **Functional flows first:** prioritize working interactions before polish
- **One decision per screen:** keep choices clear and focused
- **Clear states:** loading, empty, success, error must all be visible
- **No premature polish:** don't invent final styling before wireframes are approved

---

## Implementation Order

(To be determined once wireframes are finalized. Typically follows the phase dependency order in `docs/08_Conditions_Translator_Implementation_Roadmap.md`.)

**General guideline:** build foundational flows (temporary workspace, OCR, chat) before advanced features (multi-document navigation, dashboard, account management).

---

## Deferred / Out of MVP Scope

### Known deferred from Phase E2E testing

- Multi-document browsing in workspace (see `.agent-memory/OPEN_QUESTIONS.md` for detailed rationale)
- Workspace document list visibility after returning from chat
- Save/sign-in entry UI redesign (currently a stopgap)
- Server Action error messaging polish

See `.agent-memory/OPEN_QUESTIONS.md` (§"[DEFERRED — FUTURE UX]") for full details.

---

## Adding New Wireframes

When adding wireframes to this document:

1. Link or embed the wireframe image/PDF
2. Fill in the template section above with implementation notes
3. Update `.agent-memory/WORK_LOG.md` with the addition date
4. If the wireframe reveals new requirements or conflicts with existing architecture, file an entry in `.agent-memory/OPEN_QUESTIONS.md`
5. Do not commit changes to the codebase until wireframes are finalized and approved

---

## Questions or Clarifications

If a wireframe is ambiguous or conflicts with architecture decisions:

1. Check `AGENTS.md` §10 (UI Rules) and `CLAUDE.md` (UI guidance)
2. Review `docs/02_Architecture_Overview.md` and related subsystem specs
3. Check `.agent-memory/OPEN_QUESTIONS.md` for known deferred items
4. If still unclear, add an entry to `.agent-memory/OPEN_QUESTIONS.md` with the question, impact, and options — do not proceed silently
