"use client";

// Persistent footer CTA bar for public marketing pages (landing, About, Terms).
//
// Desktop/tablet (md: and up): always visible, fixed to the bottom of the viewport.
// Mobile: hidden until the user scrolls near the bottom of the page, then slides in -- detected
// via IntersectionObserver on a sentinel rendered where this component is placed (so put
// <FooterCTA /> near the end of each page's content, after the main content and Footer).
//
// Render this once, near the end of a page's JSX. It renders both the fixed bar AND a spacer
// that reserves the same height in normal flow, so the bar never overlaps page content.

import { useEffect, useRef, useState } from "react";
import { GetStartedCTA } from "@/components/landing/GetStartedCTA";

// Reserved height budget for the spacer below. Kept as a fixed value (not measured at runtime)
// so the reserved space exists before first paint -- avoids a content jump once the bar mounts.
const CTA_BAR_HEIGHT = "4.5rem";

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
      {/* Reserves space in normal flow so the fixed bar below never covers page content -- needed
          on every viewport, since the desktop/tablet bar is always visible and the mobile bar
          would otherwise cover the real Footer the instant it appears. */}
      <div
        aria-hidden="true"
        style={{ height: `calc(${CTA_BAR_HEIGHT} + env(safe-area-inset-bottom))` }}
      />
      <div
        role="complementary"
        aria-label="Get started"
        className={`fixed inset-x-0 bottom-0 z-40 border-t transition-transform duration-200 ease-out md:translate-y-0 ${
          nearBottom ? "translate-y-0" : "translate-y-full"
        }`}
        style={{
          backgroundColor: "var(--color-background-card)",
          borderColor: "var(--color-border-divider)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div
          className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
          style={{ minHeight: CTA_BAR_HEIGHT }}
        >
          <p
            className="hidden sm:block"
            style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}
          >
            {message}
          </p>
          <GetStartedCTA label={ctaLabel} size="md" className="shrink-0" />
        </div>
      </div>
    </>
  );
}
