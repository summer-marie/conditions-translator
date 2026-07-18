// Landing page header logo, swapped per theme. Presentational only -- theme state lives in
// PublicHeader (the shared parent of this and PublicThemeToggle) and is passed down as a prop,
// so both stay in sync the instant the toggle is clicked. Previously this component tracked its
// own theme state via a mount-only effect, which meant it never updated after the toggle button
// was added elsewhere in the header -- toggling changed <html data-theme> but this component had
// no way to know, so the logo stayed on whichever theme it saw at first paint.

import Image from "next/image";
import { APP_NAME } from "@/lib/constants";

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
