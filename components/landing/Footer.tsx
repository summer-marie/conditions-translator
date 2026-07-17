// Shared footer for public marketing pages (landing, About, Terms). Extracted from the landing
// page's original inline footer (same markup/tone) plus About/Terms links, so all three pages
// share one implementation instead of duplicating footer markup.

import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

const FOOTER_LINKS = [
  { href: "/about", label: "About" },
  { href: "/terms", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="border-t border-(--color-border-divider)">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}>
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
        <p style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}>
          © {new Date().getFullYear()} {APP_NAME}
        </p>
      </div>
    </footer>
  );
}
