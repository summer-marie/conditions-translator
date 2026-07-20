"use client";

/**
 * Combined footer + CTA bar for the public marketing pages (landing, About, Terms).
 *
 * Everything — tagline, About/Terms/FAQ links, copyright, and the "get started" CTA — lives
 * in ONE bar rather than a static footer stacked above a separate CTA bar (which read as two
 * footers). On desktop/tablet (md+) the bar is always fixed to the bottom of the viewport; on
 * mobile it's hidden until the user scrolls near the page bottom, then slides in, detected via
 * an IntersectionObserver on a sentinel rendered at this component's position. Render it once,
 * near the end of a page's JSX (after `<main>`).
 *
 * @module components/landing/FooterCTA
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { GetStartedCTA } from "@/components/landing/GetStartedCTA";
import { APP_NAME } from "@/lib/constants";

/** Secondary footer navigation links. */
const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/terms", label: "Terms" },
  { href: "/faq", label: "FAQ" },
];

// Fixed spacer heights (not measured at runtime) so the reserved space exists before first
// paint and the bar mounting never jumps page content. Mobile reserves more because the bar's
// content wraps to two rows there.
const CTA_BAR_HEIGHT_MOBILE = "7.5rem";
const CTA_BAR_HEIGHT_DESKTOP = "4.5rem";

/**
 * Renders the sticky footer/CTA bar.
 *
 * On mobile, tracks a `nearBottom` flag via an IntersectionObserver on a sentinel so the bar
 * only slides in once the user scrolls near the page bottom; on md+ it is always visible.
 *
 * @param props - Component props.
 * @param props.message - Copy shown beside the button on wider screens; hidden on narrow widths.
 * @param props.ctaLabel - Label for the "get started" button.
 * @returns The rendered spacer(s) and fixed footer/CTA bar.
 */
export function FooterCTA({
  message = "Ready to understand your documents?",
  ctaLabel = "Add your first document",
}: {
  /** Copy shown next to the button on wider screens. Hidden on narrow mobile widths. */
  message?: string;
  /** Label for the "get started" button. */
  ctaLabel?: string;
}) {
  const [nearBottom, setNearBottom] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    // The 200px bottom rootMargin makes the sentinel count as "intersecting" once it's within
    // 200px of entering the viewport from below — i.e. "scrolled near the bottom" — without any
    // manual scroll-position/document-height math.
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
      {/* In-flow spacers reserving the bar's height so the fixed bar never covers page content. */}
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
