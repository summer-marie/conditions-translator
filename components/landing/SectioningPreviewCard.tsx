// Static, illustrative "Automatic Document Sectioning" preview -- mirrors
// design-specs/wireframes/approved/desktop/browser-landingpage-navy.png. Not wired to a real
// Document's generated Sections; PREVIEW_SECTIONS below is mocked marketing content only.

import { Card } from "@/components/ui/Card";

interface PreviewSection {
  label: string;
  active?: boolean;
}

const PREVIEW_SECTIONS: PreviewSection[] = [
  { label: "Section 1: General Covenants", active: true },
  { label: "Section 2: Payment Schedules" },
];

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
