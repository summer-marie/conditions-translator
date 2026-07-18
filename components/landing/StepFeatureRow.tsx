// Alternating card/copy row used by the landing page's "Product Workspace" section. Mobile
// always stacks the card above the copy (source order below), regardless of `cardPosition` --
// per design-specs/wireframes/reference/browser-landing-page/browser-landingpage-spec-preview.md
// ("Feature rows stack card-above-text, in source order (no left/right alternation)").

import type { ReactNode } from "react";

interface StepFeatureRowProps {
  step: string;
  heading: string;
  body: string;
  card: ReactNode;
  /** Which side the card sits on at desktop (lg) widths. Mobile ignores this and always shows
   * the card first. */
  cardPosition: "start" | "end";
}

export function StepFeatureRow({ step, heading, body, card, cardPosition }: StepFeatureRowProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-(--landing-space-gap-md) items-center">
      <div className={cardPosition === "start" ? "lg:order-1" : "lg:order-2"}>{card}</div>
      <div className={`max-w-xl ${cardPosition === "start" ? "lg:order-2" : "lg:order-1"}`}>
        <p
          className="font-(--font-weight-h3) mb-2 uppercase tracking-wide"
          style={{ fontSize: "var(--font-size-caption)", color: "var(--color-brand-primary)" }}
        >
          {step}
        </p>
        <h3
          className="font-(--font-weight-h2) mb-3"
          style={{ fontSize: "var(--landing-font-h2)", color: "var(--color-text-heading)" }}
        >
          {heading}
        </h3>
        <p style={{ fontSize: "var(--landing-font-body)", color: "var(--color-text-body)" }}>{body}</p>
      </div>
    </div>
  );
}
