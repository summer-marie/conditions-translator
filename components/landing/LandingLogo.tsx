"use client";

// Landing page header logo, swapped per theme. Reuses the app's existing theme source
// (the data-theme attribute set by the blocking script in app/layout.tsx) rather than a
// separate theme system -- same "start light to match SSR, sync from the DOM after mount"
// pattern as components/layout/AppNav.tsx, whose ThemeToggleButton is the source of truth
// for what data-theme is set to.

import { useEffect, useState } from "react";
import Image from "next/image";
import { APP_NAME } from "@/lib/constants";

type Theme = "light" | "dark";

export function LandingLogo() {
  // Always starts "light" to exactly match the server render (server has no access to the
  // data-theme attribute the blocking script sets before hydration). Reading it during the
  // initial client render instead would make this component's hydrated output differ from the
  // server's -- see AppNav.tsx's theme state for the full rationale.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTheme(current);
    }
  }, []);

  return (
    <Image
      src={theme === "dark" ? "/dark-mode-logo.png" : "/logo-no-words.png"}
      alt={APP_NAME}
      width={160}
      height={40}
      className="h-10 w-auto object-contain"
    />
  );
}
