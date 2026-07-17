# Light-Theme Visual Direction

**Status:** Approved visual source of truth for the light theme.
**Applies to:** All application chrome, workspace, dashboard, chat, auth, and landing surfaces in light mode.
**Authority:** This document governs **visual presentation only.** It does not override product
behavior, security, document lifecycle, ownership/authorization, privacy, or AI-grounding
requirements. When this document and a behavior/architecture spec disagree, the behavior spec wins
(see `AGENTS.md` §Instruction Precedence). When this document and an *older written style note*
disagree, this document and the approved wireframes win.

**Approved references (the visual truth):**
- Desktop — [`../wireframes/approved/desktop/desktop-light-mode-final.jpg`](../wireframes/approved/desktop/desktop-light-mode-final.jpg)
- Mobile — [`../wireframes/approved/mobile/mobile-light-mode-final.jpg`](../wireframes/approved/mobile/mobile-light-mode-final.jpg)
- Color palette — the **"DESIGN SYSTEM OVERVIEW — LIGHT MODE"** panel embedded in the mobile
  wireframe above is the authoritative palette. The archived
  `../wireframes/archive/figma-original/color-theme-reference-final.png` is **non-authoritative**
  (it shows an older white-background palette that this direction replaces).

> **Palette values below were transcribed from the approved wireframe image. Verify each hex
> against the source before hardcoding it into `app/styles/tokens.css`.**

---

## 1. Design Intent

This is a **60%-light, dark-inspired** interface. It must read as premium, polished, slightly
dense, and structured — closer to Raycast-style depth than to a generic white SaaS dashboard,
Bootstrap admin panel, or clerical form tool.

The identity is carried by **deep navy** chrome and **charcoal** structure. Content sits on
**blue-gray** and **soft-neutral** surfaces that are lighter but never pure white at large scale.
Depth comes from real surface changes, elevation, and shadow — not from borders alone on a flat
white canvas.

The core progression is:

**Deep navy → charcoal → blue-gray → soft neutral → (green as an accent only)**

Green is a **semantic success color**, never the brand or navigation color.

---

## 2. Visual Hierarchy

Establish rank through **surface tone + elevation**, reinforced by type weight — not by color alone.

1. **Identity / persistent chrome** — deepest navy. Sidebar, primary nav, app identity, selected
   navigation regions.
2. **Structural containers** — charcoal. Strong grouped modules, elevated cards, mobile shells,
   visually important workspace regions.
3. **Elevated cards** — a lighter charcoal/card surface, lifted with shadow off the structural
   layer.
4. **Workspace / secondary surfaces** — blue-gray. Main working canvas behind cards.
5. **Content surfaces** — soft neutral. Readable regions that need a lighter treatment.
6. **High-readability interiors** — white, used **sparingly** (input interiors, document previews,
   small dense content regions).

Type hierarchy (headings navy/high-contrast, body secondary, meta muted) layers on top of this
surface hierarchy; it does not replace it.

---

## 3. Surface Hierarchy

| Role | Semantic token | Approved value* | Use |
|---|---|---|---|
| App background | `app-background` | `#D6E0EA` | Default application canvas (blue-gray, **not white**) |
| Navigation background | `navigation-background` | `#0B1426` | Sidebar, persistent chrome, primary nav |
| Structural panel | `structural-panel` | `#2B3445` | Strong containers, grouped modules, mobile shell |
| Elevated card | `elevated-card` | `#3A4256` | Cards lifted above the structural/workspace layer |
| Workspace surface | `workspace-surface` | `#4A556C` | Main workspace / secondary background behind cards |
| Content surface | `content-surface` | `#E6ECF3` | Lighter readable content regions |
| Input surface | `input-surface` | `#FFFFFF` | Input interiors, document previews, small dense text |
| Deep navy (identity) | `brand-primary` | `#0F1B33` | Identity, primary buttons, selected nav, headings |
| Navy surface | `brand-primary-surface` | `#16223D` | Secondary navy chrome / hover accents |

*See the palette-verification note at the top of this file.

**Rule:** every major region must be visually distinguishable from the region behind it by a
**tone change and/or elevation**, not by a hairline border alone.

---

## 4. Semantic Color Rules

| Semantic | Token | Approved value* | Only for |
|---|---|---|---|
| Success | `success` | `#16A34A` | Ready/READY states, save/confirm, positive completion, success badges |
| Warning | `warning` | `#D97706` | Cautionary flags, warning callouts |
| Destructive | `destructive` | `#DC2626` | Delete/error/blocking actions (require confirmation) |
| Informational | `informational` | `#2563EB` | Processing/in-progress, citations, neutral info feedback |

- **Green is accent-only.** Allowed for success, ready states, save/confirm actions, and positive
  completion. **Never** the dominant brand color, **never** navigation, **never** the default
  primary button.
- **Primary actions use deep navy** (`brand-primary`), not green. (See the approved desktop
  wireframe: "New Document" / "New Chat" are navy; **"Save Workspace" is green** because it is a
  save/confirm action.)
- Destructive actions always use `destructive` and require confirmation.
- Processing/citation/neutral-info uses `informational` (blue), replacing the previous teal.

---

## 5. Elevation and Shadow Guidance

Depth is a first-class tool in this theme. Use surface tone changes **plus** shadow to separate
layers; do not rely on borders alone.

| Token | Approved value* | Use |
|---|---|---|
| `shadow-small` | `0 1px 2px rgba(15,27,51,0.08)` | Resting cards, subtle lift |
| `shadow-medium` | `0 4px 12px rgba(15,27,51,0.12)` | Hover/active cards, raised panels |
| `shadow-large` | `0 10px 24px rgba(15,27,51,0.16)` | Modals, popovers, high-layer surfaces |

Shadow color is derived from the deep-navy `#0F1B33` (`rgba(15,27,51,…)`) so elevation reads warm
against the blue-gray canvas. Increase elevation as a surface rises in the hierarchy (§2).

---

## 6. Density and Spacing Guidance

- The interface is **slightly dense** — compact enough to feel professional and information-rich,
  never sparse or "empty admin dashboard."
- Keep the existing spacing scale (`tokens/spacing.json`). Favor the tighter end for grouped data
  (document lists, page lists, inspector rows) and the looser end for section separation.
- Group related controls into panels with shared padding rather than scattering them on the canvas.
- Preserve clear loading, empty, success, and error states (`AGENTS.md` §UI Rules) — density must
  not remove breathing room around primary decisions.

---

## 7. Desktop Behavior

Reference: [`../wireframes/approved/desktop/desktop-light-mode-final.jpg`](../wireframes/approved/desktop/desktop-light-mode-final.jpg)

- **Deep-navy left sidebar** (240px) carries identity and primary navigation; the **selected nav
  item uses a navy/brand treatment**, not green.
- Main content sits on the **blue-gray app background**; document cards are **elevated content
  surfaces** with shadow and visible boundaries, not white tiles on white.
- Workspace and chat use distinct panels (upload panel, document status panel, inspector) with
  their own surface tone and elevation so sections are legible at a glance.
- Right-hand inspector / status panels are structural panels, visually separated from the main
  canvas.

---

## 8. Mobile Behavior

Reference: [`../wireframes/approved/mobile/mobile-light-mode-final.jpg`](../wireframes/approved/mobile/mobile-light-mode-final.jpg)

- Mobile is a **purpose-built layout**, not a shrunken desktop. Single-column, full-width panels,
  bottom tab navigation.
- The mobile shell uses a **charcoal/structural** frame; content cards stack as elevated surfaces.
- The **READY** badge and status pills use their semantic colors (green for ready, blue for
  processing).
- Preserve the mobile chat structure from the wireframe (pages view / chat view, selected-document
  pills, fixed input bar) — this is layout guidance; the chat behavior spec still governs function.

---

## 9. Prohibited Patterns

- ❌ Pure-white page/application background.
- ❌ Green navigation or green as the default brand/primary color.
- ❌ An all-white card grid (white cards on a white canvas).
- ❌ Separating all major panels with borders only (no tone/elevation change).
- ❌ Large uninterrupted white canvases.
- ❌ Flattening every card onto a single light background.
- ❌ Generic admin-dashboard / Bootstrap / clerical styling.
- ❌ A mobile layout produced by merely shrinking the desktop layout.
- ❌ Any visual change that alters product functionality.
- ❌ Purple, anywhere (pre-existing "No Purple" rule).

---

## 10. Accessibility Requirements

- Text on every surface must meet **WCAG AA** contrast (4.5:1 body, 3:1 large text). Navy-on-light
  and light-on-navy pairings from the palette are the safe defaults; verify any new pairing.
- **Color is never the only signal.** Status must also carry text/icon/shape (badges name their
  state; citations are labeled, not just tinted).
- Preserve visible focus rings on all interactive elements; do not remove an outline without an
  equivalent replacement.
- Maintain semantic landmarks, form-label associations, and live regions already established in the
  app; visual restyling must not regress them.
- Green success and red destructive must remain distinguishable for color-vision-deficient users —
  rely on the accompanying label/icon, not hue alone.

---

## 11. Acceptable vs. Unacceptable Usage

**Acceptable**
- ✅ Blue-gray app canvas with elevated content-surface cards separated by tone + shadow.
- ✅ Deep-navy sidebar with a navy-highlighted active item.
- ✅ White used only inside inputs, document previews, and small dense text regions.
- ✅ Green on a "Save Workspace" / "Accept" / "READY" affordance.
- ✅ Navy primary buttons ("New Document", "New Chat", "Sign In"); blue processing/citation pills.
- ✅ Charcoal structural panels framing the mobile shell and workspace modules.

**Unacceptable**
- ❌ White page background with white cards distinguished only by a 1px gray border.
- ❌ Green sidebar-active state or a green "primary" button used as the brand default.
- ❌ A full white right-hand form panel on the login screen.
- ❌ Teal citations / teal processing (superseded by `informational` blue).
- ❌ Identical flat cards for navy chrome, workspace, and content with no tonal separation.
- ❌ Reusing the desktop grid on mobile by scaling it down.

---

## 12. Conflict Resolution (for implementing agents)

1. **Behavior/security/lifecycle/auth/architecture always win.** This doc changes look, not logic.
2. For **visual** conflicts: the **approved wireframes + this document** override any older written
   style note, older token value, or older spec sentence.
3. If a required screen has no approved wireframe, follow the surface/semantic rules here and flag
   the gap in `.agent-memory/OPEN_QUESTIONS.md` rather than inventing a divergent look.
4. Do not change the PRD, architecture, or token *roles* to resolve a purely visual question — stop
   and ask.
