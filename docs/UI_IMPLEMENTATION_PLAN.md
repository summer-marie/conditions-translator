# UI Implementation Plan

## Goal of Current UI Effort
Provide a reusable reference for implementing and refining UI components based on approved wireframes and design specifications. This plan is for **Phase 10 (UI Refinement and Documentation)** after Phase E2E testing completes.

## Current Phase / Roadmap Context
**Phase**: Phase 10 — UI Refinement (substantially complete)
**Branch**: `feature/design-token-integration`
**Status**: Design-token migration, shared components, shared nav (incl. desktop sidebar
collapse), dark mode + visual QA, and an accessibility/interaction pass are all done. See
`.cline/session-memory.md` (full chronological detail) and
`.claude/session-memory/OPEN_QUESTIONS.md` (current remaining-scope tracker) for specifics —
this file only carries the durable planning content that doesn't change pass-to-pass.
**Remaining**: none of Phase 10's planned slices — document inspector panel (chat, desktop-only)
and app-name-as-shared-constant both shipped 2026-07-16. Check
`.claude/session-memory/OPEN_QUESTIONS.md`'s "How to apply" line for any smaller follow-ups
(mobile inspector behavior, a seeded live-verification pass) before assuming there's nothing left.

**Architecture note (2026-07-16, explicit product decision, not a UI-pass judgment call):** the
site root (`/`) used to hard-redirect straight to `/app/start`, matching `docs/01_MVP_PRD.md`
§4's documented guest journey (`Guest → Create Document → ...`, no landing-page step). That
redirect has been replaced with a real public landing page — this is a deliberate divergence
from the PRD's literal documented journey, approved explicitly before implementation (see
`.cline/session-memory.md`'s "Public Marketing Landing Page" entry for the full decision
trail). `docs/01_MVP_PRD.md` §4 itself was **not** edited and still describes the old journey
verbatim — if it's read as the sole source of truth without this note, it will look
inconsistent with the live app. Treat this file's note as current; update the PRD directly in
a future pass if this divergence should become the permanent documented journey.

## Screens/Features Implemented (Phase 10 Order)
1. **Dashboard UI refinements** — DONE: document card polish, empty/error/loading states,
   shared `Card`/`Button`/`Badge`, heading-hierarchy fix, modal focus traps.
2. **Chat interface refinements** — DONE: message threading polish, citation display, dark-mode
   verification with a real message/citation. **Document inspector panel — DONE** (2026-07-16):
   `components/chat/DocumentInspector.tsx`, desktop-only (`md:`, 320px), stacked per-document page
   lists with accepted-pages-only numbering matched to `lib/chat/context.ts`'s citation numbering,
   persistent cited-page styling, and click-to-scroll/highlight from citation pills. Mobile
   citation/inspector behavior remains out of scope (see Open Questions below). Not yet exercised
   live against a seeded session — see Open Questions.
3. **Workspace intake flow refinements** — DONE: upload UX, OCR review flow, status Alerts,
   dark-mode verified against real (seeded) data-gated states.
4. **Login/Signup flow refinements** — DONE (scoped): token/component migration, form label
   association. Split-layout/password-strength/email-warning-modal redesign from
   `login-spec.md` intentionally NOT done — see that spec's framing vs. this app's simpler
   stopgap flow, tracked as its own open item.
5. **Mobile optimization** — DONE: bottom tab bar, top bar/hamburger, 768px breakpoint,
   touch-target sizing. Desktop sidebar now also collapses (see below) — mobile nav was
   explicitly untouched by that pass.
6. **Accessibility improvements** — DONE (two passes): focus rings, Escape-to-close, focus
   traps + initial-focus + restore-to-trigger on all overlays, skip link, `<main>` landmark,
   form label associations, live regions for dynamic content, one heading-hierarchy fix. No
   full screen-reader (NVDA/VoiceOver) run has been done — verified via code review + keyboard
   simulation only.
7. **Desktop sidebar collapse** — DONE: toggles between 240px and a 64px icon rail, persisted,
   desktop-only. One disclosed tradeoff: the theme toggle hides while collapsed (not enough
   width for two icon buttons) — see `.cline/session-memory.md`'s "Desktop Sidebar Collapse"
   entry for the reasoning.
8. **Start / Privacy Notice Gate refinement** — DONE: `app/app/start/page.tsx` (the consent
   gate shown before a temporary user's first document, not the public marketing page — see
   the two separate spec entries below) migrated to tokens and shared `Card`/`Button`/`Alert`;
   correct in both themes; single `h1`→`h2` hierarchy preserved. Still exists unchanged as the
   fallback route reached when workspace/chat detect an unaccepted session client-side.
9. **Public marketing landing page** — DONE: `app/page.tsx` (the site root) now serves real
   content instead of redirecting — header, hero, 3-card features grid, "How It Works" steps,
   footer — using tokens and shared `Card`/`Button` throughout. The primary CTA ("Add your
   first document") opens the *same* privacy-notice content as `app/app/start/page.tsx` (a
   duplicated, not shared, component — see `components/landing/PrivacyGateModal.tsx`) as a
   modal overlay; accepting it creates a session (if one doesn't exist yet) and continues into
   `/app/workspace`, all through the existing `acceptPrivacy` Server Action. See the
   "Architecture note" above — this replaces a hard redirect that was previously load-bearing
   for the guest entry flow.
10. **Finished-document overflow actions (sidenav/mobile menu)** — DONE (2026-07-18):
    `components/layout/AppNav.tsx`. Each finished document listed in the sidenav (desktop) or
    hamburger menu (mobile) remains visible there after completion, alongside the fixed
    Dashboard/Workspace/Chat items. Clicking the title link is unchanged and still opens that
    document's finished/organized view in `app/app/workspace/page.tsx` (Sections tab by default).
    It now also has an overflow (kebab) trigger alongside the title link, offering two actions:
    **Review pages** and **Delete document**. See "Overflow actions
    (popover/sheet)" under Shared Layout/Component Patterns below for the desktop-vs-mobile
    presentation and reuse notes. Reviewing pages lands on `app/app/workspace/page.tsx` with a
    new `?panel=pages` query param that switches the existing finished-document card from its
    default "Sections" tab to a new read-only "Pages" tab (thumbnail grid reusing the existing
    click-to-expand image modal; no Accept/Re-upload/Delete controls, since page-level mutation
    stays IN_PROGRESS-only per `requireInProgressOwnedDocument`). Deleting reuses
    `app/app/dashboard/page.tsx`'s existing delete-confirmation modal pattern verbatim (own state
    in `AppNav`, same `DELETE /api/documents/[id]` endpoint); on success the document is removed
    from the nav's own list and, if the user was currently viewing that exact document in the
    workspace, they're redirected to the plain `/app/workspace` route (which already has a
    graceful fallback to the active intake document or empty state).
    **Follow-up fix (2026-07-18, same day):** the sidenav's finished-document list only re-fetched
    on route (pathname) changes, so a document that had just been finished via **Finish Document**
    (an in-place status transition on the same `/app/workspace` route, no navigation) did not
    appear in the sidenav — and therefore had no overflow-actions entry point — until the user
    happened to navigate elsewhere and back. Fixed by adding a `DOCUMENTS_CHANGED_EVENT` window
    event (`lib/constants.ts`): `app/app/workspace/page.tsx`'s `handleFinishDocument` dispatches it
    right after `finishDocument()` succeeds, and `AppNav`'s existing fetch effect now also listens
    for it (in addition to its `[pathname]` dependency), refetching immediately. Confirmed live via
    a real upload → OCR → accept → Finish Document round trip (not a DB fixture): the sidenav now
    shows the document, and its overflow menu's "Review pages" works, immediately after finishing
    — with no navigation in between. The main workspace view's default state is unaffected: a
    freshly finished document still centers its Sections tab by default, with Pages reachable only
    through Review pages, exactly as designed.

## Relevant Wireframe/Design-Spec Files by Screen

### Dashboard
- **Spec**: `design-specs/functionality/dashboard-spec.md`
- **Components**: Document cards, upload area, search/filter bar, sidebar navigation
- **Current Implementation**: `app/app/dashboard/page.tsx` (functional shell exists)

### Chat Interface  
- **Spec**: `design-specs/functionality/chat-spec.md`
- **Components**: Message bubbles, citation pills, document inspector, input bar
- **Current Implementation**: `app/app/chat/page.tsx` (functional, needs polish)
- **Critical Rules**: Chat is ephemeral, no persistent history, max 3 documents per session

### Login/Signup
- **Spec**: `design-specs/functionality/login-spec.md`
- **Components**: Split layout forms, password strength indicator, email warning modal
- **Current Implementation**: `app/app/save/page.tsx` (functional, needs refinement)

### Landing Page (public marketing page — NOT the same as "Start" below)
- **Spec**: `design-specs/functionality/landing-spec.md` — followed with disclosed deviations
  (see below); the spec itself routes CTAs to `/signup`/`/login`, routes that don't exist in
  this app, and was never reconciled against the app's real auth entry points before this pass
- **Components**: header (app name + "Log in" → `/app/save?mode=signin`, a real route), hero
  (headline reusing `app/layout.tsx`'s existing metadata tagline verbatim, subtitle, primary
  CTA opening the privacy-gate modal, secondary anchor-scroll link), 3-card features grid
  (shared `Card`), numbered "How It Works" steps, a repeated bottom CTA, minimal footer
- **Deviations from the spec, disclosed**: dropped the nav's "Pricing" link (no pricing model
  exists anywhere in this product); dropped the "Social Proof / Trust" section (no real
  testimonials/usage stats exist — fabricating them would misrepresent the product); dropped
  the footer's Privacy Policy/Terms/Contact links (none of those pages exist). CTAs route to
  `/app/save` variants and the privacy-gate modal, never to the spec's nonexistent
  `/signup`/`/login`.
- **Current Implementation**: `app/page.tsx` — DONE. See the "Public marketing landing page"
  item above and the "Architecture note" earlier in this file for the redirect-removal
  decision.
- **Follow-up visual/responsive pass (2026-07-18/19, `docs/landing-page-content-update`, merged
  `main` PR #27)**: an `/faq` page was added (linked from the shared footer alongside About/
  Terms); landing hero/how-it-works/bottom-CTA copy was rewritten; a token-derived ambient "glow"
  background system was added to the landing page's four sections, the About/Terms/FAQ pages, and
  the public header (`app/globals.css` — every gradient stop `color-mix()`-derived from existing
  tokens, no new palette; light mode fully built, dark mode ported and intensity-tuned per
  explicit user feedback); the landing page was converted to a rem-first fluid `clamp()` sizing
  system (`--landing-font-*`/`--landing-space-*`/`--landing-container-px` tokens) replacing
  discrete Tailwind breakpoint jumps, with a follow-up fix narrowing two headings' pre-breakpoint
  max-widths after measuring a real ~200-490px width "snap" at the `lg` column-layout breakpoint;
  and a sitewide (not landing-only) `@media (any-pointer: fine)` pointer-cursor rule was added.
  See `.agent-memory/DECISIONS.md` and `WORK_LOG.md` for full detail. `PublicHeader`/`FooterCTA`
  (shared with About/Terms/FAQ) and shared UI primitives were deliberately left out of the fluid
  conversion, staying on their existing fixed-rem values.

#### Workspace-preview variant ("Option B" navy) — hero + "Product Workspace" rows

- **Spec**: `design-specs/wireframes/reference/browser-landing-page/browser-landingpage-spec-preview.md`
  (the task that requested this named a `design-specs/functionality/landing-workspace-preview-spec.md`
  path that does not exist — this is the actual file; flagged to the user, confirmed as the
  intended source). Wireframe: `design-specs/wireframes/approved/desktop/browser-landingpage-navy.png`
  (the spec's own `../wireframes/exports/...` path is also stale/missing, same root cause).
- **Built**: hero extended to two columns (existing accurate headline/subtitle/CTAs unchanged,
  left; new `components/landing/WorkspacePreviewCard.tsx` — static/mocked 3-page thumbnail
  preview with Ready/Processing badges — right, hidden below `sm`). "How it works" replaced with
  a "Product Workspace" tinted section containing two alternating rows via the new
  `components/landing/StepFeatureRow.tsx`: an inline OCR-extraction card (reusing `Card`) +
  Step 01 copy, then Step 02 copy + `components/landing/SectioningPreviewCard.tsx` (static
  2-row section list, first row highlighted). All three new components reuse the existing
  `Card`/`Badge` — no new Badge variants added.
- **Disclosed deviations**:
  - Kept the existing, accurate hero headline/subtitle ("Understand your supervision documents
    in plain language...") instead of the wireframe's generic marketing copy ("Upload. Organize.
    Understand." / "fully searchable, structured data stores... extract facts from tables"),
    which describes a different, more generic document-intelligence product than this app
    actually is.
  - Kept the existing real secondary CTA ("See how it works", anchor-scroll) instead of the
    wireframe's "Try a Demo" button — no demo route/feature exists.
  - The spec's "Color Mapping" table lists stale hex values that predate the final light-theme
    token re-roll (`511bbda`/`4d82a8d`) — built against the spec's token *names* instead (all of
    which do exist in `tokens.css`), pulling live values from `tokens.css`, not the spec's table.
  - The spec maps two fills (the workspace-preview panel body, and the sectioning card's inactive
    row) to `--color-background-sidebar` — that token now resolves to deep-navy nav chrome (post
    rebrand), not a light neutral tint. Substituted `--color-background-subtle` for both, per
    `Card.tsx`'s own documented tone-separation rule and `Badge.tsx`'s existing `neutral` variant
    using the same token.
  - CTAs continue routing through `/app/save` variants + `GetStartedCTA`'s privacy-gate modal,
    never to `/signup`/`/login` (matches this file's existing landing-spec deviation note above).
- **Deferred** (per the spec's own "Deferred / Out of MVP" section, unchanged): dark-mode version
  of this layout; whether this variant replaces, A/B tests, or is dropped vs. the simpler
  already-shipped layout (still a product decision, not resolved here — both coexist in the same
  page today since this pass only extended, not replaced, `app/page.tsx`); real (non-mocked) data
  wiring for either preview card.
- **Images not yet supplied** (placeholders in place, each with a code comment stating the exact
  ask): three ~160×120px page thumbnails in `WorkspacePreviewCard.tsx`, and one ~600×360px OCR
  extraction screenshot in `app/page.tsx`'s inline OCR card. The sectioning card needs no image
  (text/badge rows only, matching the wireframe).
- **Verified**: `tsc --noEmit`, `npm run lint` (baseline unchanged, 24 errors/4 warnings, none in
  touched files), `npm run build`, and a real dev-server run screenshotted at 1440/768/390px —
  two-column hero + alternating rows at desktop, preview card moves below hero copy at 768px,
  preview card hidden and rows stack card-above-text with no alternation at 390px, all as
  specified.

### Start / Privacy Notice Gate (mid-flow consent screen — NOT the public landing page above)
- **Spec**: none dedicated — defined by the page's own code comment and the PRD's consent
  requirement (`docs/01_MVP_PRD.md`, `docs/05_Account_Creation_and_Temporary_Access.md`); not
  covered by `landing-spec.md`
- **Components**: Shared `Card` (centered content box), `Alert` (tone="processing", the privacy
  bullet list), `Button` (primary, "I Understand" submitting the `acceptPrivacy` Server Action)
- **Current Implementation**: `app/app/start/page.tsx` — DONE (token-migrated). Not wrapped in
  the shared nav shell (`HIDDEN_ROUTES` in `components/layout/AppNav.tsx`), same as
  `/app/save`. Two ways to reach the same underlying gate now: this standalone route (still
  used as a fallback when workspace/chat detect an unaccepted session and `router.push` here
  client-side), and `components/landing/PrivacyGateModal.tsx` (same notice copy, duplicated
  not shared, presented as an overlay from the landing page's primary CTA instead). Both submit
  the same `acceptPrivacy` Server Action (`lib/actions/privacy.ts`), which now get-or-creates
  the temp session rather than requiring one to already exist, since the landing-page path has
  no prior guarantee one does.

### Color Theme
- **File**: `design-specs/tokens/colors.json`
- **Modes**: Light (navy/slate), Dark (teal/charcoal)
- **Reference**: `design-specs/wireframes/exports/color-theme-reference.png`

### Typography
- **File**: `design-specs/tokens/typography.json`
- **Primary**: Inter (Google Fonts)
- **Mono**: JetBrains Mono (for code/OCR display)
- **Weights**: 400, 500, 600, 700

## Token/Theme Rules That Must Be Followed

### Color Usage
- **Light mode**: Navy primary (#1E3A5F), slate grays for text/borders, emerald for success
- **Dark mode**: Teal/charcoal palette, white/light grays for text, same accent colors
- **No purple** in any UI elements (explicitly excluded)
- **Accent colors** (emerald, amber, crimson, teal) consistent across modes
- Use CSS custom properties for theme switching

### Typography
- **Primary font**: Inter, with system font fallback
- **Mono font**: JetBrains Mono for OCR text/code display only
- **Display**: 32px, weight 700, tight tracking (-0.02em)
- **Headings**: 24px (h1), 20px (h2), 16px (h3)
- **Body**: 14px, weight 400, 1.5 line height
- **Caption/Meta**: 12px, weight 400

### Tailwind/CSS Syntax Conventions
- Use current Tailwind syntax for the version actually installed (check `tailwindcss` in `package.json`, currently v4) — do not rely on remembered v3 patterns without checking current docs.
- **Convention (resolved 2026-07-15, supersedes any earlier note in this file):** reference
  design-token CSS custom properties with the **shorthand** form — `bg-(--color-x)`,
  `text-(--color-x)`, `border-(--color-x)`. All 80+ existing occurrences across
  `components/ui/Button.tsx`, `Badge.tsx`, and every migrated page were converted from the
  older bracket form (`bg-[var(--color-x)]`) to this shorthand and committed; both forms
  compile to byte-identical CSS, but shorthand is now the established convention going
  forward. See `.claude/session-memory/OPEN_QUESTIONS.md` for the full resolution — do not
  re-raise bracket-vs-shorthand as an open question.
- There is also a distinct, valid **type-hint** syntax for cases where the bare shorthand
  resolves to the wrong CSS property (see the font-size trap below):
  `text-(length:--font-size-h2)` forces `font-size`; bare `text-(--color-x)` already resolves
  to `color` by default, so no `color:` hint is needed for colors.
- **Known trap**: the `text-` prefix is ambiguous between text-color and font-size. Tailwind
  cannot introspect a CSS variable's value at build time and defaults to treating `text-*` as
  a color — using it directly for a font-size token silently compiles to `color:
  var(--font-size-h1)` instead of `font-size`. Either use the `text-(length:--x)` type-hint
  syntax above, or set font-size via inline `style={{ fontSize: 'var(--font-size-x)' }}` —
  both are in live use across the codebase; either is acceptable, just don't use bare
  `text-(--font-size-x)` for a font-size token. (Found and fixed in the dashboard/chat/save
  token migrations — see commit history on `feature/design-token-integration`.)
- A successful `npm run build` does **not** guarantee an ambiguous-prefix class compiled to the intended CSS property. After adding or changing a token-based utility class, spot-check the compiled output in `.next/static/chunks/*.css` for the property you expect.
- A related, separate trap already hit twice on this branch (not a `text-` issue): two
  utility classes can target the *same* CSS property (e.g. `p-4` and `px-2` both set
  `padding-left`/`padding-right`) and which one wins is decided by declaration order in the
  *compiled* stylesheet, not by position in the class string. Never write conditional
  className logic like `` `p-4 ${collapsed ? "px-2" : ""}` `` — use fully disjoint branches
  (`collapsed ? "px-2 py-4" : "p-4"`) instead.

### Spacing (from design-specs/README.md)
- Use consistent spacing scale (specific values in `design-specs/tokens/spacing.json`)
- Section spacing: 48px desktop, 32px mobile
- Card backgrounds: #EDF2F7 (light), #1F2937 (dark)

### Layout Patterns
- **Desktop (>=768px)**: Sidebar visible, multi-column layouts, right panels
- **Mobile (<768px)**: Bottom tab bar, single column, full-width cards
- **Navbar**: 64px desktop, 56px mobile
- **Sidebar**: 240px wide expanded; collapses to a 64px icon-only rail via a toggle in the
  sidebar header (implemented — desktop-only, persisted via `localStorage`)
- **Right panels**: 320px, collapsible — built for chat's Document Inspector
  (`components/chat/DocumentInspector.tsx`), desktop-only, a separate feature from the left
  sidebar above

## Shared Layout/Component Patterns to Reuse

### Navigation
- **Desktop**: Sidebar with navigation links, active state highlighted (emerald)
- **Mobile**: Bottom tab bar with icons, active state highlighted
- **App logo**: Always routes to dashboard when clicked

### Overflow actions (popover/sheet) — added 2026-07-18
For a per-item "..." actions trigger on a list row (first used for finished documents in the
sidenav/mobile menu, `components/layout/AppNav.tsx`'s `DocumentActionsMenu`):
- **Desktop**: small anchored popover (`role="menu"`, `--color-background-card` surface,
  `--color-border-card` border, `shadow-lg`, positioned `absolute right-0 top-full` off the
  trigger button) with an invisible full-viewport backdrop (click-outside-to-close, no dimming —
  a popover is lighter-weight than a modal). Keep this style for any future per-row overflow menu
  rather than inventing a new one.
- **Mobile**: full-width bottom action sheet (`fixed inset-x-0 bottom-0`, `rounded-t-xl`, same
  `--color-background-card`/`--color-border-card` surface, a real dimmed backdrop matching the
  existing modal weight (`bg-black/50`), `min-h-11` rows for touch targets, an explicit trailing
  Cancel row). Reuse this shape for any future mobile action-sheet need instead of a new pattern.
- **Shared conventions**: both variants reuse `useFocusTrap` (already used by every other
  modal/menu in the app) and their own Escape-key listener; destructive items use
  `--color-accent-destructive` text on the card surface (not a solid danger button — that's
  reserved for an actual confirmation modal's buttons, see Cards/destructive-modal note below);
  no new colors were introduced — every surface/border/text token above already existed for both
  light and dark mode.
- **Destructive confirmation**: an overflow menu's destructive action (e.g. "Delete document")
  should still open the existing full confirmation-modal pattern (see the dashboard's
  delete-document modal, `app/app/dashboard/page.tsx`) rather than deleting directly from the
  menu/sheet — the overflow menu only decides *which* document, the modal still gates the actual
  destructive call.

### Cards
- **Default**: Card background + subtle shadow
- **Hover**: Elevated shadow + quick actions appear
- **Selected**: Left border accent (3px navy), slight elevation
- **Status badges**: Consistent color coding (uploaded=gray, processing=teal, complete=emerald, error=crimson)

### Input Fields
- **Default**: Gray border (#CBD5E1)
- **Focus**: Navy border (#1E3A5F) + focus ring (rgba(30, 58, 95, 0.3))
- **Error**: Red border (#B91C1C) + error message below
- **Success**: Green border (#059669) + checkmark icon

### Buttons
- **Primary**: Emerald background (#059669), white text, hover darkens
- **Secondary**: Ghost/outline style
- **Loading**: Spinner replaces text, button disabled
- **Disabled**: 0.5 opacity, no pointer events

### Loading/Empty/Error States
- **Loading**: Skeleton cards with pulse animation, or spinner centered
- **Empty**: Illustration + CTA button, clear messaging
- **Error**: Toast notification + retry button, or inline error banner

## Required States Per Screen

### Dashboard
- **Loading**: Skeleton cards, pulse animation
- **Empty**: Illustration + "Upload your first document" CTA
- **Success**: Document grid/list with status badges
- **Error**: Upload failure toast, OCR error card with retry

### Chat
- **Loading**: Typing indicator (3 animated dots)
- **Empty**: "Select documents to start chatting" with document picker
- **Success**: Message thread with citations, document inspector active
- **Error**: Service unavailable message + retry, rate limit warning

### Login/Signup
- **Loading**: Button spinner, form disabled
- **Empty**: Default form state
- **Success**: Redirect to dashboard, welcome toast
- **Error**: Inline field errors, generic credential error, rate limit message

### Workspace
- **Loading**: Processing state with progress indicator
- **Empty**: No pages uploaded state
- **Success**: Document in progress, pages with OCR results
- **Error**: Upload failure, OCR failure with retry

## Responsive Requirements
- **Mobile-first design**: Design for small screens first, enhance for larger
- **Breakpoint**: 768px (mobile/tablet split)
- **Desktop must work**: Not mobile-only
- **Touch targets**: Minimum 44x44px on mobile
- **Font scaling**: Display 32px→24px on mobile, proportional scaling
- **Layout adaptation**: Grid to single column, sidebar to bottom tabs, multi-column to stack

## What Must Not Be Changed (Architecture Invariants)
- **Document lifecycle states**: IN_PROGRESS, COMPLETED, PROCESSING, READY, PROCESSING_FAILED
- **Page status states**: PENDING, OCR_COMPLETE, OCR_FAILED, ACCEPTED
- **Ownership model**: Every document has exactly one owner (user XOR temporary session)
- **AI grounding rules**: Only READY documents, only accepted page text, no general knowledge
- **Chat ephemerality**: No permanent chat history, sessions expire
- **Privacy guarantees**: Source text not logged, secrets server-side only
- **DELETE_PENDING/ACTIVE filtering**: Must be enforced in all read paths

## Suggested Implementation Order (Phase 10) — historical, kept for reference

This was the original week-by-week plan. Actual execution didn't follow it week-for-week, but
every item below except the two explicitly marked is now done — see the "Screens/Features
Implemented" section above for what actually happened and which commits/passes did it.

### Week 1: Core Component Polish — DONE
1. Refine shared button/input/card components with proper tokens
2. Implement proper color theme switching (light/dark modes)
3. Add consistent loading/empty/error states across screens
4. Polish status badges and color coding

### Week 2: Dashboard & Workspace — DONE
5. Dashboard document card polish (hover states, quick actions)
6. Upload area UX improvements (drag/drop, progress states)
7. Workspace OCR review flow refinements
8. Better page preview and accept/reject UX

### Week 3: Chat & Navigation — DONE
9. Chat message threading polish (better spacing, citation display)
10. Document inspector panel improvements — **DONE 2026-07-16** (desktop-only; see Screens/Features above)
11. Sidebar/bottom tab navigation refinement — done, including desktop sidebar collapse
12. Mobile touch interaction improvements

### Week 4: Authentication & Accessibility — DONE
13. Login/signup form validation polish
14. Email warning modal improvements — not done as a modal; see item 4 above
15. Keyboard navigation and focus management
16. Screen reader announcements and ARIA labels

### Week 5: Mobile & Final Polish — partially done
17. Mobile responsive testing and fixes — done
18. Performance optimization (lazy loading, code splitting) — not specifically addressed
19. Cross-browser testing — not done (verification this phase used Chromium via Playwright only)
20. Final visual polish and documentation updates — this update is part of that

## Open Questions / Missing Design Info

### Still open
- **Illustrations**: Specific illustration assets for empty states were never specified; current
  empty states use plain emoji (📄, ⚠️) instead, not real illustration assets.
- **Cross-browser testing**: All UI verification this phase used Chromium via Playwright only —
  no Firefox/Safari check has been done.
- **Found during the Phase 10 wrap-up review (2026-07-16), not yet fixed:**
  - `app/app/start/page.tsx:21` still hardcodes `"Welcome to Conditions Translator"` instead of
    using `APP_NAME` from `lib/constants.ts` — that constant's own pass deliberately scoped to
    `app/layout.tsx`/`app/page.tsx`/`AppNav.tsx` and left this file untouched, so it's now the one
    remaining un-migrated spot.
  - The public landing page (`app/page.tsx`) has no `<main>` landmark or skip link. Every
    `/app/*` screen gets both via `AppNav`'s wrapper, but the landing page (like `/app/save` and
    `/app/start`) renders outside that wrapper and never had its own added.
  - The landing page and `components/landing/PrivacyGateModal.tsx` were built *after* both
    dark-mode visual-QA passes landed (dark-mode fix commits predate the landing-page commit) —
    they use the same already-verified tokens/components (`Alert` tone="processing", `Card`-style
    token classes) so a visual bug is unlikely, but neither surface has had its own dedicated
    dark-mode check.
- **`docs/01_MVP_PRD.md` §4 — RESOLVED 2026-07-16.** Updated to
  `Guest → Landing Page → Accept Privacy Notice → Create Document → ...`, matching the
  implemented flow. See that file directly for the current text.

### Resolved during Phase 10 (kept here for history, not open anymore)
- **Icon set**: No library was added — hand-rolled inline SVG icons, matching the convention
  established in `components/layout/AppNav.tsx` (dashboard/workspace/chat pages already did
  this before nav existed). Consistent across the whole app now.
- **Theme persistence**: `localStorage`, with a system-preference (`prefers-color-scheme`)
  fallback for first-time visitors. See `app/layout.tsx`'s blocking inline script and
  `components/layout/AppNav.tsx`.
- **Animation library**: CSS-only — no Framer Motion or similar was added. Transitions use
  plain Tailwind (`transition-colors`, `transition-[width]`).
- **Form library**: Manual `useState` — no React Hook Form or similar was added anywhere.
- **Sidebar collapse persistence**: Same `localStorage` pattern as theme, same SSR-safe
  init-then-sync-in-effect shape to avoid a hydration mismatch.
- **Landing page**: Built (see the "Public marketing landing page" item above) as an explicit
  product decision to override the PRD's documented redirect-only guest entry. Privacy-gate
  entry via a modal, not a route-intercepting page — simple local `useState`, since the modal
  has no shareable URL and nothing to deep-link to.
- **Document inspector panel**: Built 2026-07-16, desktop-only — see the Chat interface item
  above.
- **App name as shared constant**: Built 2026-07-16 — `APP_NAME` in `lib/constants.ts`, sourced
  from `NEXT_PUBLIC_APP_NAME` with the existing string as fallback, used in `app/layout.tsx`
  metadata, `app/page.tsx` (header/footer), and `AppNav`'s sidebar/mobile-header logo. One
  instance intentionally left un-migrated — see "Still open" above.

### No longer applicable
- **Font loading (CDN vs. self-hosted)**: Not resolved or revisited during Phase 10; not
  blocking anything UI-visual, since no visual QA pass flagged a font-loading issue.
- This file used to carry its own "Deferred from Phase E2E" and "Dependencies on Phase 9"
  lists, predating Phase 10 entirely; removed as stale duplicates of
  `.agent-memory/OPEN_QUESTIONS.md`, which is the actual source of truth for that older
  material — check that file directly, not a summary here. Of the items that file tracked:
  the save/sign-in entry UI redesign remains open ("Save/sign-in entry UI needs a real pass, not
  just a stopgap" — the `login-spec.md` split-layout design still hasn't been implemented; the
  Save page's Phase 10 token-migration pass explicitly left this alone).
- **RESOLVED 2026-07-18 by item 10 above.** Two related items tracked in
  `.agent-memory/OPEN_QUESTIONS.md` — "workspace should support browsing multiple documents, not
  just the active intake doc" and "leaving chat makes saved documents look like they disappeared
  from workspace" — are resolved by the finished-document sidenav: it lists every finished
  document (not just the active intake one), is present on every `/app/*` route including chat,
  and switching to a listed document shows its pages nested underneath via Review pages. Neither
  entry has been marked resolved in `.agent-memory/OPEN_QUESTIONS.md` itself yet — that file
  wasn't in scope for this documentation pass; update it directly in a future pass.

---

**Next Steps When Implementing:**
1. Read this plan + all referenced spec files
2. Check `.agent-memory/CURRENT_SESSION.md` for latest context
3. Review existing implementation to understand current state
4. Implement one screen/component at a time, testing thoroughly
5. Update this plan if design decisions change during implementation
6. Document any deviations from specs in `.agent-memory/DECISIONS.md`