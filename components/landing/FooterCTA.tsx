"use client";

// Single combined footer + CTA bar for public marketing pages (landing, About, Terms).
// Everything (tagline, About/Terms/FAQ links, copyright, and the "get started" CTA) lives in
// ONE bar -- not a separate static footer followed by a separate CTA bar, which used to read as
// two stacked footers.
//
// Desktop/tablet (md: and up): the bar is always visible, fixed to the bottom of the viewport.
// Mobile: hidden until the user scrolls near the bottom of the page, then slides in -- detected
// via IntersectionObserver on a sentinel rendered where this component is placed.
//
// Render this once, near the end of a page's JSX (after <main>).

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GetStartedCTA } from "@/components/landing/GetStartedCTA";
import { APP_NAME } from "@/lib/constants";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/terms", label: "Terms" },
  { href: "/faq", label: "FAQ" },
];

// Reserved height budget for the spacer below. Kept as fixed values (not measured at runtime) so
// the reserved space exists before first paint -- avoids a content jump once the bar mounts.
// Mobile reserves more space since the bar's content wraps to two rows there.
const CTA_BAR_HEIGHT_MOBILE = "7.5rem";
const CTA_BAR_HEIGHT_DESKTOP = "4.5rem";

export function FooterCTA({
  message = "Ready to understand your documents?",
  ctaLabel = "Add your first document",
}: {
  /** Copy shown next to the button on wider screens. Hidden on narrow mobile widths. */
  message?: string;
  ctaLabel?: string;
}) {
  const [nearBottom, setNearBottom] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    // rootMargin's positive bottom value means the sentinel counts as "intersecting" once it's
    // within 200px of entering the viewport from below -- i.e. "scrolled near the bottom",
    // without a manual scroll-position/document-height calculation.
    const observer = new IntersectionObserver(
      ([entry]) => setNearBottom(entry.isIntersecting),
      { rootMargin: "0px 0px 200px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" />
      {/* Reserves space in normal flow so the fixed bar below never covers page content. */}
      <div
        aria-hidden="true"
        style={{
          height: `calc(${CTA_BAR_HEIGHT_MOBILE} + env(safe-area-inset-bottom))`,
        }}
        className="sm:hidden"
      />
      <div
        aria-hidden="true"
        style={{
          height: `calc(${CTA_BAR_HEIGHT_DESKTOP} + env(safe-area-inset-bottom))`,
        }}
        className="hidden sm:block"
      />
      <div
        role="contentinfo"
        className={`fixed inset-x-0 bottom-0 z-40 border-t transition-transform duration-200 ease-out md:translate-y-0 ${
          nearBottom ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          backgroundColor: "var(--color-background-card)",
          borderColor: "var(--color-border-divider)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p
              className="hidden md:block"
              style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}
            >
              {APP_NAME} — understand your supervision documents in plain language.
            </p>
            <nav aria-label="Footer" className="flex items-center gap-4">
              {FOOTER_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
                  style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-body)" }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p
              className="hidden lg:block"
              style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}
            >
              {message}
            </p>
            <GetStartedCTA label={ctaLabel} size="md" className="shrink-0" />
            <p
              className="hidden sm:block shrink-0"
              style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}
            >
              © {new Date().getFullYear()} {APP_NAME}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
