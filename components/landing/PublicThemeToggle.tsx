/**
 * Light/dark theme toggle button for the public marketing header.
 *
 * Presentational only: theme state and the toggle handler live in {@link PublicHeader} (the
 * shared parent of this and `LandingLogo`) and are passed down, so both stay in sync. Mirrors
 * `AppNav`'s `ThemeToggleButton` shape/icons/style, using the same "on dark chrome" treatment
 * because the header background is a fixed dark charcoal regardless of site theme.
 *
 * @module components/landing/PublicThemeToggle
 */

/**
 * Renders the theme-toggle icon button.
 *
 * @param props - Component props.
 * @param props.theme - The current theme (selects the icon and `aria-pressed`).
 * @param props.onToggle - Called when the button is pressed.
 * @returns The rendered toggle button.
 */
export function PublicThemeToggle({
  theme,
  onToggle,
}: {
  theme: "light" | "dark";
  onToggle: () => void;
}) {
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isDark}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-(--color-surface-nav-foreground) hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-surface-nav-foreground)"
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

/** Decorative sun glyph shown while in dark mode (tap to switch to light). */
function SunIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="10" cy="10" r="3.5" />
      <path
        d="M10 2v2M10 16v2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M2 10h2M16 10h2M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Decorative moon glyph shown while in light mode (tap to switch to dark). */
function MoonIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        d="M16 12.5A6.5 6.5 0 1 1 7.5 4a5 5 0 0 0 8.5 8.5z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
