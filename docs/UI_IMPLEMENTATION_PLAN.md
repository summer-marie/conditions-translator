# UI Implementation Plan

## Goal of Current UI Effort
Provide a reusable reference for implementing and refining UI components based on approved wireframes and design specifications. This plan is for **Phase 10 (UI Refinement and Documentation)** after Phase E2E testing completes.

## Current Phase / Roadmap Context
**Phase**: Phase E2E — End-to-End User Flow Testing and Stabilization
**Branch**: `feat/e2e-testing-stabilization`
**Status**: Backend complete (Phases 1-8), functional UI exists, awaiting live retest confirmation
**Next**: Complete Phase E2E flows 18-22, then Phase 9 (Cleanup), then Phase 10 (UI Refinement)

**Do not start UI implementation work until:**
- Phase E2E testing is complete and signed off
- Phase 9 (retention, cleanup, demo validation) is complete
- User explicitly requests Phase 10 UI refinement work

## Screens/Features to Implement First (Phase 10 Order)
1. **Dashboard UI refinements** — document card polish, better empty states, improved navigation
2. **Chat interface refinements** — message threading polish, citation display, document inspector
3. **Workspace intake flow refinements** — upload UX, OCR review flow, clearer states
4. **Login/Signup flow refinements** — form validation polish, error states, email warning UX
5. **Mobile optimization** — bottom tab bar, responsive breakpoints, touch interactions
6. **Accessibility improvements** — keyboard navigation, screen reader support, focus management

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
- Reference design-token CSS custom properties with the explicit bracket form: `bg-[var(--color-x)]`, `text-[var(--color-x)]`, `border-[var(--color-x)]`. This matches `components/ui/Button.tsx` and `components/ui/Badge.tsx`. Tailwind v4's shorter `bg-(--color-x)` shorthand compiles identically but must not be mixed in — pick one form per file/component family and keep it consistent with the shared components.
- **Known trap**: the `text-` prefix is ambiguous between text-color and font-size. `text-[var(--font-size-h1)]` (or the shorthand equivalent) silently compiles to `color: var(--font-size-h1)` instead of `font-size` — Tailwind cannot introspect a CSS variable's value at build time and guesses wrong for this prefix specifically. Set font-size via inline `style={{ fontSize: 'var(--font-size-x)' }}` instead of a `text-*` class whenever the token is a font-size, not a color. (Found and fixed in both the dashboard and chat page token migrations — see commit history on `feature/design-token-integration`.)
- A successful `npm run build` does **not** guarantee an ambiguous-prefix class compiled to the intended CSS property. After adding or changing a token-based utility class, spot-check the compiled output in `.next/static/chunks/*.css` for the property you expect.

### Spacing (from design-specs/README.md)
- Use consistent spacing scale (specific values in `design-specs/tokens/spacing.json`)
- Section spacing: 48px desktop, 32px mobile
- Card backgrounds: #EDF2F7 (light), #1F2937 (dark)

### Layout Patterns
- **Desktop (>=768px)**: Sidebar visible, multi-column layouts, right panels
- **Mobile (<768px)**: Bottom tab bar, single column, full-width cards
- **Navbar**: 64px desktop, 56px mobile
- **Sidebar**: 240px wide on desktop
- **Right panels**: 320px, collapsible

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

## Suggested Implementation Order (Phase 10)

### Week 1: Core Component Polish
1. Refine shared button/input/card components with proper tokens
2. Implement proper color theme switching (light/dark modes)
3. Add consistent loading/empty/error states across screens
4. Polish status badges and color coding

### Week 2: Dashboard & Workspace
5. Dashboard document card polish (hover states, quick actions)
6. Upload area UX improvements (drag/drop, progress states)
7. Workspace OCR review flow refinements
8. Better page preview and accept/reject UX

### Week 3: Chat & Navigation
9. Chat message threading polish (better spacing, citation display)
10. Document inspector panel improvements
11. Sidebar/bottom tab navigation refinement
12. Mobile touch interaction improvements

### Week 4: Authentication & Accessibility
13. Login/signup form validation polish
14. Email warning modal improvements
15. Keyboard navigation and focus management
16. Screen reader announcements and ARIA labels

### Week 5: Mobile & Final Polish
17. Mobile responsive testing and fixes
18. Performance optimization (lazy loading, code splitting)
19. Cross-browser testing
20. Final visual polish and documentation updates

## Open Questions / Missing Design Info

### Missing Wireframes
- No finalized wireframes in `design-specs/wireframes/exports/` (only color-theme-reference.png)
- User mentioned making separate wireframes for dashboard UI
- Landing page not yet implemented (may be deferred from MVP)

### Clarification Needed
- **App name**: Not final — should use config/env variable, not hardcoded strings
- **Illustrations**: Specific illustration assets for empty states not specified
- **Icon set**: Which icon library to use (Lucide, Heroicons, etc.)?
- **Landing page scope**: Is this MVP-critical or can it be deferred?

### Technical Decisions to Make
- **Font loading**: Google Fonts CDN vs. self-hosted Inter/JetBrains Mono
- **Theme persistence**: Local storage vs. system preference only
- **Animation library**: Framer Motion vs. CSS-only transitions
- **Form library**: React Hook Form vs. manual state management

### Deferred from Phase E2E
- Multi-document browsing in workspace (see `.agent-memory/OPEN_QUESTIONS.md`)
- Workspace document list visibility after returning from chat
- Save/sign-in entry UI redesign (currently a stopgap)

### Dependencies on Phase 9
- Some UI refinements may depend on Phase 9 cleanup features
- Retention/cleanup behavior affects some empty states
- Demo validation may reveal additional UI needs

---

**Next Steps When Implementing:**
1. Read this plan + all referenced spec files
2. Check `.agent-memory/CURRENT_SESSION.md` for latest context
3. Review existing implementation to understand current state
4. Implement one screen/component at a time, testing thoroughly
5. Update this plan if design decisions change during implementation
6. Document any deviations from specs in `.agent-memory/DECISIONS.md`