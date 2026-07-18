// Static, illustrative hero preview -- mirrors design-specs/wireframes/approved/desktop/
// browser-landingpage-navy.png. Not wired to a real session/Document; PREVIEW_PAGES below is
// mocked marketing content only.

import Image from "next/image";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { APP_NAME } from "@/lib/constants";

interface PreviewPage {
  label: string;
  status: "ready" | "processing";
  src: string;
}

const PREVIEW_PAGES: PreviewPage[] = [
  { label: "Page 1", status: "ready", src: "/landing/page-thumb-1.jpg" },
  { label: "Page 2", status: "ready", src: "/landing/page-thumb-2.jpg" },
  { label: "Page 3", status: "processing", src: "/landing/page-thumb-3.jpg" },
];

export function WorkspacePreviewCard() {
  return (
    <Card padding="sm" className="w-full max-w-md mx-auto lg:mx-0">
      <div className="flex items-center gap-2 border-b border-(--color-border-divider) pb-3 mb-3">
        <Image
          src="/icon.png"
          alt=""
          aria-hidden="true"
          width={24}
          height={24}
          className="h-6 w-6 shrink-0 rounded object-contain"
        />
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

        <div className="grid grid-cols-3 gap-3">
          {PREVIEW_PAGES.map((page) => (
            <div key={page.label} className="flex flex-col gap-1.5">
              <div
                className="relative aspect-4/3 overflow-hidden rounded border"
                style={{ borderColor: "var(--color-border-card)" }}
              >
                <Image
                  src={page.src}
                  alt={`Sample uploaded page thumbnail (${page.label})`}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              </div>
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
