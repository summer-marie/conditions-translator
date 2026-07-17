# Functionality Specs

Detailed interaction and behavior specs for each screen of the app. Use these alongside the
**approved** wireframes in `../wireframes/approved/` and the approved visual system in
`light-theme-visual-direction.md`.

> **Visual guidance in these specs is subordinate to `light-theme-visual-direction.md` and the
> approved wireframes.** Where an older sentence below conflicts with the approved visual direction
> (e.g. green primary buttons, white surfaces), the approved direction wins. These specs remain
> authoritative for **behavior, states, and interaction** — not superseded visual color notes.

## Files

- dashboard-spec.md — Document management workspace. Upload flow, status badges, document cards, sidebar navigation, empty states, error handling.
- landing-spec.md — Public marketing page. Hero, features grid, how-it-works steps, navbar scroll behavior, responsive rules.
- login-spec.md — Authentication flow. Email-optional signup with password recovery warning, sign-in, forgot-password, input validation, security notes.
- chat-spec.md — AI document Q&A. Message bubbles, citation chips, document context panel, AI grounding rules, streaming responses.

## Key Decisions Across All Screens

- Email is NEVER required for signup. Username-only accounts are fully supported.
- App name ("Conditions Translator") is not final — use an environment variable.
- Desktop uses sidebar navigation (240px, deep navy). Mobile uses bottom tab bar.
- **Primary action buttons use deep navy (#0F1B33).** Green (#16A34A) is a **success-only** accent
  (save/confirm, ready states, positive completion) — never the default primary or navigation color.
- All destructive actions use the destructive accent (#DC2626) and require confirmation.
- Loading states use skeleton placeholders with pulse animation, never blank screens.
