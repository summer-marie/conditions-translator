# Usability + UI Audit

**Purpose**: Focused usability and UI review of the running app — actionable issues only, no broad redesign recommendations.

**Audit Date**: 2026-07-18
**Reviewer**: Claude Code (Sonnet 5)
**Status**: No fixes applied in this pass — findings only, per request.

---

## Verification scope

**Verified directly**: guest onboarding flow (privacy accept → workspace → dashboard → chat → save/signup forms), desktop (1280px) and mobile (375px) viewports, focus-visible behavior via real keyboard Tab presses, WCAG contrast math on the caption/meta text token, live DOM inspection of touch-target sizes and form validation behavior, and source-code confirmation for two of the findings below (drag-and-drop copy, native `confirm()` usage).

**Not verified**: authenticated multi-document dashboard at scale, real OCR/Finish Document round-trip (would require a paid OpenAI call — not re-run this pass), landing/About/Terms desktop layout at very wide viewports (>1440px), screen-reader output (only DOM/ARIA attributes and focus-visible CSS were checked, not an actual screen reader).

---

## A. High-priority issues

### 1. "Upload Pages" promises drag-and-drop that doesn't exist
- **Severity**: high
- **Location**: `app/app/workspace/page.tsx`, Upload Pages dropzone (and its "Start a New Document" variant)
- **Problem**: The label reads "Click to upload **or drag and drop**," but there is no `onDrop`/`onDragOver` handler anywhere in the component — confirmed by grep, only `onChange` on a hidden file input. Dragging a file onto the box does nothing.
- **Why it matters**: Users will try the advertised interaction, watch it silently fail, and may conclude the upload is broken rather than retry by clicking. This is a real trust/comprehension issue, not cosmetic.
- **Recommended fix**: Either implement `onDrop`/`onDragOver`/`onDragLeave` on the label (small, self-contained addition reusing the existing `handleFileUpload` logic), or remove "drag and drop" from the copy until it's built.

### 2. Caption/meta text fails WCAG AA contrast on the app canvas
- **Severity**: high
- **Location**: every use of `--color-text-meta` (`#6B7280`) on `--color-background-page` (`#D6E0EA`) — page counts in headers, footer copyright, form helper text ("Provide at least an email or a username"), citation markers on `/about`, document-card metadata on the dashboard.
- **Problem**: Computed contrast ratio is **~3.6:1**. WCAG AA requires 4.5:1 for normal-size text (12px caption text does not qualify as "large text").
- **Why it matters**: This token is used pervasively for supporting information users still need to read (form guidance, page counts, timestamps). Low-vision users may not be able to read it at all.
- **Recommended fix**: Darken `--color-text-meta` (e.g., toward `#5A6472` or similar) until it clears 4.5:1 against `#D6E0EA`, and re-verify the dark-mode pairing too. This is a one-line token change with wide reach — check it doesn't fail against `--color-background-card`/`--color-background-subtle` either before committing.

---

## B. Medium-priority issues

### 3. Two different patterns for the same "delete, cannot be undone" action
- **Severity**: medium
- **Location**: `app/app/workspace/page.tsx` (`handleDeletePage`, line ~577) vs. `app/app/dashboard/page.tsx` (delete-document modal)
- **Problem**: Deleting a page uses a native `window.confirm()` browser dialog (unstyled, blocks the JS thread, can't match the app's design system). Deleting a document uses a proper custom modal with styled Cancel/Delete buttons.
- **Why it matters**: Same class of destructive, irreversible action, two different UX patterns depending on which screen you're on — inconsistent and the native dialog looks broken/unpolished next to the rest of the app.
- **Recommended fix**: Replace the page-delete `window.confirm()` with the same lightweight confirm-modal pattern already built for document deletion.

### 4. Guest onboarding can create duplicate empty documents
- **Severity**: medium
- **Location**: `app/app/workspace/page.tsx`'s `initializeWorkspace()` auto-create path (guest-only branch)
- **Problem**: Observed twice in this session: a single fresh guest session ended up with **two** identical "Untitled Document / 0 pages / In Progress" entries in the dashboard, which then correctly triggered the app's own "Similar document name" warning. The auto-create call has no guard against being invoked twice concurrently.
- **Why it matters**: A confusing, self-inflicted clutter state right at first use — a brand-new user could see duplicate empty documents before they've done anything.
- **Caveat**: I could not conclusively reproduce this as a clean single-navigation repro against a fresh cookie (one isolated test produced exactly one document); it may be specific to Next.js dev-mode's double effect invocation rather than a production bug. **Worth confirming against a production build before prioritizing**, but the underlying code has no idempotency guard regardless, so it's worth hardening either way (e.g., a request-in-flight ref/lock around the create call).
- **Recommended fix**: Guard `initializeWorkspace()`'s create branch with an in-flight ref so a second concurrent call is a no-op.

### 5. "Log in" and "Save workspace" are two near-identical buttons with unclear framing
- **Severity**: medium
- **Location**: `app/app/workspace/page.tsx` header (already flagged in the code's own `TODO(cleanup)` comment, still unresolved)
- **Problem**: A signed-out returning user sees "Log in" and "Save workspace" side by side; both land on `/app/save`, and the page still frames everything as "save your workspace" even for someone who just wants to sign in with nothing to transfer.
- **Why it matters**: Two same-weight buttons for what reads as "sort of the same thing" is a real decision-paralysis moment on a screen (auth) where trust matters.
- **Recommended fix**: Already scoped in the codebase's own tracked follow-up — differentiate visual weight (one primary, one secondary/link-styled) and let `/app/save?mode=signin` land on copy that doesn't mention "saving."

### 6. Page-review action buttons are under the mobile touch-target minimum
- **Severity**: medium
- **Location**: `app/app/workspace/page.tsx`, Accept/Re-upload/Delete buttons on each page card (`Button size="sm"`, `px-3 py-1.5 text-xs`)
- **Problem**: Rendered height is roughly 28–30px — below the ~44px minimum recommended for touch targets (Apple HIG / Google Material), on three side-by-side buttons that include a **destructive** one (Delete).
- **Why it matters**: This app's own PRD calls out phone-camera uploads as a primary path; these three buttons are the exact controls used right after taking a photo on a phone. Small targets next to a destructive action raise real mis-tap risk.
- **Recommended fix**: Bump these three specifically to `size="md"` on mobile (`className="sm:size-sm"`-style override, or a responsive size prop), or add vertical padding via a mobile-only class — smallest fix is increasing tap padding without changing visual density on desktop.

---

## C. Low-priority polish issues

### 7. Emoji-as-icon doesn't match the app's SVG icon system
- **Severity**: low
- **Location**: Dashboard empty/error states (📄, ⚠️), workspace OCR quality badges (📷 ✂️ 🔄 📄 ❓)
- **Problem**: These are raw emoji characters styled with `className="text-(--color-text-meta)"` — CSS `color` has no effect on full-color emoji glyphs, so the intended muted styling silently does nothing, and the emoji render with platform-default colors that don't match the app's navy/blue-gray palette. Everywhere else (AppNav, buttons, badges) uses hand-drawn SVG icons.
- **Why it matters**: Minor visual inconsistency; emoji also render differently across OS/browser, so the dashboard can look different on Windows vs. macOS vs. mobile.
- **Recommended fix**: Swap for small inline SVGs matching the existing icon style, at least on the dashboard's empty/error states which are a first impression.

### 8. Save/sign-in form has no client-side pre-validation
- **Severity**: low
- **Location**: `app/app/save/page.tsx`
- **Problem**: Submitting the create-account form with nothing filled in requires a full server round-trip before showing "Enter an email or a username to create your account." (confirmed working, just server-only — no `required` attributes or pre-submit check client-side).
- **Why it matters**: Minor latency/friction on an obviously-invalid submission; not broken, just slower than it needs to be.
- **Recommended fix**: Add a lightweight pre-submit check (or `required` attributes) mirroring the existing server validation message.

---

## D. What is already working well

- **Focus-visible styling is genuinely solid.** Verified via real keyboard Tab presses (not just CSS inspection): every interactive element tabbed through — skip link, header controls, sidebar nav — showed a clear, correctly-colored focus ring. (An initial test pass using `.focus()` instead of real key presses gave a false negative from Playwright/`:focus-visible` semantics; corrected before reporting.)
- **Empty states are clear and actionable** (dashboard "No documents yet" + CTA, chat "You don't have any ready documents yet" + direct link to workspace) — good copy, obvious next step, no dead ends.
- **Mobile bottom nav touch targets are correctly sized** (measured at 125×50px each — comfortably above the 44px minimum).
- **The duplicate-title warning on the dashboard is a genuinely good, already-built safety net** — it's exactly what catches the auto-create duplication issue above; it's doing its job.
- **The organized-document/Sections view and sidenav document list** (recently added) transition cleanly from intake to read-mode without losing the always-available upload entry point — a real usability improvement over the prior single-document-only workspace.
- **Mobile-specific footer CTA reveal-near-bottom behavior** works as designed and doesn't fight the app shell's own bottom tab bar, because it's correctly scoped to public pages only.

---

## E. Suggested next implementation order

1. **Fix #1 (drag-and-drop copy/functionality)** — cheap, high-trust-impact, isolated to one component.
2. **Fix #2 (meta text contrast)** — one token change, wide reach, real accessibility blocker.
3. **Fix #6 (touch targets on page-review buttons)** — small, mobile-first app, directly on the primary phone-camera flow.
4. **Fix #3 (native confirm() → custom modal)** — small, reuses an existing pattern already built for the dashboard.
5. **Fix #4 (duplicate document guard)** — confirm against a production build first, then add the idempotency guard regardless.
6. **Fix #5 (Log in / Save workspace framing)** — already scoped by the codebase's own TODO; do when ready for a small copy/hierarchy pass.
7. **Fix #7 and #8** — low-priority polish, bundle into a future cleanup pass rather than a dedicated one.

No commits were made as part of producing this report.
