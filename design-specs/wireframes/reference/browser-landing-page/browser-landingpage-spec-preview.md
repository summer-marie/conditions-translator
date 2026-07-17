# Landing Page — Workspace Preview Variant (Navy/Slate)

**Wireframe:** `../wireframes/exports/landing-workspace-preview-navy.png`

**Source wireframe (pre-rebrand):** `../wireframes/archive/figma-original/browser-landing-optionB.png` — the original Figma export of this layout, styled with the superseded emerald-brand palette.

**Color reference:** `../tokens/colors.json`, `../../app/styles/tokens.css` — this variant is the same "Option B" layout recolored to the current Navy/Slate light-mode tokens (see "Color Mapping" below).

**Primary purpose:** Alternate public-marketing landing layout that pairs the hero copy with a live "workspace preview" card (uploaded pages + status badges) instead of plain text, and demonstrates the OCR + auto-sectioning value props as two visual step cards instead of a numbered list.

**Status:** Proposed alternate layout, not yet implemented. It has not replaced or been reconciled with the currently shipped landing page (`app/page.tsx`, documented in `docs/UI_IMPLEMENTATION_PLAN.md`'s "Public marketing landing page" entry). Treat this spec as a design reference for a future landing-page iteration, not as a description of current behavior.

---

## Layout Structure

### Desktop (>=1024px)
- **Navbar:** logo + wordmark (left), nav links "Features" / "Security" / "Sign in" (center-right), primary "Create Free Account" button (right)
- **Hero:** two columns — headline "Upload. Organize. Understand." + subtitle + primary/secondary CTA buttons (left); a bordered "workspace preview" card showing the app's own header bar and 3 uploaded-page thumbnails with status badges (right)
- **Product Workspace section** (tinted background): centered eyebrow + heading, followed by two alternating feature rows:
  1. "OCR Text Extraction" preview card (left) + "Step 01: Upload images, run instant OCR" copy (right)
  2. "Step 02: Structure messy papers automatically" copy (left) + "Automatic Document Sectioning" preview card with a section list (right)
- **Bottom CTA:** centered heading, security/encryption blurb, primary + secondary buttons
- **Footer:** logo + copyright (left), legal links (right)

### Tablet / Mobile (<1024px)
- Hero collapses to a single column; workspace preview card moves below the hero copy (per `landing-spec.md`'s "Hero illustration: hidden or scaled down on mobile" rule — on very small screens this card may be omitted entirely rather than scaled down, since its 3-thumbnail grid doesn't compress well below ~360px)
- Feature rows stack card-above-text, in source order (no left/right alternation)
- CTA buttons go full-width, stacked vertically
- Section spacing reduces per `landing-spec.md` (48px → 32px)

---

## Color Mapping (Navy/Slate rebrand)

The original Figma export used an emerald/green brand color throughout. This variant replaces every **brand** usage with the current Navy/Slate primary, while leaving **status accent** colors untouched — `tokens/colors.json` documents accents as universal/unchanged across the rebrand.

| Element | Old (archived export) | New token | New value |
|---|---|---|---|
| Logo mark, primary buttons ("Create Free Account") | Emerald | `--color-brand-primary` | `#1E3A5F` |
| Eyebrow labels ("Product Workspace", "OCR Text Extraction", "Step 01/02", "Automatic Document Sectioning") | Emerald | `--color-brand-primary` | `#1E3A5F` |
| Page background | White | `--color-background-page` | `#FFFFFF` |
| Workspace/feature card surfaces | Light gray | `--color-background-card` | `#EDF2F7` |
| Preview panel body / tinted section background | Light gray | `--color-background-sidebar` / `--color-background-subtle` | `#F1F5F9` / `#F8FAFC` |
| Card borders | Gray | `--color-border-card` | `#CBD5E1` |
| Dividers | Light gray | `--color-border-divider` | `#E2E8F0` |
| Headings | Dark navy/black | `--color-text-heading` | `#1E3A5F` |
| Body copy | Slate | `--color-text-body` | `#475569` |
| Meta/caption text | Light slate | `--color-text-meta` | `#94A3B8` |
| "Ready" page-status badge | Green | `--color-accent-success` / `-success-bg` | `#059669` / unchanged |
| "Processing" page-status badge | Amber (wireframe placeholder color) | `--color-accent-processing` / `-processing-bg` | `#0D9488` / unchanged — matches the `processing` variant already implemented in `components/ui/Badge.tsx`, not the `warning` variant |
| "Section 1" highlighted row | Light green | `--color-accent-success-bg` / `--color-accent-success` | unchanged |
| "Section 2" (inactive) row | Light gray | `--color-background-sidebar` | `#F1F5F9` |

**No purple** is used anywhere in this variant, consistent with the palette rule in `tokens/README.md` / `docs/UI_IMPLEMENTATION_PLAN.md`.

---

## States

- **Page thumbnails (workspace preview card):** two "Ready" (`success` badge) + one "Processing" (`processing` badge) in the wireframe — mirrors the real `Page Status States` in `docs/Wireframe_Implementation.md` (`OCR_COMPLETE`/`ACCEPTED` ≈ Ready, in-flight OCR ≈ Processing). This card is illustrative/static; it is not wired to a real session's data in this spec.
- **Section list (sectioning card):** first row shown in an active/highlighted state (`success`-tinted background), remaining rows shown neutral (`background-sidebar`). No loading/empty/error state is defined for this preview card since it is decorative, not a live data view.
- **Buttons:** standard primary (`--color-brand-primary` fill, white text) and secondary (outline, `--color-border-card`) states only — no loading/disabled state specified for the marketing page.

---

## Component Location (if implemented)

Not yet built. If this layout is adopted, suggested locations following existing conventions:

- Extend `app/page.tsx`'s hero `<section>` with a new `components/landing/WorkspacePreviewCard.tsx` (static/mocked data), reusing `components/ui/Badge.tsx` (`success`/`processing` variants — already implemented, no new tokens needed) and `components/ui/Card.tsx`
- New `components/landing/SectioningPreviewCard.tsx` for the "Automatic Document Sectioning" card
- New `components/landing/StepFeatureRow.tsx` for the alternating card/copy rows, replacing or supplementing the current numbered `<ol>` "How it works" list

---

## Dependencies

- `design-specs/tokens/colors.json` — Navy/Slate light-mode tokens (already implemented app-wide via `app/styles/tokens.css`)
- `components/ui/Card.tsx`, `components/ui/Badge.tsx` — already built, reusable as-is
- `design-specs/functionality/landing-spec.md` — base landing-page interaction rules (navbar scroll behavior, responsive breakpoints, CTA routing) still apply to this variant

---

## Deferred / Out of MVP

- Whether this preview-card layout replaces, A/B tests against, or is dropped in favor of the current simpler `app/page.tsx` layout is a product decision, not resolved by this spec
- Dark-mode (Teal/Charcoal) version of this specific wireframe has not been produced
- Real (non-mocked) data wiring for the workspace preview card is out of scope — see `docs/01_MVP_PRD.md` for actual document/page lifecycle rules if this is ever wired to live data
- CTA destinations in the original wireframe ("Sign in", "Create Free Account") reference `/signup`/`/login`-style routes that don't exist in this app; per `docs/UI_IMPLEMENTATION_PLAN.md`'s note on `landing-spec.md`, any real implementation should route through the existing `/app/save` variants and privacy-gate modal instead
