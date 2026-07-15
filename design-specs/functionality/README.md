# Functionality Specs

Detailed interaction and behavior specs for each screen of the app. Use these alongside the exported Figma wireframe images for implementation.

## Files

- dashboard-spec.md — Document management workspace. Upload flow, status badges, document cards, sidebar navigation, empty states, error handling.
- landing-spec.md — Public marketing page. Hero, features grid, how-it-works steps, navbar scroll behavior, responsive rules.
- login-spec.md — Authentication flow. Email-optional signup with password recovery warning, sign-in, forgot-password, input validation, security notes.
- chat-spec.md — AI document Q&A. Message bubbles, citation chips, document context panel, AI grounding rules, streaming responses.

## Key Decisions Across All Screens

- Email is NEVER required for signup. Username-only accounts are fully supported.
- App name ("Conditions Translator") is not final — use an environment variable.
- Desktop uses sidebar navigation (240px). Mobile uses bottom tab bar.
- All primary action buttons use emerald (#059669).
- All destructive actions use crimson (#B91C1C) and require confirmation.
- Loading states use skeleton placeholders with pulse animation, never blank screens.
