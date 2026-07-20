/**
 * Desktop-only chat companion panel (`chat-spec.md`, "Document Inspector Panel").
 *
 * Lists each selected document's ACCEPTED pages so the page numbers shown line up exactly
 * with `lib/chat/context.ts`'s citation numbering: a 1-based index among ACCEPTED pages that
 * have OCR text — NOT the raw intake `order`, which also counts rejected pages.
 *
 * @module components/chat/DocumentInspector
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

/** A document selected into the chat, as passed to the inspector. */
interface InspectorDocument {
  documentId: string;
  title: string;
}

/** An accepted page prepared for display in the inspector. */
interface InspectorPage {
  /** Page id (matches chat citation `pageId`s). */
  id: string;
  /** 1-based number among the document's accepted pages. */
  pageNumber: number;
  /** Short single-line text preview. */
  preview: string;
}

/** A page as returned by the pages API, before filtering to accepted-with-OCR. */
interface RawPage {
  id: string;
  status: string;
  ocr: { extractedText: string; correctedText: string | null } | null;
}

/**
 * Resolves a page's accepted text: the user's correction when present, else the raw extraction.
 *
 * Kept identical to `lib/chat/context.ts` and `lib/sections/generate.ts` so the inspector's
 * previews match what the model was actually grounded on. Exported so this selection can be
 * regression-tested directly — the repo's vitest config runs in the "node" environment with
 * no jsdom/React Testing Library, so a component-rendering harness isn't available.
 *
 * @param ocr - The page's OCR result (`extractedText` and optional `correctedText`).
 * @returns The accepted text for the page.
 */
export function acceptedPageText(ocr: { extractedText: string; correctedText: string | null }): string {
  return ocr.correctedText ?? ocr.extractedText;
}

/** Props for {@link DocumentInspector}. */
interface DocumentInspectorProps {
  /** The documents currently selected into the chat. */
  documents: InspectorDocument[];
  /** Ids of pages the latest answer cited (highlighted in the list). */
  citedPageIds: Set<string>;
  /** Id of the page to scroll into view/emphasize, or `null`. */
  focusedPageId: string | null;
  /**
   * Whether the panel is expanded. Owned by the parent so a citation-click handler can set
   * `focusedPageId` and open the panel in the same event, rather than reacting to the prop
   * change in an effect.
   */
  expanded: boolean;
  /** Toggles {@link DocumentInspectorProps.expanded}. */
  onToggleExpanded: () => void;
  /** Extra classes appended to the panel container. */
  className?: string;
}

/**
 * Renders the collapsible document-inspector panel beside the chat.
 *
 * State & side effects:
 * - Fetches each document's pages from `/api/documents/:id/pages` and derives the accepted,
 *   OCR'd pages (re-run whenever `documents` changes); tracks per-document load failures.
 * - Scrolls the `focusedPageId` row into view when it changes while expanded.
 *
 * @param props - {@link DocumentInspectorProps}.
 * @returns The rendered inspector card.
 */
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
            // Mirror the filter + ordering of the grounding assembly in lib/chat/context.ts
            // so these page numbers match the chat citations exactly.
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

/** Decorative up-chevron glyph shown on the toggle while the panel is expanded. */
function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 15l-6-6-6 6" />
    </svg>
  );
}

/** Decorative down-chevron glyph shown on the toggle while the panel is collapsed. */
function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}
