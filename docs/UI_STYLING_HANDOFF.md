# UI Styling Handoff

Handoff for the styling agent. Everything below is UI-only. Branch: `feature/design-token-integration`.

Sources: `.claude/session-memory/OPEN_QUESTIONS.md`, `CURRENT_SESSION.md`, `WORK_LOG.md` (as of 2026-07-16).

---

## 1. Conventions you MUST follow

### CSS-variable class syntax — shorthand, not brackets
- Use `bg-(--color-x)`, `border-(--x)`, `text-(--x)` — **not** `bg-[var(--color-x)]`.
- Both compile identically; shorthand is the established convention (matches Tailwind v4 tooling, silences IntelliSense noise).
- If any existing bracket-form class turns up, convert it to shorthand. Do not reintroduce bracket form.

### No `useEffect` + refs to react to a prop change
- This repo's `react-hooks` ESLint config is stricter than stock React. It rejects **both**:
  1. `setState` inside a `useEffect` body (`react-hooks/set-state-in-effect`)
  2. The ref-comparison-during-render escape hatch (`react-hooks/refs`)
- To drive UI state off an event: lift state to the owning component and set it directly in the real event handler (`onClick`, etc.). Never in an effect, never via ref-during-render.

### Use tokens, not hardcoded colors
- All colors/spacing/typography come from CSS custom properties in [app/styles/tokens.css](app/styles/tokens.css).
- Dark mode is driven by `[data-theme="dark"]` overrides in the same file — reference tokens so both themes stay correct automatically. Prior QA found several bugs that were all hardcoded colors bypassing tokens.

---

## 2. Where things live

| Thing | Location |
|-------|----------|
| Design tokens (light + dark) | [app/styles/tokens.css](app/styles/tokens.css) |
| Global styles | [app/globals.css](app/globals.css) |
| Shared UI components | [components/ui/](components/ui/) — `Button`, `Badge`, `Input`, `Textarea`, `Card`, `Alert` |
| Shared navigation | [components/layout/AppNav.tsx](components/layout/AppNav.tsx) |
| Focus-trap hook | [hooks/useFocusTrap.ts](hooks/useFocusTrap.ts) |
| Chat document inspector | [components/chat/DocumentInspector.tsx](components/chat/DocumentInspector.tsx) |
| Privacy gate modal | [components/landing/PrivacyGateModal.tsx](components/landing/PrivacyGateModal.tsx) |
| UI plan / tracker | [docs/UI_IMPLEMENTATION_PLAN.md](docs/UI_IMPLEMENTATION_PLAN.md) |

**Token groups available:** brand, background (page/card/sidebar/subtle), border (card/divider/focus-ring/default/subtle), text (heading/body/meta/inverse), accent (success/warning/destructive/processing, each with a `-bg` variant), plus full typography (family/size/weight/line-height), spacing scale, radius scale, and shadows. See the file for exact names.

---

## 3. Already DONE — do not redo

- **Design-token migration:** Dashboard, Chat, Workspace, Save, Start pages.
- **Shared components:** `Button`, `Badge`, `Input`, `Textarea`, `Card`, `Alert` (accent status/callout surfaces).
- **Navigation** (`AppNav.tsx`): desktop sidebar, mobile top bar + hamburger dropdown, mobile bottom tabs.
- **Desktop sidebar collapse:** toggles `w-60` (240px) ↔ `w-16` (64px icon rail), localStorage-persisted, desktop-only.
- **Dark mode:** `data-theme` on `<html>`, blocking inline script (system fallback + localStorage), toggle in sidebar header + mobile top bar. Two visual-QA passes done (5 bugs fixed in the first, zero in the data-gated-state follow-up).
- **Accessibility:** focus rings, Escape-to-close, focus trap on all 4 overlays (mobile menu, dashboard's 2 modals, workspace image modal), `<main>` landmark + skip link, form label associations, live regions for dynamic content, heading-hierarchy fix.
- **Public marketing landing page** (`app/page.tsx`): header, hero, features grid, How It Works, footer + `PrivacyGateModal`.
- **Chat document inspector** (`DocumentInspector.tsx`): desktop-only, 320px, accepted-pages numbering, "(cited)" styling + click-to-scroll.

---

## 4. Still REMAINING — candidate styling slices

1. **Mobile inspector / citation behavior** — chat-spec's mobile "scroll to page reference" affordance was never built. Citation pills are inert on mobile (the inspector panel is `hidden` there). Natural next slice if mobile citation interaction is wanted.
2. **App name as a shared constant** — currently hardcoded in **two** places: the sidebar logo in `AppNav.tsx` and `app/layout.tsx` metadata/`<title>`. They can drift. Consolidate into one shared constant before the name changes.
3. **Seeded live-verification of the inspector** — built and lint/build-clean, but never exercised against a real READY document + citation (page list, "(cited)" labels, click-to-scroll). Worth a seeded-data verification pass.
4. **Collapsed-sidebar theme toggle** (known tradeoff) — the theme toggle hides while the sidebar is collapsed (64px can't fit two icon buttons + padding). A future pass could relocate it.

---

## 5. Not a styling task (flag only)

- `docs/01_MVP_PRD.md` §4 is now **stale** — it still documents the old redirect-only guest journey that the landing-page decision superseded. Needs the decision-maker, not the styling agent.

---

## 6. Working-tree / commit note

Several passes' changes (accessibility + sidebar collapse) may be **uncommitted** in the working tree — each pass was explicitly instructed that a separate agent handles git/commit work. Read the tree before assuming it's clean; do not discard. Per project convention: PowerShell only, stage files individually by name, small logical commits, never push/merge.
