// Public marketing landing page (site root).
//
// Per docs/01_MVP_PRD.md §4 the guest journey is Guest -> Create Document -> ...; this page
// used to just redirect straight to /app/start. Product decision (2026-07-16): the root now
// serves real public content, and the primary CTA opens the existing privacy-notice gate as an
// overlay (see components/landing/GetStartedCTA.tsx) rather than navigating to a separate page
// first. app/app/start/page.tsx remains untouched as the fallback route reached when
// workspace/chat detect an unaccepted session.

import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { GetStartedCTA } from "@/components/landing/GetStartedCTA";
import { PublicHeader } from "@/components/landing/PublicHeader";
import { FooterCTA } from "@/components/landing/FooterCTA";
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
    description:
      "Get plain-language breakdowns of complex conditions and terms.",
    icon: AnalysisIcon,
  },
  {
    title: "Ask Questions",
    description:
      "Chat with AI about your documents — get answers with citations.",
    icon: ChatIcon,
  },
];

// "Product Workspace" alternating feature rows (Option B / navy wireframe). Copy ported from
// design-specs/wireframes/approved/desktop/browser-landingpage-navy.png -- generic workflow
// description, no fabricated stats or claims.
const WORKSPACE_STEPS = [
  {
    step: "Step 01",
    heading: "Upload images, extract text, and review",
    body: "Drop in photos or scanned pages to instantly convert them into searchable text. If handwriting or difficult text isn't recognized perfectly, you can edit those sections before saving. This helps ensure your documents are as accurate as possible.",
  },
  {
    step: "Step 02",
    heading: "Automatically organize every document",
    body: `After labeling your document, ${APP_NAME} breaks it into logical sections so important information is easier to find. Browse your documents with less searching and more confidence.`,
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

      <PublicHeader />

      <main id="main-content">
        {/* Hero -- full-bleed ambient background, see app/globals.css's .landing-section-hero
          for the token-derived gradient stops (light mode only for now). Blends into the
          Features section below via the shared --landing-tone-mid tone. */}
        <section className="landing-section-hero">
          <div className="max-w-6xl mx-auto px-(--landing-container-px) py-(--landing-space-section-y)">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-(--landing-space-gap-lg) items-center">
            <div className="text-center lg:text-left">
              <h1
                className="font-(--font-weight-display) max-w-2xl mx-auto lg:mx-0 mb-4 tracking-tight"
                style={{
                  fontSize: "var(--landing-font-display)",
                  lineHeight: 1.15,
                  color: "var(--color-text-heading)",
                }}
              >
                Upload. Organize.
                <br />
                Understand.
              </h1>
              <p
                className="max-w-2xl mx-auto lg:mx-0 mb-8"
                style={{
                  fontSize: "var(--landing-font-body)",
                  color: "var(--color-text-body)",
                }}
              >
               Upload document pages and extract searchable text instantly with OCR. Ask questions and receive answers based only on the documents you upload. Find what you need faster and understand your information with confidence.
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
          </div>
        </section>

        {/* Features -- full-bleed ambient background, see app/globals.css's
          .landing-section-features. Blends from the Hero section above and into How It Works
          below via the shared --landing-tone-mid tone. */}
        <section className="landing-section-features">
          <div className="max-w-6xl mx-auto px-(--landing-container-px) py-(--landing-space-section-y)">
          <h2
            className="font-(--font-weight-h2) text-center mb-8"
            style={{
              fontSize: "var(--landing-font-h2)",
              color: "var(--color-text-heading)",
            }}
          >
            What it does
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-(--landing-space-gap-md)">
            {FEATURES.map(({ title, description, icon: Icon }) => (
              <Card key={title} padding="lg" className="text-center">
                <div
                  className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: "var(--color-accent-processing-bg)",
                  }}
                >
                  <Icon />
                </div>
                <h3
                  className="font-(--font-weight-h3) mb-2"
                  style={{
                    fontSize: "var(--landing-font-h3)",
                    color: "var(--color-text-heading)",
                  }}
                >
                  {title}
                </h3>
                <p
                  style={{
                    fontSize: "var(--landing-font-body)",
                    color: "var(--color-text-body)",
                  }}
                >
                  {description}
                </p>
              </Card>
            ))}
          </div>
          </div>
        </section>

        {/* How It Works — "Product Workspace" alternating rows, per the approved navy wireframe.
          Full-bleed ambient background, see app/globals.css's .landing-section-workspace. Blends
          from Features above and into the Bottom CTA below via the shared --landing-tone-mid
          tone. */}
        <section id="how-it-works" className="scroll-mt-16 landing-section-workspace">
          <div className="max-w-6xl mx-auto px-(--landing-container-px) py-(--landing-space-section-y)">
            <div className="text-center mb-10">
              <p
                className="font-(--font-weight-h3) mb-2 uppercase tracking-wide"
                style={{
                  fontSize: "var(--font-size-caption)",
                  color: "var(--color-brand-primary)",
                }}
              >
                Product Workspace
              </p>
              <h2
                className="font-(--font-weight-display) tracking-tight"
                style={{
                  fontSize: "var(--landing-font-display)",
                  color: "var(--color-text-heading)",
                }}
              >
                Designed for seamless document workflows
              </h2>
            </div>

            <div className="flex flex-col gap-(--landing-space-gap-lg)">
              <StepFeatureRow
                step={WORKSPACE_STEPS[0].step}
                heading={WORKSPACE_STEPS[0].heading}
                body={WORKSPACE_STEPS[0].body}
                cardPosition="start"
                card={
                  // Fixed navy card (not a theme token) so the screenshot pops in both light and
                  // dark mode -- --color-brand-primary itself is theme-swapped (dark mode's value
                  // is near-white, "frozen" per the approved dark palette), so a token wouldn't
                  // give a consistent navy here. Set via `style` (not a bg-* class) since it must
                  // win over Card's own `bg-(--color-background-card)` utility class -- per this
                  // project's own documented Tailwind trap, two classes targeting the same
                  // property race on compiled declaration order, not source position, so a
                  // className override isn't reliable here; inline style always wins.
                  <Card padding="md" style={{ backgroundColor: "#0F1B33" }}>
                    <p
                      className="font-(--font-weight-h3) mb-3 uppercase tracking-wide"
                      style={{
                        fontSize: "var(--font-size-caption)",
                        color: "#FFFFFF",
                      }}
                    >
                      OCR Text Extraction
                    </p>
                    <div className="relative rounded-md aspect-16/10 overflow-hidden">
                      <Image
                        src="/landing/ocr-extraction-preview.jpg"
                        alt="Workspace OCR review step showing an uploaded page and its extracted text"
                        fill
                        sizes="(min-width: 1024px) 560px, 100vw"
                        className="object-contain"
                      />
                    </div>
                    <p
                      className="mt-3"
                      style={{
                        fontSize: "var(--font-size-caption)",
                        color: "#A1A1AA",
                      }}
                    >
                      {APP_NAME} extracts pristine machine text from messy,
                      skewed smartphone photos.
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

        {/* Bottom CTA -- full-bleed ambient background, see app/globals.css's
          .landing-section-cta. Blends from How It Works above via the shared
          --landing-tone-mid tone. */}
        <section className="landing-section-cta">
          <div className="max-w-6xl mx-auto px-(--landing-container-px) py-(--landing-space-section-y) text-center">
            <h2
              className="font-(--font-weight-display) tracking-tight mb-4"
              style={{ fontSize: "var(--landing-font-display)", color: "var(--color-text-heading)" }}
            >
              Start understanding your files today
            </h2>
            <p
              className="max-w-2xl mx-auto mb-8"
              style={{ fontSize: "var(--landing-font-body)", color: "var(--color-text-body)" }}
            >
              Skip the endless Google searches and confusing terminology. {APP_NAME} analyzes only
              the documents you upload to provide clear, personalized answers while keeping your
              information private and under your control.
            </p>
            <GetStartedCTA label="Create Free Account" size="md" />
          </div>
        </section>
      </main>

      <FooterCTA />
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
      <path
        d="M3 4h14v9H7l-4 3V4z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
