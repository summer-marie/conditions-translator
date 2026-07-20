/**
 * Static, illustrative "Automatic Document Sectioning" preview for the landing page.
 *
 * Mirrors the approved landing wireframe. NOT wired to a real Document's generated Sections —
 * {@link PREVIEW_SECTIONS} is mocked marketing content only.
 *
 * @module components/landing/SectioningPreviewCard
 */

import { Card } from "@/components/ui/Card";

/** One illustrative section row in the preview. */
interface PreviewSection {
  label: string;
  /** When true, styled as the currently-selected section. */
  active?: boolean;
}

/** Mocked section rows shown in the preview card. */
const PREVIEW_SECTIONS: PreviewSection[] = [
  { label: "Section 1: General Covenants", active: true },
  { label: "Section 2: Payment Schedules" },
];

/**
 * Renders the static sectioning-preview card.
 *
 * @returns The rendered preview card.
 */
export function SectioningPreviewCard() {
  return (
    <Card padding="md">
      <p
        className="font-(--font-weight-h3) mb-3 uppercase tracking-wide"
        style={{ fontSize: "var(--font-size-caption)", color: "var(--color-brand-primary)" }}
      >
        Automatic Document Sectioning
      </p>
      <div className="flex flex-col gap-2">
        {PREVIEW_SECTIONS.map((section) => (
          <div
            key={section.label}
            className="rounded-md px-3 py-2"
            style={{
              backgroundColor: section.active
                ? "var(--color-accent-success-bg)"
                : "var(--color-background-subtle)",
              color: section.active ? "var(--color-accent-success)" : "var(--color-text-body)",
              fontSize: "var(--font-size-body)",
            }}
          >
            {section.label}
          </div>
        ))}
      </div>
    </Card>
  );
}
