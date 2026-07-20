// About page. Public marketing page, outside the authenticated app shell (app/app/layout.tsx +
// AppNav) -- shares PublicHeader/FooterCTA with the landing page and /terms instead.
//
// Content provided by the project owner 2026-07-17 -- not authored by Claude.

import Image from "next/image";
import { PublicHeader } from "@/components/landing/PublicHeader";
import { FooterCTA } from "@/components/landing/FooterCTA";
import { Card } from "@/components/ui/Card";
import { APP_NAME } from "@/lib/constants";

const BODY_TEXT = { fontSize: "var(--font-size-body)", color: "var(--color-text-body)" } as const;
const HEADING_TEXT = {
  fontSize: "var(--font-size-h3)",
  color: "var(--color-text-heading)",
} as const;

const DOCUMENT_LIST = [
  "Probation and parole conditions.",
  "Court orders, sentencing paperwork, and compliance instructions.",
  "Lease and rental agreements, including rent terms, notice rules, utilities, termination conditions, and signatures.",
  "Housing paperwork such as landlord notices, move-in terms, and tenant responsibility documents.",
  "Consumer contracts, service agreements, and everyday agreements written in hard-to-follow legal language.",
  "Legal aid or court forms, intake paperwork, and service-related documents.",
  "Workplace policies, school conduct paperwork, and other rules-based documents where people need clear explanations of expectations and consequences.",
];

export const metadata = {
  title: `About — ${APP_NAME}`,
};

export default function AboutPage() {
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
        {/* Fixed light backing (not a theme token) because logo-with-slogan.png is a solid
            navy-on-transparent asset, not theme-aware -- it would go near-invisible against this
            Card's dark-charcoal background in dark mode otherwise, same issue already fixed for
            the navbar logo. */}
        <div
          className="rounded-md p-4 mb-6 flex justify-center"
          style={{ backgroundColor: "#FFFFFF" }}
        >
          <Image
            src="/logo-with-slogan.png"
            alt={`${APP_NAME} — Truth, translated into language you can actually understand.`}
            width={1162}
            height={372}
            className="h-auto w-full max-w-sm"
            priority
          />
        </div>
        {/* <h1
          className="font-(--font-weight-h1) mb-6"
          style={{ fontSize: "var(--font-size-h1)", color: "var(--color-text-heading)" }}
        >
          About {APP_NAME}
        </h1> */}

        <div className="space-y-4 mb-10">
          <p className="font-(--font-weight-h3)" style={{ ...BODY_TEXT, color: "var(--color-text-heading)", textAlign: "center" }}>
            Don&apos;t lose your freedom to a technicality. Upload your documents, ask anything,
            and stop the guesswork.
          </p>
        
          <p style={BODY_TEXT}>
            {APP_NAME} helps people make sense of supervision terms and other hard-to-read legal
            documents by turning dense language into plain English. Your questions are answered
            based on the documents you upload, so the experience stays focused on what your
            paperwork actually says rather than generic legal explanations.
          </p>
          <p style={BODY_TEXT}>
            {APP_NAME} is especially built to help with{" "}
            <strong className="font-(--font-weight-h3)">
              probation, parole, and supervision documents
            </strong>
            , where missing a detail can have serious consequences. Court conditions, reporting
            rules, travel restrictions, fees, deadlines, treatment requirements, and other
            supervision terms can be difficult to interpret, and {APP_NAME} is designed to reduce
            that confusion before it turns into a costly mistake.
          </p>
          <p style={BODY_TEXT}>
            {APP_NAME} can also help people understand other legal or rule-based documents that
            are often full of jargon, long clauses, and unclear obligations. Plain-language legal
            writing commonly applies across many document types, including contracts, policies,
            forms, and information guides, which makes the same translation approach useful
            beyond supervision paperwork.
          </p>
        </div>

        <section className="mb-10">
          <h2 className="font-(--font-weight-h3) mb-3" style={HEADING_TEXT}>
            Documents {APP_NAME} Can Help Explain
          </h2>
          <ul className="list-disc list-inside space-y-1.5" style={BODY_TEXT}>
            {DOCUMENT_LIST.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="mb-10 space-y-4">
          <h2 className="font-(--font-weight-h3) mb-1" style={HEADING_TEXT}>
            What Makes {APP_NAME} Different
          </h2>
          <p style={BODY_TEXT}>
            {APP_NAME} is not a law firm, and it does not replace a lawyer. Instead, it helps
            users read with more confidence by translating complicated wording into something
            more understandable while staying grounded in the documents they provide.
          </p>
          <p style={BODY_TEXT}>
            That means {APP_NAME} is designed to help with understanding, not guessing. If
            something is unclear, missing, or not in the uploaded material, the goal is to
            surface that honestly rather than invent an answer.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-(--font-weight-h3) mb-1" style={HEADING_TEXT}>
            Important Limits
          </h2>
          <p style={BODY_TEXT}>
            {APP_NAME} does <strong className="font-(--font-weight-h3)">not</strong> give legal
            advice, represent users, or tell them what they should do in a legal case.
            AI-generated explanations can still be wrong or incomplete, so users should compare
            outputs to their original documents and get qualified legal help when the stakes are
            high.
          </p>
          <p style={BODY_TEXT}>
            {APP_NAME} was built by Summer Halsey as an independent project focused on making
            complicated systems easier for everyday people to navigate. It is not affiliated with
            any court, probation department, landlord, employer, school, or government agency.
          </p>
        </section>
      </Card>
      </main>

      <FooterCTA />
    </div>
  );
}
