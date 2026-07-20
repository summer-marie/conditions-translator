/**
 * Alternating card/copy row for the landing page's "Product Workspace" section.
 *
 * On mobile the card always stacks above the copy (source order), regardless of
 * `cardPosition`; `cardPosition` only controls left/right placement at desktop (lg) widths,
 * per the approved landing wireframe spec ("stack card-above-text, no left/right alternation").
 *
 * @module components/landing/StepFeatureRow
 */

import type { ReactNode } from "react";

/** Props for {@link StepFeatureRow}. */
interface StepFeatureRowProps {
  /** Small eyebrow label above the heading (e.g. "Step 1"). */
  step: string;
  /** Row heading. */
  heading: string;
  /** Row body copy. */
  body: string;
  /** The illustrative preview card to render beside the copy. */
  card: ReactNode;
  /** Which side the card sits on at desktop (lg) widths; mobile always shows the card first. */
  cardPosition: "start" | "end";
}

/**
 * Renders one feature row pairing a preview card with heading/body copy.
 *
 * @param props - {@link StepFeatureRowProps}.
 * @returns The rendered feature row.
 */
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
