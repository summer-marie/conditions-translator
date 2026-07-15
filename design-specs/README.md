# Design Specifications

Central repository for wireframes, design tokens, and UI/UX implementation guidance for the Conditions Translator MVP.

## Folder Structure

```
design-specs/
├── README.md                    (this file)
├── wireframes/
│   ├── final-selection/         (approved final designs, ready for handoff)
│   ├── pdf/                     (PDF exports of designs)
│   └── exports/                 (Figma exports, PNG mockups, SVG, etc.)
├── tokens/                      (design tokens, color palettes, typography rules)
└── functionality/               (implementation notes, interaction specs, state machines)
```

## Workflow

1. **Design phase:** wireframes and design assets are created in Figma (or your design tool)
2. **Handoff:** approved designs are exported and placed in `wireframes/final-selection/`
3. **Reference:** implementation guidance is documented in `functionality/`
4. **Implementation:** agents read `docs/Wireframe_Implementation.md`, which links to these assets

## How Implementation Agents Use This Folder

- Read `docs/Wireframe_Implementation.md` first (it has the required reading list and links here)
- Follow wireframes in `wireframes/final-selection/` for screen layouts and behavior
- Reference `tokens/` for colors, spacing, typography
- Check `functionality/` for state machines, responsive breakpoints, and deferred items
- Link specific files in `Wireframe_Implementation.md` as each screen is implemented

## Adding New Assets

When adding wireframes or design tokens:

1. Place approved designs in `wireframes/final-selection/` with clear naming (e.g., `workspace-flow.pdf`, `login-screen.png`)
2. Export variants to `pdf/` or `exports/` for reference
3. Document design decisions in `functionality/` (one file per feature, e.g., `workspace-navigation.md`)
4. Update `docs/Wireframe_Implementation.md` with links to the new assets
5. Update `.agent-memory/WORK_LOG.md` with the addition date and summary

## Notes

- Do not commit large binary files (.psd, .figma, .ai) — only approved exports (.pdf, .png, .svg)
- Keep file names descriptive and lowercase with hyphens (e.g., `chat-interface-mobile.pdf`, not `ChatInterface1_final_v2.pdf`)
- If using Figma, include a link to the live Figma project in `wireframes/final-selection/README.md` or here

---

## Source Reference (from Figma)

The section below is the original design-specs README exported directly from Figma, where these designs were authored. Kept verbatim for reference.

# Design Specs — Conditions Translator (name TBD)

## File Structure

- tokens/colors.json
- tokens/typography.json
- tokens/spacing.json
- tokens/components.json
- functionality/dashboard-spec.md
- functionality/landing-spec.md
- functionality/login-spec.md
- functionality/chat-spec.md

## Implementation Notes

### Theme System
- App supports light mode (Navy/Slate) and dark mode (Teal/Charcoal)
- Use colors.json light and dark objects as CSS custom property sets
- Toggle via user preference or system setting
- Accent colors (emerald, amber, crimson, teal) are consistent across both modes

### Key Design Decisions
- No purple — explicitly excluded from the palette
- Email is optional at signup — username-only accounts supported, with clear password recovery warnings
- App name is not final — use a config/env variable, not hardcoded strings
- Sidebar navigation on desktop, bottom tab bar on mobile
- Card backgrounds use #EDF2F7 (light) / #1F2937 (dark) for separation from page background

### Responsive Breakpoints
- Desktop: >=768px (sidebar visible, multi-column layouts)
- Mobile: <768px (bottom tabs, single column, full-width cards)

### Font Loading
- Primary: Inter (Google Fonts or self-hosted)
- Mono: JetBrains Mono (for code/OCR text display)
- Load weights: 400, 500, 600, 700
