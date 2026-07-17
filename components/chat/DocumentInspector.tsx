// Desktop-only chat companion panel (design-specs/functionality/chat-spec.md, "Document
// Inspector Panel"). Lists each selected document's ACCEPTED pages so citation page numbers
// line up exactly with lib/chat/context.ts's numbering (1-based index among ACCEPTED pages
// with OCR text only -- not the raw intake `order` field, which also counts rejected pages).

"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface InspectorDocument {
  documentId: string;
  title: string;
}

interface InspectorPage {
  id: string;
  pageNumber: number;
  preview: string;
}

interface RawPage {
  id: string;
  status: string;
  ocr: { extractedText: string; correctedText: string | null } | null;
}

// Same accepted-text source as lib/chat/context.ts and lib/sections/generate.ts: the user's
// correction when present, otherwise the raw extraction stands as accepted-without-correction.
// Exported so this selection can be regression-tested without a component-rendering harness
// (this repo's vitest config runs in the "node" environment, with no jsdom/React Testing Library).
export function acceptedPageText(ocr: { extractedText: string; correctedText: string | null }): string {
  return ocr.correctedText ?? ocr.extractedText;
}

interface DocumentInspectorProps {
  documents: InspectorDocument[];
  citedPageIds: Set<string>;
  focusedPageId: string | null;
  // Owned by the parent (not this component) so the citation-click handler that sets
  // focusedPageId can also force the panel open in the same event, rather than reacting to
  // the prop change in an effect.
  expanded: boolean;
  onToggleExpanded: () => void;
  className?: string;
}

export function DocumentInspector({
  documents,
  citedPageIds,
  focusedPageId,
  expanded,
  onToggleExpanded,
  className = "",
}: DocumentInspectorProps) {
  const [pagesByDocument, setPagesByDocument] = useState<Record<string, InspectorPage[]>>({});
  const [failedDocumentIds, setFailedDocumentIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const pageRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  useEffect(() => {
    let cancelled = false;

    async function loadPages() {
      const results = await Promise.all(
        documents.map(async (doc) => {
          try {
            const res = await fetch(`/api/documents/${doc.documentId}/pages`);
            if (!res.ok) throw new Error("failed to load pages");
            const data: { pages: RawPage[] } = await res.json();
            // Same filter + ordering as lib/chat/context.ts's grounding assembly, so the
            // page numbers shown here match the chat citations exactly.
            const accepted = data.pages.filter(
              (page) => page.status === "ACCEPTED" && page.ocr !== null
            );
            const pages: InspectorPage[] = accepted.map((page, index) => ({
              id: page.id,
              pageNumber: index + 1,
              preview:
                acceptedPageText(page.ocr!).split("\n")[0]?.trim().slice(0, 80) ||
                "(no preview text)",
            }));
            return { documentId: doc.documentId, pages, failed: false };
          } catch {
            return { documentId: doc.documentId, pages: [] as InspectorPage[], failed: true };
          }
        })
      );

      if (cancelled) return;

      const nextPages: Record<string, InspectorPage[]> = {};
      const nextFailed = new Set<string>();
      for (const result of results) {
        nextPages[result.documentId] = result.pages;
        if (result.failed) nextFailed.add(result.documentId);
      }
      setPagesByDocument(nextPages);
      setFailedDocumentIds(nextFailed);
      setIsLoading(false);
    }

    loadPages();

    return () => {
      cancelled = true;
    };
  }, [documents]);

  useEffect(() => {
    if (!focusedPageId || !expanded) return;
    pageRefs.current.get(focusedPageId)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedPageId, expanded]);

  return (
    <Card
      variant="default"
      padding="sm"
      shadow={false}
      role="complementary"
      aria-label="Document inspector"
      className={`overflow-hidden ${className}`}
    >
      <div className="flex items-center justify-between mb-2 shrink-0">
        <h2
          className="font-(--font-weight-h3)"
          style={{ fontSize: "var(--font-size-h3)", color: "var(--color-text-heading)" }}
        >
          Document inspector
        </h2>
        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse document inspector" : "Expand document inspector"}
          className="rounded-md p-1 hover:bg-(--color-background-subtle) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus-ring)"
        >
          {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </button>
      </div>

      {expanded && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {documents.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--color-text-meta)" }}>
              No documents selected.
            </p>
          ) : isLoading ? (
            <p className="text-sm" style={{ color: "var(--color-text-meta)" }}>
              Loading pages…
            </p>
          ) : (
            documents.map((doc) => {
              const pages = pagesByDocument[doc.documentId] ?? [];
              const failed = failedDocumentIds.has(doc.documentId);
              return (
                <div key={doc.documentId}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <span
                      className="text-sm font-medium truncate"
                      style={{ color: "var(--color-text-heading)" }}
                    >
                      {doc.title}
                    </span>
                    <Badge variant="success" size="sm" className="shrink-0">
                      READY
                    </Badge>
                  </div>
                  <p
                    className="mb-2"
                    style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}
                  >
                    {pages.length} page{pages.length === 1 ? "" : "s"}
                  </p>

                  {failed ? (
                    <p className="text-sm" style={{ color: "var(--color-accent-destructive)" }}>
                      Couldn&apos;t load pages for this document.
                    </p>
                  ) : pages.length === 0 ? (
                    <p className="text-sm" style={{ color: "var(--color-text-meta)" }}>
                      No accepted pages yet.
                    </p>
                  ) : (
                    <ul className="space-y-1" style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {pages.map((page) => {
                        const cited = citedPageIds.has(page.id);
                        const focused = focusedPageId === page.id;
                        return (
                          <li
                            key={page.id}
                            ref={(node) => {
                              if (node) pageRefs.current.set(page.id, node);
                              else pageRefs.current.delete(page.id);
                            }}
                            className={`rounded-md px-2 py-1.5 text-sm border-l-4 ${
                              focused ? "ring-2 ring-(--color-border-focus-ring)" : ""
                            }`}
                            style={{
                              borderColor: cited ? "var(--color-accent-processing)" : "transparent",
                              backgroundColor: focused
                                ? "var(--color-accent-processing-bg)"
                                : "var(--color-background-subtle)",
                            }}
                          >
                            <div
                              className="flex items-center justify-between"
                              style={{ color: "var(--color-text-heading)" }}
                            >
                              <span>Page {page.pageNumber}</span>
                              {cited && (
                                <span
                                  style={{
                                    fontSize: "var(--font-size-caption)",
                                    color: "var(--color-accent-processing)",
                                  }}
                                >
                                  (cited)
                                </span>
                              )}
                            </div>
                            <p
                              className="truncate"
                              style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-body)" }}
                            >
                              {page.preview}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}
