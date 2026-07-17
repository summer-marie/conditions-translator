// Shared header for public marketing pages (landing, About, Terms). Extracted from the landing
// page's original inline header so About/Terms don't duplicate it -- these three pages are
// outside the authenticated app shell (app/app/layout.tsx + AppNav), which has its own separate
// header/nav chrome.

import Link from "next/link";
import { LandingLogo } from "@/components/landing/LandingLogo";

export function PublicHeader() {
  return (
    <header className="border-b border-(--color-border-divider)">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
        >
          <LandingLogo />
        </Link>
        <Link
          href="/app/save?mode=signin"
          className="text-sm font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
          style={{ color: "var(--color-text-body)" }}
        >
          Log in
        </Link>
      </div>
    </header>
  );
}
