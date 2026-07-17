# Tokens

Design tokens define the visual foundation of the app. Each JSON file is directly parseable into
CSS custom properties or Tailwind config values.

The light-mode tokens reflect the **approved light-theme visual direction** — a 60%-light,
dark-inspired theme (deep navy → charcoal → blue-gray → soft neutral, with **green as a
success-only accent**). See [`../functionality/light-theme-visual-direction.md`](../functionality/light-theme-visual-direction.md)
and the approved wireframes in [`../wireframes/approved/`](../wireframes/approved/).

> **Verify before hardcoding:** light-mode hex values were transcribed from the palette panel in
> the approved mobile wireframe image. Confirm each value against the source before writing it into
> `app/styles/tokens.css`.

## Files

- `colors.json` — Light-mode palette expressed as **semantic roles** (surface, brand, text, border,
  accent), plus an unchanged dark-mode block. Use the semantic keys, not raw color names.
- `typography.json` — Font families (Inter + JetBrains Mono) and the type scale.
- `spacing.json` — Spacing scale, component padding, layout dimensions, radius, and semantic
  elevation shadows (`small` / `medium` / `large`).
- `components.json` — Per-component specs (buttons, inputs, badges, cards, navbar, sidebar, modals)
  aligned to the approved hierarchy.

## Light-mode semantic roles (from `colors.json`)

| Role | Token | Purpose |
|---|---|---|
| App background | `light.surface.app` | Blue-gray application canvas (**not white**) |
| Navigation background | `light.surface.navigation` | Deep-navy sidebar / persistent chrome |
| Structural panel | `light.surface.structuralPanel` | Charcoal containers, grouped modules, mobile shell |
| Elevated card | `light.surface.elevatedCard` | Cards lifted above the structural/workspace layer |
| Workspace surface | `light.surface.workspace` | Blue-gray main workspace / secondary background |
| Content surface | `light.surface.content` | Lighter readable content regions |
| Input surface | `light.surface.input` | White — inputs, document previews, small dense text only |
| Primary text | `light.text.primary` | Headings / high-contrast text on light surfaces |
| Muted text | `light.text.muted` | Captions, metadata, timestamps |
| Border strong | `light.border.strong` | Strong structural dividers (**proposed value — confirm**) |
| Border subtle | `light.border.subtle` | Hairline separators |
| Success | `light.accent.success` | Ready/save/confirm/positive completion — **green, accent only** |
| Warning | `light.accent.warning` | Cautionary flags |
| Destructive | `light.accent.destructive` | Delete/error/blocking actions |
| Informational | `light.accent.informational` | Processing, citations, neutral info (blue) |
| Shadow small/medium/large | `spacing.shadow.*` | Elevation (see `spacing.json`) |

## Usage

Map each token to a CSS custom property, e.g.:

- `colors.light.surface.app` → `--color-surface-app: #D6E0EA`
- `colors.light.brand.primary` → `--color-brand-primary: #0F1B33`
- `colors.light.accent.success` → `--color-accent-success: #16A34A`
- `spacing.shadow.medium` → `--shadow-medium: 0 4px 12px rgba(15, 27, 51, 0.12)`

## Rules

- **No pure-white major surfaces.** White is allowed only for input interiors, document previews,
  and small high-readability content regions.
- **Green is accent-only.** Never the brand, navigation, or default primary-button color.
- **Primary actions use deep navy.** Green is reserved for save/confirm/success.
- **Separate surfaces by tone + elevation,** not by borders alone.
- **No Purple** — purple is explicitly excluded from all palettes. Do not introduce purple variants.
- **Dark mode was not part of this light overhaul** — the `dark` block in `colors.json` is unchanged
  and should be reconciled with the approved direction in a separate pass.
