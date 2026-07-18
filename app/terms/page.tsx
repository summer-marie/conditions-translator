// Terms of Service page. Public marketing page, outside the authenticated app shell
// (app/app/layout.tsx + AppNav) -- shares PublicHeader/FooterCTA with the landing page
// and /about instead.

import { PublicHeader } from "@/components/landing/PublicHeader";
import { FooterCTA } from "@/components/landing/FooterCTA";
import { Card } from "@/components/ui/Card";
import { APP_NAME } from "@/lib/constants";

const LAST_UPDATED = "July 17, 2026";

// A section body is a sequence of blocks: a plain string renders as a paragraph, a string[]
// renders as a bullet list. Content provided by the project owner 2026-07-17 -- not authored by
// Claude. Section 13's contact placeholder is verbatim from the source and still needs a real
// email/form link.
type TermsBlock = string | string[];
interface TermsSection {
  heading: string;
  blocks: TermsBlock[];
}

const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: "1. Acceptance of Terms",
    blocks: [
      `By accessing or using ${APP_NAME} ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.`,
    ],
  },
  {
    heading: "2. Description of Service",
    blocks: [
      `${APP_NAME} is an AI-assisted reading tool that translates uploaded supervision documents into plain language. The Service is provided for informational and educational purposes only. It is not a legal service, and it does not provide legal advice.`,
    ],
  },
  {
    heading: "3. Not Legal Advice — Critical Disclaimer",
    blocks: [
      "THE SERVICE DOES NOT PROVIDE LEGAL ADVICE. Nothing produced by this Service constitutes legal advice, legal representation, or a substitute for consulting a licensed attorney.",
      "AI-generated summaries and responses may contain errors, omissions, or misinterpretations. You should not rely on any output from this Service as the basis for legal decisions, responses to your supervision officer, court filings, or any action that may affect your legal standing.",
      "If you have questions about your specific legal obligations, consult a licensed attorney or a qualified legal aid organization.",
    ],
  },
  {
    heading: "4. AI Limitations and Grounding",
    blocks: [
      "The AI in " +
        APP_NAME +
        " answers questions based exclusively on the documents you upload. It does not use general legal knowledge, case law, or jurisdiction-specific rules to fill in information not present in your documents. This means:",
      [
        "If something is not in your uploaded documents, the AI will not speculate about it.",
        "The AI may misinterpret ambiguous language.",
        "Document quality (scan quality, handwriting, formatting) can affect accuracy.",
        "Outputs are not reviewed by attorneys or legal professionals.",
      ],
      "You are responsible for verifying any AI-generated output against your original documents.",
    ],
  },
  {
    heading: "5. User Responsibilities",
    blocks: [
      "You agree that you will:",
      [
        "Only upload documents you have the legal right to upload",
        "Not upload documents containing third-party personal information without authorization",
        "Not use the Service for any unlawful purpose",
        "Not attempt to manipulate or circumvent the AI to produce output outside its grounding scope",
        "Not rely on Service output as a substitute for qualified legal counsel",
      ],
    ],
  },
  {
    heading: "6. Document Upload and Data Handling",
    blocks: [
      "When you upload a document, it is processed to extract text for AI grounding purposes. The following data practices apply:",
      [
        "Uploaded document text is used solely to generate AI responses within your session",
        "Chat history is temporary and is not permanently stored",
        "We do not sell, share, or disclose your document contents to third parties",
        "Documents associated with your account are stored to enable the Service's functionality and are deleted upon account deletion or upon request",
      ],
      "By uploading documents, you represent that you have the right to do so and that uploading them does not violate any court order, supervision restriction, or applicable law.",
    ],
  },
  {
    heading: "7. Account and Session Access",
    blocks: [
      "The Service supports both registered accounts and temporary (guest) sessions. Temporary sessions have limited functionality and data is not retained after the session ends. You are responsible for maintaining the security of your account credentials. You may not share your account with others.",
    ],
  },
  {
    heading: "8. No Warranty",
    blocks: [
      `THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. WE MAKE NO WARRANTY THAT THE SERVICE WILL BE ACCURATE, COMPLETE, RELIABLE, OR ERROR-FREE. USE OF THE SERVICE IS AT YOUR OWN RISK.`,
    ],
  },
  {
    heading: "9. Limitation of Liability",
    blocks: [
      `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE OPERATORS OF ${APP_NAME.toUpperCase()} BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF LIBERTY, LEGAL PENALTIES, OR ADVERSE LEGAL OUTCOMES, ARISING OUT OF OR RELATED TO YOUR USE OF OR RELIANCE ON THE SERVICE.`,
      "YOUR SOLE REMEDY FOR DISSATISFACTION WITH THE SERVICE IS TO STOP USING IT.",
    ],
  },
  {
    heading: "10. Third-Party Services",
    blocks: [
      `${APP_NAME} uses third-party AI and infrastructure providers to operate. Your use of the Service is also subject to the applicable terms of those providers. We are not responsible for the conduct, availability, or policies of third-party services.`,
    ],
  },
  {
    heading: "11. Changes to Terms",
    blocks: [
      "We may update these Terms at any time. Continued use of the Service after changes are posted constitutes acceptance of the revised Terms. We will make reasonable efforts to notify registered users of material changes.",
    ],
  },
  {
    heading: "12. Governing Law",
    blocks: [
      "These Terms are governed by the laws of the State of Arizona, without regard to conflict of law principles.",
    ],
  },
  {
    heading: "13. Contact",
    // TODO(content): "[your contact email or form link]" is a placeholder from the source content
    // itself, not inserted by Claude -- replace with a real contact method.
    blocks: [
      "For questions about these Terms or to request document deletion, contact: [your contact email or form link]",
    ],
  },
];

export const metadata = {
  title: `Terms of Service — ${APP_NAME}`,
};

function TermsBlockView({ block }: { block: TermsBlock }) {
  if (Array.isArray(block)) {
    return (
      <ul
        className="list-disc list-inside space-y-1 mt-2"
        style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}
      >
        {block.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  return (
    <p
      className="mt-2"
      style={{ fontSize: "var(--font-size-body)", color: "var(--color-text-body)" }}
    >
      {block}
    </p>
  );
}

export default function TermsPage() {
  return (
    <div className="landing-page-glow min-h-screen">
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
          className="font-(--font-weight-h1) mb-2"
          style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-heading)" }}
        >
          Terms of Service
        </h1>
        <p
          className="mb-8"
          style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}
        >
          Last updated: {LAST_UPDATED}
        </p>

        <div className="space-y-8">
          {TERMS_SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2
                className="font-(--font-weight-h3) mb-1"
                style={{ fontSize: "var(--font-size-h3)", color: "var(--color-text-heading)" }}
              >
                {section.heading}
              </h2>
              {section.blocks.map((block, i) => (
                <TermsBlockView key={i} block={block} />
              ))}
            </section>
          ))}
        </div>
      </Card>
      </main>

      <FooterCTA />
    </div>
  );
}
