// Static, illustrative hero preview -- mirrors design-specs/wireframes/approved/desktop/
// browser-landingpage-navy.png. Not wired to a real session/Document; PREVIEW_PAGES below is
// mocked marketing content only.

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { APP_NAME } from "@/lib/constants";

interface PreviewPage {
  label: string;
  status: "ready" | "processing";
}

const PREVIEW_PAGES: PreviewPage[] = [
  { label: "Page 1", status: "ready" },
  { label: "Page 2", status: "ready" },
  { label: "Page 3", status: "processing" },
];

export function WorkspacePreviewCard() {
  return (
    <Card padding="sm" className="w-full max-w-md mx-auto lg:mx-0">
      <div className="flex items-center gap-2 border-b border-(--color-border-divider) pb-3 mb-3">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
          style={{ backgroundColor: "var(--color-brand-primary)" }}
          aria-hidden="true"
        >
          <span className="block h-2.5 w-2.5 rounded-sm bg-(--color-text-inverse)" />
        </span>
        <span
          className="font-(--font-weight-h3)"
          style={{ fontSize: "var(--font-size-h3)", color: "var(--color-text-heading)" }}
        >
          {APP_NAME}
        </span>
      </div>

      <div className="rounded-md p-3" style={{ backgroundColor: "var(--color-background-subtle)" }}>
        <p
          className="font-(--font-weight-h3) mb-3"
          style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}
        >
          Uploaded Pages ({PREVIEW_PAGES.length})
        </p>

        {/*
          IMAGE NEEDED: three cropped thumbnails (~160x120px, JPG/PNG) of real, redacted sample
          document pages, one per PREVIEW_PAGES entry. Replace the placeholder <div> below with
          a Next.js <Image> once files exist (suggested path: public/landing/page-thumb-1.jpg,
          -2.jpg, -3.jpg). Until then this renders a plain placeholder box, matching the approved
          wireframe (which also shows blank thumbnail rectangles, not real screenshots).
        */}
        <div className="grid grid-cols-3 gap-3">
          {PREVIEW_PAGES.map((page) => (
            <div key={page.label} className="flex flex-col gap-1.5">
              <div
                className="aspect-4/3 rounded border"
                style={{
                  backgroundColor: "var(--color-background-card)",
                  borderColor: "var(--color-border-card)",
                }}
                role="img"
                aria-label={`Placeholder thumbnail image for ${page.label}`}
              />
              <div className="flex items-center justify-between gap-1">
                <span style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-heading)" }}>
                  {page.label}
                </span>
                <Badge variant={page.status === "ready" ? "success" : "processing"} size="sm">
                  {page.status === "ready" ? "Ready" : "Processing"}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
