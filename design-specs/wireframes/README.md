# Wireframes

Wireframe exports for the Conditions Translator MVP.

## Approved (authoritative — light mode)

These are the **final approved light-mode references.** Implement against these plus
[`../functionality/light-theme-visual-direction.md`](../functionality/light-theme-visual-direction.md).

### Desktop
- [`approved/desktop/desktop-light-mode-final.jpg`](approved/desktop/desktop-light-mode-final.jpg)
  — Dashboard, Workspace (upload), and Chat (analysis) desktop layouts.

### Mobile
- [`approved/mobile/mobile-light-mode-final.jpg`](approved/mobile/mobile-light-mode-final.jpg)
  — Chat mobile (pages view + chat view) **and** the authoritative **"DESIGN SYSTEM OVERVIEW —
  LIGHT MODE"** panel (color palette, typography, radius, shadows).

### Color-theme reference
The authoritative light-mode palette is the **"DESIGN SYSTEM OVERVIEW — LIGHT MODE"** panel embedded
in the approved **mobile** wireframe above. It is mirrored into semantic tokens in
[`../tokens/colors.json`](../tokens/colors.json).

## Archive (non-authoritative — reference only)

- `archive/figma-original/` — older Figma exports, including
  `color-theme-reference-final.png` and `color-theme-reference.png`.

**These older wireframes and color references are non-authoritative** unless a current doc
explicitly cites them. In particular, `color-theme-reference-final.png` shows an older
**white-background** palette that the approved direction (no pure-white major surfaces) replaces —
do **not** implement from it.

## Adding Wireframes

1. Place approved exports under `approved/{desktop,mobile}/`.
2. Move any superseded exports to `archive/`.
3. Name files descriptively: `{feature}-{context}.{ext}` (e.g. `dashboard-desktop-light.jpg`).
4. Update `docs/Wireframe_Implementation.md` with links to the new assets.
