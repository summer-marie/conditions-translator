# Tokens

Design tokens define the visual foundation of the app. Each JSON file is directly parseable into CSS custom properties or Tailwind config values.

## Files

- colors.json — Full color palette for light mode (Navy/Slate) and dark mode (Teal/Charcoal). Use the "light" and "dark" top-level keys to switch themes.
- typography.json — Font families (Inter + JetBrains Mono) and the type scale from display down to caption.
- spacing.json — Spacing scale (4px-64px), component-specific padding, layout dimensions, border radius, and box shadows.
- components.json — Per-component specs: buttons (4 variants), inputs, badges (4 status types), cards, navbar, sidebar, and modals.

## Usage

Map each token to a CSS custom property:
- colors.light.brand.primary becomes --color-brand-primary: #1E3A5F
- typography.scale.body.size becomes --font-size-body: 14px
- spacing.radius.md becomes --radius-md: 8px

For dark mode, swap the "light" object with the "dark" object using a class or media query toggle.

## No Purple Rule
Purple is explicitly excluded from all palettes. Do not introduce purple variants.
