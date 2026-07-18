import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description:
    "Understand your supervision documents in plain language, grounded only in what you upload.",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-icon.png",
  },
  manifest: "/manifest.json",
};

// viewportFit: "cover" lets content draw under the notch/home-indicator area on iOS, which is
// what makes env(safe-area-inset-*) resolve to a real (non-zero) value -- needed by the public
// footer CTA bar's safe-area-aware bottom padding (components/landing/FooterCTA.tsx).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {/* Sets data-theme before first paint to avoid a light/dark flash on load.
            Keep this logic in sync with getInitialTheme() in components/layout/AppNav.tsx. */}
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
