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
**Remaining**: document inspector panel (chat), landing page, app-name-as-shared-constant.
None of these are assumed to be next without an explicit go-ahead — check
`.claude/session-memory/OPEN_QUESTIONS.md`'s "How to apply" line for the live status before
picking one up.

## Screens/Features Implemented (Phase 10 Order)
1. **Dashboard UI refinements** — DONE: document card polish, empty/error/loading states,
   shared `Card`/`Button`/`Badge`, heading-hierarchy fix, modal focus traps.
2. **Chat interface refinements** — DONE: message threading polish, citation display, dark-mode
   verification with a real message/citation. **Document inspector panel — NOT built**, still
   deferred (a different, page-specific feature from global nav).
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

### Landing Page
- **Spec**: `design-specs/functionality/landing-spec.md`
- **Components**: Hero section, features grid, how-it-works steps
- **Current Implementation**: Not yet implemented (MVP may defer)

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
- **Right panels**: 320px, collapsible (not yet built — this is the still-deferred document
  inspector panel, a separate feature from the left sidebar above)

## Shared Layout/Component Patterns to Reuse

### Navigation
- **Desktop**: Sidebar with navigation links, active state highlighted (emerald)
- **Mobile**: Bottom tab bar with icons, active state highlighted
- **App logo**: Always routes to dashboard when clicked

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

### Week 3: Chat & Navigation — DONE except item 10
9. Chat message threading polish (better spacing, citation display)
10. Document inspector panel improvements — **NOT done, still deferred** (see Remaining above)
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
- **App name**: Not final — hardcoded as a literal string in both `AppNav`'s sidebar logo and
  `app/layout.tsx` metadata (two copies, not one). Worth resolving into a single shared
  constant before the name actually changes, or the two could drift. Deliberately not done in
  any UI pass so far — each one explicitly flagged it as out of scope for itself.
- **Landing page scope**: Still not implemented; still unclear whether it's MVP-critical or can
  stay deferred. `design-specs/functionality/landing-spec.md` exists if/when this is picked up.
- **Document inspector panel** (chat's right-side panel, `chat-spec.md`): still not built.
- **Illustrations**: Specific illustration assets for empty states were never specified; current
  empty states use plain emoji (📄, ⚠️) instead, not real illustration assets.
- **Cross-browser testing**: All UI verification this phase used Chromium via Playwright only —
  no Firefox/Safari check has been done.

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

### No longer applicable
- **Font loading (CDN vs. self-hosted)**: Not resolved or revisited during Phase 10; not
  blocking anything UI-visual, since no visual QA pass flagged a font-loading issue.
- This file used to carry its own "Deferred from Phase E2E" and "Dependencies on Phase 9"
  lists, predating Phase 10 entirely; removed as stale duplicates of
  `.agent-memory/OPEN_QUESTIONS.md`, which is the actual source of truth for that older
  material — check that file directly, not a summary here. Confirmed still live there: multi-document browsing in workspace, workspace document
  list visibility after returning from chat ("Leaving chat makes saved documents look like they
  disappeared from workspace"), and the save/sign-in entry UI redesign ("Save/sign-in entry UI
  needs a real pass, not just a stopgap" — the `login-spec.md` split-layout design still hasn't
  been implemented; the Save page's Phase 10 token-migration pass explicitly left this alone).

---

**Next Steps When Implementing:**
1. Read this plan + all referenced spec files
2. Check `.agent-memory/CURRENT_SESSION.md` for latest context
3. Review existing implementation to understand current state
4. Implement one screen/component at a time, testing thoroughly
5. Update this plan if design decisions change during implementation
6. Document any deviations from specs in `.agent-memory/DECISIONS.md`