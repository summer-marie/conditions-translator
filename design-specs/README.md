# Design Specifications

Central repository for wireframes, design tokens, and UI/UX implementation guidance for the
Conditions Translator MVP.

The current **approved visual source of truth for light mode** is the wireframe set in
`wireframes/approved/` plus [`functionality/light-theme-visual-direction.md`](functionality/light-theme-visual-direction.md).

## Folder Structure

```
design-specs/
├── README.md                     (this file)
├── wireframes/
│   ├── approved/
│   │   ├── desktop/              (approved desktop light-mode wireframes)
│   │   └── mobile/               (approved mobile light-mode wireframes)
│   └── archive/
│       └── figma-original/       (historical, non-authoritative Figma exports — reference only)
├── tokens/                       (design tokens: colors, typography, spacing, components)
└── functionality/                (screen-by-screen interaction specs + visual direction)
```

## Workflow

1. **Design:** wireframes are authored in the design tool and exported.
2. **Approval:** approved exports are placed under `wireframes/approved/{desktop,mobile}/`.
   Superseded exports move to `wireframes/archive/`.
3. **Reference:** implementation guidance is documented in `functionality/`; the visual system is
   defined in `functionality/light-theme-visual-direction.md` and the `tokens/` files.
4. **Implementation:** agents read `docs/Wireframe_Implementation.md`, which links to these assets.

## How Implementation Agents Use This Folder

- Read `docs/Wireframe_Implementation.md` first (required reading list + screen→wireframe mapping).
- Follow the wireframes in `wireframes/approved/` for layout and behavior.
- Follow `functionality/light-theme-visual-direction.md` for the visual system (surfaces, semantic
  color, elevation, density, desktop/mobile behavior, prohibited patterns).
- Reference `tokens/` for the semantic color roles, typography, spacing, and elevation.
- Check `functionality/*-spec.md` for per-screen state machines, responsive breakpoints, and
  deferred items.
- Treat anything under `wireframes/archive/` as **non-authoritative** unless a doc explicitly cites
  it.

## Adding New Assets

1. Place approved wireframes under `wireframes/approved/{desktop,mobile}/` with descriptive,
   lowercase-hyphenated names (e.g. `dashboard-desktop-light.jpg`).
2. Move any superseded exports to `wireframes/archive/`.
3. Document interaction decisions in `functionality/` (one file per screen).
4. Update `docs/Wireframe_Implementation.md` with links to the new assets.
5. Update `.agent-memory/WORK_LOG.md` with the addition date and summary.

## Notes

- Do not commit large binary source files (.psd, .fig, .ai) — only approved exports (.jpg, .png,
  .svg, .pdf).
- Keep file names descriptive and lowercase with hyphens.

## Implementation Notes

### Theme System
- The app targets a **light theme first** (approved). Dark mode exists in `tokens/colors.json` and
  is **frozen and already accepted** — it must not be redesigned during light-mode implementation
  (shared-token changes only where necessary to prevent regressions or preserve accessibility).
- Use the semantic `light` roles in `colors.json` as CSS custom-property sets.
- Accent colors (success/warning/destructive/informational) are semantic — see
  `light-theme-visual-direction.md` §4.

### Key Design Decisions
- **60%-light, dark-inspired** theme: deep navy → charcoal → blue-gray → soft neutral, with green as
  a **success-only** accent. Not a conventional white SaaS interface.
- **No purple** — explicitly excluded from the palette.
- **Email is optional at signup** — username-only accounts supported, with clear password-recovery
  warnings.
- **App name is not final** — use a config/env variable, not hardcoded strings.
- Sidebar navigation on desktop (deep navy), bottom tab bar on mobile.

### Responsive Breakpoints
- Desktop: ≥768px (sidebar visible, multi-column layouts)
- Mobile: <768px (bottom tabs, single column, full-width panels)

### Font Loading
- Primary: Inter (Google Fonts or self-hosted)
- Mono: JetBrains Mono (for code/OCR text display)
- Load weights: 400, 500, 600, 700

---

> **Note on history:** an earlier version of this file duplicated a verbatim Figma-exported README
> and referenced `wireframes/final-selection/` and `wireframes/pdf/` folders that do not exist in
> this repository. Those folders were never created; the approved assets live in
> `wireframes/approved/`. This single README is now the one source of truth for the design-specs
> structure.
