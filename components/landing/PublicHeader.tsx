"use client";

/**
 * Shared header for the public marketing pages (landing, About, Terms, FAQ).
 *
 * Extracted from the landing page's original inline header so those pages don't duplicate it.
 * They sit outside the authenticated app shell (`app/app/layout.tsx` + `AppNav`), which has
 * its own header/nav chrome and theme state. This header owns the theme state for its
 * children ({@link LandingLogo} and {@link PublicThemeToggle}) so a toggle click updates both
 * instantly, using the same `data-theme` attribute and `"theme"` localStorage key as
 * `AppNav`'s toggle — so the choice stays in sync across the public pages and the app.
 *
 * @module components/landing/PublicHeader
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { LandingLogo } from "@/components/landing/LandingLogo";
import { PublicThemeToggle } from "@/components/landing/PublicThemeToggle";

/** The two supported color themes. */
type Theme = "light" | "dark";

/** localStorage key persisting the chosen theme (shared with `AppNav`). */
const THEME_STORAGE_KEY = "theme";

/**
 * Renders the public marketing header with logo, theme toggle, and log-in link.
 *
 * Manages the theme locally: starts "light" to match the server render, syncs the real value
 * from the `data-theme` attribute after mount, and on toggle updates state, the attribute,
 * and localStorage. See `app/layout.tsx`'s blocking theme script for why the initial value
 * must match the server.
 *
 * @returns The rendered header element.
 */
export function PublicHeader() {
  // Must start "light" to match the server render (the server can't read localStorage/
  // matchMedia); see app/layout.tsx's blocking theme script for the full mechanism.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(current);
    }
  }, []);

  /** Toggles the theme, updates the <html data-theme> attribute, and persists it (best-effort). */
  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (e.g. private browsing) — the theme still applies this session.
    }
  }

  return (
    // Fixed mid-charcoal (#52525B / zinc-600), not a theme token, so the navbar stands out the
    // same in light and dark mode. Earlier tries failed: slate-400 read too blue, and the app's
    // dark charcoal (#27272A) was too close to the dark page background (#18181B) and hid the
    // white-outline logo. Because the background is fixed dark, the logo and text/icon colors
    // below are also fixed to their "on dark chrome" values (--color-surface-nav-foreground,
    // the token AppNav uses for its always-dark sidebar) rather than the theme-swapped colors.
    <header
      className="border-b border-(--color-border-divider) landing-header-glow"
      style={{ backgroundColor: "#52525B" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
        >
          <LandingLogo theme="dark" />
        </Link>
        <div className="flex items-center gap-3">
          <PublicThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link
            href="/app/save?mode=signin"
            className="text-sm font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
            style={{ color: "var(--color-surface-nav-foreground)" }}
          >
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}
