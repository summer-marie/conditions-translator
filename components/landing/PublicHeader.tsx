"use client";

// Shared header for public marketing pages (landing, About, Terms, FAQ). Extracted from the
// landing page's original inline header so these pages don't duplicate it -- they're outside the
// authenticated app shell (app/app/layout.tsx + AppNav), which has its own separate header/nav
// chrome and its own theme state.
//
// Owns theme state for both LandingLogo and PublicThemeToggle (its children) so a toggle click
// updates both instantly -- same data-theme attribute + "theme" localStorage key AppNav's own
// theme toggle uses, so switching here or in the authenticated app stays in sync either way.

import { useEffect, useState } from "react";
import Link from "next/link";
import { LandingLogo } from "@/components/landing/LandingLogo";
import { PublicThemeToggle } from "@/components/landing/PublicThemeToggle";

type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

export function PublicHeader() {
  // Always starts "light" to exactly match the server render (server has no access to
  // localStorage/matchMedia) -- see app/layout.tsx's blocking theme script for the full mechanism.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(current);
    }
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable (e.g. private browsing) -- theme still applies this session
    }
  }

  return (
    <header className="border-b border-(--color-border-divider)">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
        >
          <LandingLogo theme={theme} />
        </Link>
        <div className="flex items-center gap-3">
          <PublicThemeToggle theme={theme} onToggle={toggleTheme} />
          <Link
            href="/app/save?mode=signin"
            className="text-sm font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
            style={{ color: "var(--color-text-body)" }}
          >
            Log in
          </Link>
        </div>
      </div>
    </header>
  );
}
