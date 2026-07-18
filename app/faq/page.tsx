// FAQ page. Public marketing page, outside the authenticated app shell (app/app/layout.tsx +
// AppNav) -- shares PublicHeader/FooterCTA with the landing page and /about and /terms instead.
//
// Answers are grounded in docs/01_MVP_PRD.md and the app's actual implemented behavior (temporary
// retention, no legal advice/violation determination, no data sharing/training use, OCR quality
// gating + correction), not invented marketing claims.

import { PublicHeader } from "@/components/landing/PublicHeader";
import { FooterCTA } from "@/components/landing/FooterCTA";
import { Card } from "@/components/ui/Card";
import { APP_NAME } from "@/lib/constants";

const BODY_TEXT = { fontSize: "var(--font-size-body)", color: "var(--color-text-body)" } as const;
const HEADING_TEXT = {
  fontSize: "var(--font-size-h3)",
  color: "var(--color-text-heading)",
} as const;

const FAQS: { question: string; answer: string }[] = [
  {
    question: "Do I need to create an account to use this?",
    answer:
      `No account is required to get started. You can upload documents, extract text, generate ` +
      `sections, and ask questions without signing up. Create an account only when you want to ` +
      `save your work — all of your documents transfer automatically when you do.`,
  },
  {
    question: "How long do you keep my documents?",
    answer:
      `Without an account, documents become unavailable 24 hours after you create them. If you ` +
      `create an account, your documents are saved and don't expire automatically — you can ` +
      `delete them yourself at any time.`,
  },
  {
    question: "Does the AI give legal advice or tell me if I've violated my conditions?",
    answer:
      `No. ${APP_NAME}'s AI explains what your uploaded documents say in plain language — it ` +
      `does not give legal advice and does not determine whether a violation has occurred. For ` +
      `questions about compliance or legal advice, talk to your supervising officer or an attorney.`,
  },
  {
    question: "Are my documents shared with anyone or used to train AI models?",
    answer:
      `No. Your documents are never shared with others or used to train AI models. They're used ` +
      `only to answer your questions about the specific document you uploaded.`,
  },
  {
    question: "What if my handwriting or a photo isn't clear enough to read?",
    answer:
      `${APP_NAME} flags pages that are too blurry, cut off, sideways, or otherwise unreadable so ` +
      `you can retake or re-upload them before accepting. If the extracted text isn't quite ` +
      `right, you can correct it yourself before it's used to answer your questions.`,
  },
];

export const metadata = {
  title: `FAQ — ${APP_NAME}`,
};

export default function FaqPage() {
  return (
    <div className="bg-(--color-background-page) min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-(--color-background-page) focus:px-4 focus:py-2 focus:text-(--color-text-heading) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus-ring)"
      >
        Skip to main content
      </a>

      <PublicHeader />

      <main id="main-content" className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        <Card padding="lg">
          <h1
            className="font-(--font-weight-h1) mb-6"
            style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-heading)" }}
          >
            Frequently Asked Questions
          </h1>

          <div className="space-y-8">
            {FAQS.map(({ question, answer }) => (
              <section key={question}>
                <h2 className="font-(--font-weight-h3) mb-2" style={HEADING_TEXT}>
                  {question}
                </h2>
                <p style={BODY_TEXT}>{answer}</p>
              </section>
            ))}
          </div>
        </Card>
      </main>

      <FooterCTA />
    </div>
  );
}
