# Wireframe Implementation and UI Design Handoff

## Purpose

This document is the central reference for UI/UX design assets and screen-by-screen implementation
guidance for the Conditions Translator MVP. It is the single source of truth for UI implementation
tasks — all coding agents must read and follow it when implementing features from the wireframes.

The **approved light-mode wireframes** now exist and are the visual source of truth. Visual hierarchy
comes from those approved wireframes and the design tokens — see
[`../design-specs/functionality/light-theme-visual-direction.md`](../design-specs/functionality/light-theme-visual-direction.md).

---

## Required Reading Before Implementation

All agents implementing from these wireframes must first read:

1. `AGENTS.md` — universal operating rules, architecture invariants, instruction precedence
2. `CLAUDE.md` — tool-specific workflow, commit rules, guardrails
3. `design-specs/functionality/light-theme-visual-direction.md` — the approved visual system
4. `.agent-memory/CURRENT_SESSION.md`, `.agent-memory/DECISIONS.md`, `.agent-memory/OPEN_QUESTIONS.md`
5. `.claude/session-memory/CURRENT_SESSION.md` (if present)

See `AGENTS.md` §Instruction Precedence for the canonical reading order. Do not invent requirements
or deviate from architecture without explicit approval.

---

## Design Assets and References

Approved assets live under `design-specs/` at the repository root:

```
design-specs/
├── wireframes/
│   └── approved/
│       ├── desktop/  ← approved desktop wireframes (authoritative)
│       └── mobile/   ← approved mobile wireframes + light-mode design-system panel
├── tokens/           ← semantic color roles, typography, spacing, components
└── functionality/    ← per-screen specs + light-theme-visual-direction.md
```

This document references only the **approved** wireframes. See `design-specs/README.md` for the full
repository structure.

### Approved wireframes

- **Desktop:** [`../design-specs/wireframes/approved/desktop/desktop-light-mode-final.jpg`](../design-specs/wireframes/approved/desktop/desktop-light-mode-final.jpg)
  — contains Dashboard, Workspace (upload), and Chat (analysis) desktop layouts.
- **Mobile:** [`../design-specs/wireframes/approved/mobile/mobile-light-mode-final.jpg`](../design-specs/wireframes/approved/mobile/mobile-light-mode-final.jpg)
  — contains Chat mobile (pages view + chat view) and the authoritative light-mode design-system
  panel (palette, typography, radius, shadows).

---

## Screen → Wireframe Mapping

| Screen | Approved desktop | Approved mobile | Component location | Notes |
|---|---|---|---|---|
| **Dashboard** | ✅ `desktop-light-mode-final.jpg` (dashboard panel) | ⚠️ none yet | `app/app/dashboard/page.tsx` | Deep-navy sidebar; document list as elevated cards on the blue-gray canvas. Mobile dashboard follows the visual-direction doc + `dashboard-spec.md` until a mobile wireframe exists. |
| **Workspace / Upload** | ✅ `desktop-light-mode-final.jpg` (workspace panel) | ⚠️ none yet | `app/app/workspace/page.tsx` | Upload panel, document-status panel, and help panel as distinct structural panels. |
| **Chat (analysis)** | ✅ `desktop-light-mode-final.jpg` (chat panel) | ✅ `mobile-light-mode-final.jpg` (pages + chat views) | `app/app/chat/page.tsx`, `components/chat/*` | Navy user bubbles; content-surface AI bubbles; blue (informational) citation pills; document inspector on desktop. |
| **Login / Signup** | ➖ inherits | ➖ inherits | `app/app/save/page.tsx` | **No new wireframe required.** Inherits the approved visual-direction doc + `login-spec.md`. Split layout: navy identity panel + non-white form surface; navy primary buttons. |
| **Landing (marketing)** | ➖ inherits | ➖ inherits | `app/page.tsx`, `components/landing/*` | **No new wireframe required.** Inherits the approved visual-direction doc + `landing-spec.md`; navy primary CTAs, not green. |

**Legend:** ✅ approved wireframe exists · ⚠️ no approved wireframe yet — implement from the
visual-direction doc + the screen spec, and flag material gaps in `.agent-memory/OPEN_QUESTIONS.md`
· ➖ inherits — no new wireframe required; implement from the approved visual-direction doc + the
screen spec.

### Desktop vs. mobile

- **Desktop** derives layout from `desktop-light-mode-final.jpg`: persistent deep-navy sidebar
  (240px), multi-panel content, right-hand inspector/status panels. See
  `light-theme-visual-direction.md` §7.
- **Mobile** is a purpose-built layout (not a shrunken desktop): single column, full-width panels,
  bottom tab navigation, charcoal shell. Chat mobile is defined by `mobile-light-mode-final.jpg`;
  other screens follow the visual-direction doc + their spec. See §8.

### Where visual hierarchy comes from

Visual hierarchy is defined by the **approved wireframes** and the **design tokens**
(`design-specs/tokens/`), as codified in `light-theme-visual-direction.md`. Do not derive hierarchy
from older written style notes where they disagree with the approved wireframes.

---

## Conflict Resolution

When guidance disagrees, resolve in this order:

1. **Behavior, security, document lifecycle, ownership/authorization, privacy, and AI-grounding
   always win.** The visual direction and wireframes change *look*, not *logic*. Never weaken these
   to satisfy a visual note. (See `AGENTS.md` §Architecture Invariants and §Instruction Precedence.)
2. **For a visual conflict between a new approved wireframe and an older written style note, the
   approved wireframe + `light-theme-visual-direction.md` win.** Older token values, older spec
   sentences, and archived color references are superseded.
3. **If a screen has no approved wireframe,** follow `light-theme-visual-direction.md` and the
   screen's `*-spec.md`; do not invent a divergent look. **Login/Signup and Landing are explicitly
   approved to inherit this way and are not gaps** — implement them directly. For any *other* screen
   lacking a wireframe, flag material ambiguity in `.agent-memory/OPEN_QUESTIONS.md` before
   proceeding.
4. **Never** change the PRD, architecture, lifecycle states, ownership, or token *roles* to resolve a
   purely visual question — stop and ask.

---

## Implementation Guardrails

These are hard prohibitions for all UI implementation on this project:

- **No pure-white page/application background.**
- **No green navigation.**
- **No green used as the default brand or primary color.**
- **No all-white card grid** (white cards on a white canvas).
- **No border-only separation for all major panels** — separate by surface tone and/or elevation.
- **No generic admin-dashboard / Bootstrap / clerical styling.**
- **No mobile layout created by merely shrinking the desktop.**
- **No visual changes that alter product functionality.**

(Full rationale and acceptable/unacceptable examples: `light-theme-visual-direction.md` §9 and §11.)

---

## State Machine Notes

### Document Lifecycle States (Reference)

See `prisma/schema.prisma` and `docs/04_Schema_Architecture.md` for the authoritative model:

- **IN_PROGRESS** — actively being built (upload/OCR/accept flow)
- **COMPLETED** — user finished intake, awaiting processing
- **PROCESSING** — sections are being generated
- **READY** — available for AI chat
- **PROCESSING_FAILED** — section generation failed; awaiting retry

Workspace and dashboard screens reflect these states visually and behaviorally (e.g., only READY
documents appear in the chat picker). Ready uses the **success** (green) accent; processing uses the
**informational** (blue) accent.

### Page Status States (Reference)

See `prisma/schema.prisma`:

- **PENDING** — uploaded, OCR not yet run
- **OCR_COMPLETE** — OCR succeeded, awaiting user accept/re-upload
- **OCR_FAILED** — OCR could not extract usable text
- **ACCEPTED** — user confirmed the text; immutable

---

## Responsive Design Principles

From `AGENTS.md` §UI Rules and `CLAUDE.md` §10:

- **Mobile-first**, with real desktop support (not just a scaled phone layout).
- **Functional flows first**, then polish.
- **One primary decision per screen** where practical.
- **Clear states:** loading, empty, success, error must all be visible.
- **Follow the approved wireframes and tokens** for the visual system.

---

## Adding New Wireframes

1. Place approved exports under `design-specs/wireframes/approved/{desktop,mobile}/`; move
   superseded exports to `archive/`.
2. Add the screen to the **Screen → Wireframe Mapping** table above with a relative link.
3. Update `.agent-memory/WORK_LOG.md` with the addition date.
4. If a wireframe reveals new requirements or conflicts with architecture, file an entry in
   `.agent-memory/OPEN_QUESTIONS.md` — do not proceed silently.

---

## Questions or Clarifications

If a wireframe is ambiguous or conflicts with architecture:

1. Check `light-theme-visual-direction.md`, `AGENTS.md` §UI Rules, and `CLAUDE.md` §10.
2. Review `docs/02_Architecture_Overview.md` and the relevant subsystem spec.
3. Check `.agent-memory/OPEN_QUESTIONS.md` for known deferred items.
4. If still unclear, add an entry to `.agent-memory/OPEN_QUESTIONS.md` with the question, impact, and
   options — do not proceed silently.
