/**
 * Root layout for the entire app: document metadata, viewport, and the pre-paint theme script.
 *
 * @module app/layout
 */

import type { Metadata, Viewport } from "next";
import "./globals.css";

/** Site-wide metadata (title, description, icons, manifest, OpenGraph/Twitter cards). */
export const metadata: Metadata = {
  metadataBase: new URL("https://my-verity.com"),
  title: "Verity | Understand Legal Documents",
  description:
    "Verity helps justice-impacted individuals understand probation and parole documents using OCR and source-grounded AI.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    type: "website",
    url: "https://my-verity.com",
    siteName: "Verity",
  },
  twitter: {
    card: "summary_large_image",
  },
};

/**
 * Viewport config. `viewportFit: "cover"` lets content draw under the iOS notch/home-indicator,
 * which is what makes `env(safe-area-inset-*)` resolve to a real (non-zero) value — needed by
 * the public footer CTA bar's safe-area-aware bottom padding (`components/landing/FooterCTA.tsx`).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Root HTML layout wrapping every route.
 *
 * Renders the `<html>`/`<body>` shell and injects a tiny blocking script that sets
 * `data-theme` from localStorage (or the OS preference) before first paint, avoiding a
 * light/dark flash on load. `suppressHydrationWarning` is set because that attribute is
 * written by the script before React hydrates.
 *
 * @param props - Component props.
 * @param props.children - The routed page content.
 * @returns The root layout element.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Blocking pre-paint theme script: sets data-theme from localStorage (or the OS
            preference) before first paint to prevent a theme flash. Keep this in sync with the
            post-mount theme sync in components/layout/AppNav.tsx. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.setAttribute("data-theme",t)}catch(e){}})()',
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
