// Workspace UI shell for temporary document intake.
//
// Shows: document title (editable inline), page list with OCR preview/accept/re-upload/delete,
// upload button, Finish Document button.
// Upload button is disabled once page_count = 10.
// Finish Document button is disabled when page_count = 0.
// No AI controls are visible while status = IN_PROGRESS.

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createTemporaryDocument,
  finishDocument,
  retryDocumentProcessing,
  acceptPage,
  reuploadPage,
  deletePage,
} from "@/lib/actions/document";
import { DEFAULT_DOCUMENT_TITLE, isDefaultDocumentTitle } from "@/lib/constants";

interface OcrQuality {
  blurry: boolean;
  cutOff: boolean;
  sideways: boolean;
  incomplete: boolean;
  unreadable: boolean;
  retakeGuidance?: string | null;
}

interface OcrResult {
  extractedText: string;
  confidence: number | null;
  warnings: OcrQuality | null;
}

type PageStatus = "PENDING" | "OCR_COMPLETE" | "OCR_FAILED" | "ACCEPTED";

interface Page {
  id: string;
  order: number;
  blobPath: string | null;
  status: PageStatus;
  ocrFailureReason: string | null;
  ocr: OcrResult | null;
  createdAt: string;
}

type DocumentStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PROCESSING"
  | "READY"
  | "PROCESSING_FAILED";

interface GeneratedSection {
  id: string;
  heading: string;
  body: string;
  order: number;
  sources: { pageId: string }[];
}

interface Document {
  id: string;
  title: string;
  status: DocumentStatus;
  pageCount: number;
  sections: GeneratedSection[];
}

function documentStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case "IN_PROGRESS":
      return "In Progress";
    case "COMPLETED":
    case "PROCESSING":
      return "Processing";
    case "READY":
      return "Ready";
    case "PROCESSING_FAILED":
      return "Needs Retry";
    default:
      return status;
  }
}

// Mirrors lib/ocr/schema.ts's hasBlockingQualityIssue: only a genuinely unreadable or near-empty
// extraction blocks Accept. Framing flags (blurry/cutOff/sideways/incomplete) are shown as
// advisory badges below but don't block by themselves — real phone photos are rarely perfectly
// framed, and the text can still be fully usable.
const MIN_USABLE_TEXT_LENGTH = 10;

function hasBlockingQuality(warnings: OcrQuality | null, extractedText: string | null): boolean {
  if (!warnings) return false;
  if (warnings.unreadable) return true;
  return (extractedText ?? "").trim().length < MIN_USABLE_TEXT_LENGTH;
}

function statusLabel(page: Page): string {
  switch (page.status) {
    case "PENDING":
      return "Processing...";
    case "OCR_COMPLETE":
      return hasBlockingQuality(page.ocr?.warnings ?? null, page.ocr?.extractedText ?? null)
        ? "Needs retake"
        : "Ready to accept";
    case "OCR_FAILED":
      return "OCR failed";
    case "ACCEPTED":
      return "Accepted";
    default:
      return page.status;
  }
}

export default function WorkspacePage() {
  const router = useRouter();
  const [document, setDocument] = useState<Document | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [ocrRunningIds, setOcrRunningIds] = useState<Record<string, boolean>>({});
  const [actioningPageId, setActioningPageId] = useState<string | null>(null);
  const [expandedImagePage, setExpandedImagePage] = useState<Page | null>(null);
  // Set once the workspace is owned by a signed-in account (Phase 7). null while temporary.
  const [savedUserId, setSavedUserId] = useState<string | null>(null);

  async function initializeWorkspace() {
    try {
      // Privacy acceptance and session lookup use next/headers (cookies()) and must run
      // server-side; this client component fetches that state instead of importing it directly.
      const statusResponse = await fetch("/api/session/status");
      if (!statusResponse.ok) {
        throw new Error("Failed to load session status");
      }
      const status = await statusResponse.json();
      setSavedUserId(status.userId ?? null);

      // A signed-in user (Phase 7) owns their workspace even without a temporary session cookie.
      const hasOwner = Boolean(status.sessionId || status.userId);
      if (!status.privacyAccepted || !hasOwner) {
        router.push("/app/start");
        return;
      }

      // Load document or create one (owner is resolved from cookies server-side).
      const response = await fetch(`/api/documents`);
      if (!response.ok) {
        throw new Error("Failed to load documents");
      }

      const data = await response.json();
      if (data.documents && data.documents.length > 0) {
        const doc = data.documents[0];
        setDocument({
          id: doc.id,
          title: doc.title,
          status: doc.status,
          pageCount: doc._count.pages,
          sections: doc.sections || [],
        });

        await refetchPages(doc.id);
      } else if (!status.userId) {
        // Only auto-create a fresh document in temporary mode; a saved account with no documents
        // is handled by the empty-state below rather than silently creating a temporary one.
        setIsCreating(true);
        try {
          const newDoc = await createTemporaryDocument(DEFAULT_DOCUMENT_TITLE);
          if (newDoc) {
            setDocument({
              id: newDoc.id,
              title: newDoc.title,
              status: newDoc.status as DocumentStatus,
              pageCount: 0,
              sections: [],
            });
          }
        } finally {
          setIsCreating(false);
        }
      }
    } catch (error) {
      console.error("Failed to initialize workspace:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const refetchPages = async (documentId: string) => {
    const pagesResponse = await fetch(`/api/documents/${documentId}/pages`);
    if (pagesResponse.ok) {
      const pagesData = await pagesResponse.json();
      setPages(pagesData.pages || []);
    }
  };

  const refetchDocument = async (documentId: string) => {
    const response = await fetch(`/api/documents/${documentId}`);
    if (!response.ok) return;
    const data = await response.json();
    setDocument((prev) =>
      prev
        ? {
            ...prev,
            status: data.document.status,
            sections: data.document.sections || [],
          }
        : prev
    );
  };

  const runOcrForPage = async (documentId: string, pageId: string) => {
    setOcrRunningIds((prev) => ({ ...prev, [pageId]: true }));
    try {
      const response = await fetch(
        `/api/documents/${documentId}/pages/${pageId}/ocr`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "OCR failed");
      }

      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, ...data.page, ocr: data.ocr } : p))
      );
    } catch (error) {
      console.error("OCR error:", error);
    } finally {
      setOcrRunningIds((prev) => ({ ...prev, [pageId]: false }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !document || files.length === 0) return;

    // Check if adding these pages would exceed the limit
    const newPageCount = document.pageCount + files.length;
    if (newPageCount > 10) {
      alert(`Cannot upload ${files.length} page(s). Maximum is 10 pages per document. You can upload ${10 - document.pageCount} more page(s).`);
      return;
    }

    setIsUploading(true);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/documents/${document.id}/pages`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to upload page");
        }

        const data = await response.json();
        setPages((prev) => [...prev, { ...data.page, ocr: null }]);
        setDocument((prev) => prev ? { ...prev, pageCount: prev.pageCount + 1 } : null);

        await runOcrForPage(document.id, data.page.id);
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert(error instanceof Error ? error.message : "Failed to upload pages");
    } finally {
      setIsUploading(false);
      // Reset file input
      e.target.value = "";
    }
  };

  const handleAcceptPage = async (pageId: string) => {
    if (!document) return;
    setActioningPageId(pageId);
    try {
      const updated = await acceptPage(document.id, pageId);
      setPages((prev) =>
        prev.map((p) => (p.id === pageId ? { ...p, status: updated.status as PageStatus } : p))
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to accept page");
    } finally {
      setActioningPageId(null);
    }
  };

  const handleReuploadPage = async (pageId: string, file: File) => {
    if (!document) return;
    setActioningPageId(pageId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const updated = await reuploadPage(document.id, pageId, formData);
      setPages((prev) =>
        prev.map((p) =>
          p.id === pageId
            ? {
                ...p,
                status: updated.status as PageStatus,
                ocrFailureReason: updated.ocrFailureReason,
                blobPath: updated.blobPath,
                ocr: null,
              }
            : p
        )
      );
      await runOcrForPage(document.id, pageId);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to re-upload page");
    } finally {
      setActioningPageId(null);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!document) return;
    if (!window.confirm("Delete this page? This cannot be undone.")) return;

    setActioningPageId(pageId);
    try {
      await deletePage(document.id, pageId);
      await refetchPages(document.id);
      setDocument((prev) => (prev ? { ...prev, pageCount: prev.pageCount - 1 } : null));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete page");
    } finally {
      setActioningPageId(null);
    }
  };

  const handleFinishDocument = async () => {
    if (!document) return;

    setIsFinishing(true);
    try {
      await finishDocument(document.id);
      await refetchDocument(document.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to finish document");
    } finally {
      setIsFinishing(false);
    }
  };

  const handleRetryProcessing = async () => {
    if (!document) return;

    setIsRetrying(true);
    try {
      await retryDocumentProcessing(document.id);
      await refetchDocument(document.id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to retry processing");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleTitleSave = async () => {
    if (!document || !titleInput.trim()) {
      setIsEditingTitle(false);
      setTitleInput("");
      return;
    }

    try {
      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: titleInput.trim() }),
      });

      if (response.ok) {
        setDocument((prev) => prev ? { ...prev, title: titleInput.trim() } : null);
        setIsEditingTitle(false);
      }
    } catch (error) {
      console.error("Failed to update title:", error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch-on-mount
    initializeWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initializeWorkspace is stable per mount
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Unable to load workspace</p>
          <button
            onClick={() => router.push("/app/start")}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  const isReady = document.status === "READY";
  const isProcessing = document.status === "COMPLETED" || document.status === "PROCESSING";
  const isProcessingFailed = document.status === "PROCESSING_FAILED";
  const acceptedPageCount = pages.filter((p) => p.status === "ACCEPTED").length;
  const canFinish = acceptedPageCount > 0 && document.status === "IN_PROGRESS";
  const canUpload = document.pageCount < 10 && document.status === "IN_PROGRESS";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleTitleSave();
                      if (e.key === "Escape") {
                        setIsEditingTitle(false);
                        setTitleInput("");
                      }
                    }}
                    onBlur={handleTitleSave}
                    className="text-2xl font-bold text-gray-900 border-2 border-blue-500 rounded px-2 py-1 w-full max-w-md"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1
                    className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => {
                      setTitleInput(document.title);
                      setIsEditingTitle(true);
                    }}
                  >
                    {document.title}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setTitleInput(document.title);
                      setIsEditingTitle(true);
                    }}
                    className="text-gray-400 hover:text-blue-600 opacity-70 group-hover:opacity-100 transition-opacity"
                    aria-label="Rename document"
                    title="Rename document"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {document.pageCount}/10 pages
              </div>

              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  isReady
                    ? "bg-green-100 text-green-800"
                    : isProcessingFailed
                    ? "bg-red-100 text-red-800"
                    : isProcessing
                    ? "bg-blue-100 text-blue-800"
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {documentStatusLabel(document.status)}
              </span>

              {savedUserId ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  Saved to your account
                </span>
              ) : (
                <Link
                  href="/app/save"
                  className="inline-flex items-center rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Save workspace
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Document info and pages */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload section */}
            {canUpload && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Upload Pages
                </h2>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg
                        className="w-8 h-8 mb-4 text-gray-500"
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 20 16"
                      >
                        <path
                          stroke="currentColor"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                        />
                      </svg>
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        JPEG, PNG, or WEBP (MAX 10 pages total)
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                {isUploading && (
                  <div className="mt-4 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                    <span className="text-sm text-gray-600">Uploading...</span>
                  </div>
                )}
              </div>
            )}

            {/* Pages list */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Pages ({pages.length})
              </h2>
              {pages.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No pages uploaded yet. Upload your document pages to get started.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {pages.map((page) => {
                    const isOcrRunning = !!ocrRunningIds[page.id];
                    const isActioning = actioningPageId === page.id;
                    const blocked = hasBlockingQuality(
                      page.ocr?.warnings ?? null,
                      page.ocr?.extractedText ?? null
                    );
                    const canAccept =
                      page.status === "OCR_COMPLETE" && !blocked && !isActioning;
                    const canReupload = page.status !== "ACCEPTED" && !isActioning;
                    const canDelete = document.status === "IN_PROGRESS" && !isActioning;

                    return (
                      <div
                        key={page.id}
                        className="border border-gray-200 rounded-lg p-4 flex flex-col gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => setExpandedImagePage(page)}
                            className="shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic authenticated API route with private Blob storage */}
                            <img
                              src={`/api/documents/${document.id}/pages/${page.id}/image`}
                              alt={`Page ${page.order + 1} (click to enlarge)`}
                              className="w-32 sm:w-40 aspect-3/4 object-cover bg-gray-100 rounded cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                            />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-gray-900">
                                Page {page.order + 1}
                              </span>
                              <span
                                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  page.status === "ACCEPTED"
                                    ? "bg-green-100 text-green-800"
                                    : page.status === "OCR_FAILED" || blocked
                                    ? "bg-red-100 text-red-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {isOcrRunning ? "Running OCR..." : statusLabel(page)}
                              </span>
                            </div>

                            {/* Quality indicators */}
                            {page.ocr?.warnings && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {page.ocr.warnings.blurry && (
                                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>📷</span> Blurry
                                  </span>
                                )}
                                {page.ocr.warnings.cutOff && (
                                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>✂️</span> Cut off
                                  </span>
                                )}
                                {page.ocr.warnings.sideways && (
                                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>🔄</span> Sideways
                                  </span>
                                )}
                                {page.ocr.warnings.incomplete && (
                                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>📄</span> Incomplete
                                  </span>
                                )}
                                {page.ocr.warnings.unreadable && (
                                  <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>❓</span> Unreadable
                                  </span>
                                )}
                              </div>
                            )}

                            {page.status === "OCR_FAILED" && page.ocrFailureReason && (
                              <div className="mt-2">
                                <p className="text-sm text-red-700 font-medium">
                                  {page.ocrFailureReason}
                                </p>
                                <p className="text-xs text-gray-600 mt-1">
                                  Please try re-uploading the image with better quality.
                                </p>
                              </div>
                            )}

                            {blocked && page.ocr?.warnings?.retakeGuidance && (
                              <p className="text-sm text-red-700 mt-2 font-medium">
                                {page.ocr.warnings.retakeGuidance}
                              </p>
                            )}

                            {page.ocr?.extractedText && (
                              <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                                {page.ocr.extractedText}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleAcceptPage(page.id)}
                            disabled={!canAccept}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                              canAccept
                                ? "bg-blue-600 text-white hover:bg-blue-700"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed"
                            }`}
                          >
                            Accept
                          </button>

                          <label
                            className={`text-xs font-semibold px-3 py-1.5 rounded-md text-center ${
                              canReupload
                                ? "bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-pointer"
                                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                            }`}
                          >
                            Re-upload
                            <input
                              type="file"
                              className="hidden"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={!canReupload}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleReuploadPage(page.id, file);
                                e.target.value = "";
                              }}
                            />
                          </label>

                          <button
                            onClick={() => handleDeletePage(page.id)}
                            disabled={!canDelete}
                            className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                              canDelete
                                ? "bg-red-50 text-red-700 hover:bg-red-100"
                                : "bg-gray-100 text-gray-300 cursor-not-allowed"
                            }`}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right column - Actions */}
          <div className="space-y-6">
            {/* Naming nudge: shown once pages exist but the document still has its default
                title, so the user is prompted to name it before finishing. */}
            {pages.length > 0 &&
              document.status === "IN_PROGRESS" &&
              isDefaultDocumentTitle(document.title) && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-900 font-medium mb-2">
                    Don&apos;t forget to name your document
                  </p>
                  <p className="text-sm text-amber-800 mb-3">
                    Give it a label like &quot;Probation Conditions&quot; so it&apos;s easy to
                    find later.
                  </p>
                  <button
                    onClick={() => {
                      setTitleInput(document.title);
                      setIsEditingTitle(true);
                    }}
                    className="text-sm font-semibold text-amber-900 hover:text-amber-700 underline"
                  >
                    Name it now
                  </button>
                </div>
              )}

            {/* Status card */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Document Status
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pages uploaded:</span>
                  <span className="font-medium">{document.pageCount}/10</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pages accepted:</span>
                  <span className="font-medium">{acceptedPageCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium">{documentStatusLabel(document.status)}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            {document.status === "IN_PROGRESS" && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Actions
                </h2>
                <button
                  onClick={handleFinishDocument}
                  disabled={!canFinish || isFinishing}
                  className={`w-full py-3 px-4 rounded-md font-semibold transition-colors ${
                    canFinish && !isFinishing
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isFinishing ? "Processing..." : "Finish Document"}
                </button>
                {!canFinish && (
                  <p className="text-sm text-gray-500 mt-2 text-center">
                    Accept at least one page to finish
                  </p>
                )}
              </div>
            )}

            {(isProcessing || isFinishing) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <h2 className="text-lg font-semibold text-blue-900 mb-1">
                  Organizing your document
                </h2>
                <p className="text-sm text-blue-700">
                  We&apos;re creating sections from your accepted pages. This may take a moment.
                </p>
              </div>
            )}

            {isProcessingFailed && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-red-900 mb-2">
                  We couldn&apos;t finish organizing this document
                </h2>
                <p className="text-sm text-red-700 mb-4">
                  Please try again.
                </p>
                <button
                  onClick={handleRetryProcessing}
                  disabled={isRetrying}
                  className={`w-full py-3 px-4 rounded-md font-semibold transition-colors ${
                    !isRetrying
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isRetrying ? "Retrying..." : "Retry"}
                </button>
              </div>
            )}

            {isReady && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-green-900 mb-2">
                  Document Ready!
                </h2>
                <p className="text-sm text-green-700 mb-4">
                  Your document has been organized into sections below. You can now ask questions
                  about it.
                </p>
                <Link
                  href="/app/chat"
                  className="inline-block rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Ask about your documents
                </Link>
              </div>
            )}

            {isReady && document.sections.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Sections
                </h2>
                <div className="space-y-4">
                  {document.sections.map((section) => (
                    <div key={section.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                      <h3 className="text-sm font-semibold text-gray-900">{section.heading}</h3>
                      <p className="text-sm text-gray-700 mt-1">{section.body}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Based on {section.sources.length} accepted page
                        {section.sources.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Expanded image modal */}
      {expandedImagePage && document && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedImagePage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setExpandedImagePage(null)}
              className="absolute -top-12 right-0 text-white text-4xl font-bold hover:text-gray-300 focus:outline-none"
              aria-label="Close"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic authenticated API route with private Blob storage */}
            <img
              src={`/api/documents/${document.id}/pages/${expandedImagePage.id}/image`}
              alt={`Page ${expandedImagePage.order + 1} enlarged`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <p className="text-white text-center mt-2 text-sm">
              Page {expandedImagePage.order + 1} • Click anywhere to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
