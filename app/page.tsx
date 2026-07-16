// Public marketing landing page (site root).
//
// Per docs/01_MVP_PRD.md §4 the guest journey is Guest -> Create Document -> ...; this page
// used to just redirect straight to /app/start. Product decision (2026-07-16): the root now
// serves real public content, and the primary CTA opens the existing privacy-notice gate as an
// overlay (see components/landing/GetStartedCTA.tsx) rather than navigating to a separate page
// first. app/app/start/page.tsx remains untouched as the fallback route reached when
// workspace/chat detect an unaccepted session.

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { GetStartedCTA } from "@/components/landing/GetStartedCTA";
import { APP_NAME } from "@/lib/constants";

const FEATURES = [
  {
    title: "Upload and OCR",
    description: "Upload document pages and get instant text extraction.",
    icon: UploadIcon,
  },
  {
    title: "AI Analysis",
    description: "Get plain-language breakdowns of complex conditions and terms.",
    icon: AnalysisIcon,
  },
  {
    title: "Ask Questions",
    description: "Chat with AI about your documents — get answers with citations.",
    icon: ChatIcon,
  },
];

const STEPS = [
  "Upload document page images",
  "Review and accept OCR results",
  "AI generates plain-language sections",
  "Ask questions and get cited answers",
];

export default function LandingPage() {
  return (
    <div className="bg-(--color-background-page) min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-(--color-background-page) focus:px-4 focus:py-2 focus:text-(--color-text-heading) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus-ring)"
      >
        Skip to main content
      </a>

      {/* Header */}
      <header className="border-b border-(--color-border-divider)">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span
            className="font-(--font-weight-h3)"
            style={{ fontSize: "var(--font-size-h3)", color: "var(--color-text-heading)" }}
          >
            {APP_NAME}
          </span>
          <Link
            href="/app/save?mode=signin"
            className="text-sm font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
            style={{ color: "var(--color-text-body)" }}
          >
            Log in
          </Link>
        </div>
      </header>

      <main id="main-content">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        <h1
          className="font-(--font-weight-h1) max-w-3xl mx-auto mb-4"
          style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-heading)" }}
        >
          Understand your supervision documents in plain language
        </h1>
        <p
          className="max-w-2xl mx-auto mb-8"
          style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}
        >
          Upload document pages, get instant OCR, and ask questions — answered only from what
          you uploaded. No account required to get started.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
          <GetStartedCTA />
          <a
            href="#how-it-works"
            className="text-sm font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
            style={{ color: "var(--color-accent-processing)" }}
          >
            See how it works
          </a>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <h2
          className="font-(--font-weight-h2) text-center mb-8"
          style={{ fontSize: "var(--font-size-h2)", color: "var(--color-text-heading)" }}
        >
          What it does
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {FEATURES.map(({ title, description, icon: Icon }) => (
            <Card key={title} padding="lg" className="text-center">
              <div
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--color-accent-processing-bg)" }}
              >
                <Icon />
              </div>
              <h3
                className="font-(--font-weight-h3) mb-2"
                style={{ fontSize: "var(--font-size-h3)", color: "var(--color-text-heading)" }}
              >
                {title}
              </h3>
              <p style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}>
                {description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 scroll-mt-16"
      >
        <h2
          className="font-(--font-weight-h2) text-center mb-8"
          style={{ fontSize: "var(--font-size-h2)", color: "var(--color-text-heading)" }}
        >
          How it works
        </h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((step, index) => (
            <li key={step} className="text-center">
              <div
                className="mx-auto mb-3 flex h-8 w-8 items-center justify-center rounded-full font-(--font-weight-h3)"
                style={{
                  backgroundColor: "var(--color-accent-success)",
                  color: "var(--color-text-inverse)",
                  fontSize: "var(--font-size-body)",
                }}
              >
                {index + 1}
              </div>
              <p style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}>
                {step}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Bottom CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
        <GetStartedCTA label="Add your first document" size="lg" />
      </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-(--color-border-divider)">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}>
            {APP_NAME} — understand your supervision documents in plain language.
          </p>
          <p style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}>
            © {new Date().getFullYear()} {APP_NAME}
          </p>
        </div>
      </footer>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      className="h-6 w-6"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="var(--color-accent-processing)"
      strokeWidth="1.5"
    >
      <path
        d="M10 3v9M10 3l-3 3M10 3l3 3M3 13v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AnalysisIcon() {
  return (
    <svg
      className="h-6 w-6"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="var(--color-accent-processing)"
      strokeWidth="1.5"
    >
      <rect x="4" y="3" width="12" height="14" rx="1" />
      <path d="M7 7.5h6M7 10h6M7 12.5h3.5" strokeLinecap="round" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg
      className="h-6 w-6"
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="var(--color-accent-processing)"
      strokeWidth="1.5"
    >
      <path d="M3 4h14v9H7l-4 3V4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
