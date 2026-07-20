/**
 * Landing/public header logo, whose image swaps per theme.
 *
 * Presentational only: the theme is passed down from {@link PublicHeader} (the shared parent
 * of this and `PublicThemeToggle`) so both update the instant the toggle is clicked. The
 * theme must be a prop, not internal state — an earlier mount-only effect meant the logo
 * never reacted to later toggles (which change `<html data-theme>` but not this component).
 *
 * @module components/landing/LandingLogo
 */

import Image from "next/image";
import { APP_NAME } from "@/lib/constants";

/**
 * Renders the theme-appropriate logo image.
 *
 * @param props - Component props.
 * @param props.theme - Current theme; selects the dark- vs light-mode logo asset.
 * @returns The rendered logo image.
 */
export function LandingLogo({ theme }: { theme: "light" | "dark" }) {
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
