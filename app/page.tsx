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
import { LandingLogo } from "@/components/landing/LandingLogo";
import { WorkspacePreviewCard } from "@/components/landing/WorkspacePreviewCard";
import { SectioningPreviewCard } from "@/components/landing/SectioningPreviewCard";
import { StepFeatureRow } from "@/components/landing/StepFeatureRow";
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

// "Product Workspace" alternating feature rows (Option B / navy wireframe). Copy ported from
// design-specs/wireframes/approved/desktop/browser-landingpage-navy.png -- generic workflow
// description, no fabricated stats or claims.
const WORKSPACE_STEPS = [
  {
    step: "Step 01",
    heading: "Upload images, run instant OCR",
    body: "Drop individual page photos or scanned sheets. Our engine instantly processes the files, isolating text fragments, labels, and handwriting with surgical accuracy.",
  },
  {
    step: "Step 02",
    heading: "Structure messy papers automatically",
    body: `No more manual labeling. ${APP_NAME} structures pages into clean chapters, recognizing sections, clauses, and appendix notes automatically so your entire workspace stays ordered.`,
  },
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
          <LandingLogo />
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
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          <div className="text-center lg:text-left">
            <h1
              className="font-(--font-weight-h1) max-w-3xl mx-auto lg:mx-0 mb-4"
              style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-heading)" }}
            >
              Understand your supervision documents in plain language
            </h1>
            <p
              className="max-w-2xl mx-auto lg:mx-0 mb-8"
              style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}
            >
              Upload document pages, get instant OCR, and ask questions — answered only from what
              you uploaded. No account required to get started.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center lg:justify-start">
              <GetStartedCTA />
              <a
                href="#how-it-works"
                className="text-sm font-medium hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
                style={{ color: "var(--color-accent-processing)" }}
              >
                See how it works
              </a>
            </div>
          </div>

          {/* Hidden below ~640px per landing-spec.md's "hero illustration hidden/scaled on
              mobile" rule -- the 3-thumbnail grid doesn't compress well below that width. */}
          <div className="hidden sm:block">
            <WorkspacePreviewCard />
          </div>
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

      {/* How It Works — "Product Workspace" alternating rows, per the approved navy wireframe.
          Full-bleed background uses --color-background-subtle (a step off the page canvas,
          --color-background-page) rather than the spec doc's stale --color-background-sidebar
          mapping, which now resolves to deep-navy nav chrome after the light-theme token re-roll
          -- see the session decision log for the substitution rationale. */}
      <section
        id="how-it-works"
        className="scroll-mt-16"
        style={{ backgroundColor: "var(--color-background-subtle)" }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center mb-10">
            <p
              className="font-(--font-weight-h3) mb-2 uppercase tracking-wide"
              style={{ fontSize: "var(--font-size-caption)", color: "var(--color-brand-primary)" }}
            >
              Product Workspace
            </p>
            <h2
              className="font-(--font-weight-h2)"
              style={{ fontSize: "var(--font-size-h2)", color: "var(--color-text-heading)" }}
            >
              Designed for seamless document workflows
            </h2>
          </div>

          <div className="flex flex-col gap-12">
            <StepFeatureRow
              step={WORKSPACE_STEPS[0].step}
              heading={WORKSPACE_STEPS[0].heading}
              body={WORKSPACE_STEPS[0].body}
              cardPosition="start"
              card={
                <Card padding="md">
                  <p
                    className="font-(--font-weight-h3) mb-3 uppercase tracking-wide"
                    style={{ fontSize: "var(--font-size-caption)", color: "var(--color-brand-primary)" }}
                  >
                    OCR Text Extraction
                  </p>
                  {/*
                    IMAGE NEEDED: a screenshot (~600x360px, PNG) demonstrating OCR extraction --
                    e.g. a side-by-side of a photographed/scanned document page next to its
                    extracted plain text, or an annotated screenshot of the workspace's OCR
                    review step. Replace this placeholder <div> with a real <Image> once the
                    file is uploaded (suggested path: public/landing/ocr-extraction-preview.png).
                  */}
                  <div
                    className="rounded-md aspect-16/10"
                    style={{ backgroundColor: "var(--color-background-subtle)" }}
                    role="img"
                    aria-label="Placeholder for an OCR text extraction screenshot"
                  />
                  <p
                    className="mt-3"
                    style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}
                  >
                    {APP_NAME} extracts pristine machine text from messy, skewed smartphone photos.
                  </p>
                </Card>
              }
            />

            <StepFeatureRow
              step={WORKSPACE_STEPS[1].step}
              heading={WORKSPACE_STEPS[1].heading}
              body={WORKSPACE_STEPS[1].body}
              cardPosition="end"
              card={<SectioningPreviewCard />}
            />
          </div>
        </div>
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
