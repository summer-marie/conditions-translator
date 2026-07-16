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
import { signOut } from "@/lib/actions/auth";
import { DEFAULT_DOCUMENT_TITLE, isDefaultDocumentTitle } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

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
  const [isSigningOut, setIsSigningOut] = useState(false);

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
        // Prefer resuming the most recent IN_PROGRESS document (still under construction) over
        // the most recent document overall — otherwise a signed-in user with an older unfinished
        // document and a newer finished one would land on the finished one and be unable to
        // resume uploading pages to the unfinished one.
        const doc =
          data.documents.find(
            (d: { status: DocumentStatus }) => d.status === "IN_PROGRESS"
          ) ?? data.documents[0];
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

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Failed to sign out:", error);
      setIsSigningOut(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time fetch-on-mount
    initializeWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initializeWorkspace is stable per mount
  }, []);

  useEffect(() => {
    if (!expandedImagePage) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setExpandedImagePage(null);
    }
    window.document.addEventListener("keydown", handleKeyDown);
    return () => window.document.removeEventListener("keydown", handleKeyDown);
  }, [expandedImagePage]);

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center" 
        style={{ backgroundColor: 'var(--color-background-subtle)' }}
      >
        <div className="text-center">
          <div 
            className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" 
            style={{ borderColor: 'var(--color-accent-processing)' }}
          ></div>
          <p 
            style={{ 
              color: 'var(--color-text-body)',
              fontSize: 'var(--font-size-body)'
            }}
          >
            Loading workspace...
          </p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4" 
        style={{ backgroundColor: 'var(--color-background-subtle)' }}
      >
        <div className="text-center">
          <p 
            className="mb-4" 
            style={{ 
              color: 'var(--color-text-body)',
              fontSize: 'var(--font-size-body)'
            }}
          >
            Unable to load workspace
          </p>
          <Button onClick={() => router.push("/app/start")} variant="primary">
            Start Over
          </Button>
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
    <div style={{ backgroundColor: 'var(--color-background-subtle)' }}>
      {/* Header */}
      <header 
        className="border-b" 
        style={{ 
          backgroundColor: 'var(--color-background-page)',
          borderColor: 'var(--color-border-divider)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
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
                    variant="heading"
                    className="max-w-md"
                    autoFocus
                  />
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1
                    className="font-bold cursor-pointer transition-colors"
                    onClick={() => {
                      setTitleInput(document.title);
                      setIsEditingTitle(true);
                    }}
                    style={{
                      fontSize: 'var(--font-size-h2)',
                      color: 'var(--color-text-heading)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent-processing)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-heading)'}
                  >
                    {document.title}
                  </h1>
                  <button
                    type="button"
                    onClick={() => {
                      setTitleInput(document.title);
                      setIsEditingTitle(true);
                    }}
                    className="opacity-70 group-hover:opacity-100 transition-opacity"
                    aria-label="Rename document"
                    title="Rename document"
                    style={{
                      color: 'var(--color-text-meta)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent-processing)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-meta)'}
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
              <div 
                className="text-sm" 
                style={{ color: 'var(--color-text-body)' }}
              >
                {document.pageCount}/10 pages
              </div>

              <Badge 
                variant={
                  isReady ? "success" : 
                  isProcessingFailed ? "destructive" : 
                  isProcessing ? "processing" : 
                  "warning"
                }
              >
                {documentStatusLabel(document.status)}
              </Badge>

              {savedUserId ? (
                <>
                  <Badge variant="success">Saved to your account</Badge>
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="font-medium disabled:opacity-50"
                    style={{
                      color: 'var(--color-text-body)',
                      fontSize: 'var(--font-size-body)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-text-heading)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-body)'}
                  >
                    {isSigningOut ? "Signing out..." : "Sign out"}
                  </button>
                </>
              ) : (
                <>
                  {/* TODO(cleanup): "Log in" and "Save workspace" both land on /app/save and
                      read as two near-identical buttons. This is a stopgap so a signed-out
                      returning user has a way back in at all — the save/sign-in entry UX could
                      use a proper pass later (see .agent-memory/OPEN_QUESTIONS.md). */}
                  <Link href="/app/save?mode=signin">
                    <Button variant="secondary" size="md">Log in</Button>
                  </Link>
                  <Link href="/app/save">
                    <Button variant="primary" size="md">Save workspace</Button>
                  </Link>
                </>
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
              <Card variant="panel">
                <h2
                  className="mb-4"
                  style={{
                    fontSize: 'var(--font-size-h3)',
                    fontWeight: 'var(--font-weight-h3)',
                    color: 'var(--color-text-heading)',
                    marginBottom: 'var(--spacing-4)'
                  }}
                >
                  Upload Pages
                </h2>
                <div className="flex items-center justify-center w-full">
                  <label 
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer"
                    style={{
                      borderColor: 'var(--color-border-default)',
                      backgroundColor: 'var(--color-background-subtle)',
                      borderRadius: 'var(--radius-md)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-border-subtle)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--color-background-subtle)'}
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg
                        className="mb-4"
                        style={{ width: '2rem', height: '2rem', color: 'var(--color-text-meta)', marginBottom: 'var(--spacing-2)' }}
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
                      <p 
                        className="mb-2"
                        style={{
                          fontSize: 'var(--font-size-body)',
                          color: 'var(--color-text-meta)',
                          marginBottom: 'var(--spacing-2)'
                        }}
                      >
                        <span style={{ fontWeight: 'var(--font-weight-h3)' }}>Click to upload</span> or drag and drop
                      </p>
                      <p 
                        style={{
                          fontSize: 'var(--font-size-caption)',
                          color: 'var(--color-text-meta)'
                        }}
                      >
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
                    <div 
                      className="animate-spin rounded-full mr-2" 
                      style={{ 
                        width: '1.5rem', 
                        height: '1.5rem', 
                        borderBottomColor: 'var(--color-accent-processing)',
                        marginRight: 'var(--spacing-2)'
                      }}
                    ></div>
                    <span 
                      style={{
                        fontSize: 'var(--font-size-body)',
                        color: 'var(--color-text-body)'
                      }}
                    >
                      Uploading...
                    </span>
                  </div>
                )}
              </Card>
            )}

            {/* Pages list */}
            <Card variant="panel">
              <h2
                className="mb-4"
                style={{
                  fontSize: 'var(--font-size-h3)',
                  fontWeight: 'var(--font-weight-h3)',
                  color: 'var(--color-text-heading)',
                  marginBottom: 'var(--spacing-4)'
                }}
              >
                Pages ({pages.length})
              </h2>
              {pages.length === 0 ? (
                <p 
                  className="text-center py-8"
                  style={{
                    fontSize: 'var(--font-size-body)',
                    color: 'var(--color-text-meta)',
                    textAlign: 'center',
                    padding: 'var(--spacing-8) 0'
                  }}
                >
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
                        className="flex flex-col gap-3"
                        style={{
                          border: `1px solid var(--color-border-card)`,
                          borderRadius: 'var(--radius-md)',
                          padding: 'var(--spacing-4)'
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => setExpandedImagePage(page)}
                            className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic authenticated API route with private Blob storage */}
                            <img
                              src={`/api/documents/${document.id}/pages/${page.id}/image`}
                              alt={`Page ${page.order + 1} (click to enlarge)`}
                              style={{
                                width: '8rem',
                                height: '10.67rem',
                                aspectRatio: '3/4',
                                objectFit: 'cover',
                                backgroundColor: 'var(--color-background-subtle)',
                                borderRadius: 'var(--radius-sm)',
                                cursor: 'pointer'
                              }}
                              className="hover:ring-2 hover:ring-blue-400 transition-all"
                            />
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span style={{ fontSize: 'var(--font-size-body)', fontWeight: 'var(--font-weight-h3)', color: 'var(--color-text-heading)' }}>
                                Page {page.order + 1}
                              </span>
                              <Badge 
                                variant={
                                  page.status === "ACCEPTED"
                                    ? "success"
                                    : page.status === "OCR_FAILED" || blocked
                                    ? "destructive"
                                    : "warning"
                                }
                              >
                                {isOcrRunning ? "Running OCR..." : statusLabel(page)}
                              </Badge>
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
                          <Button
                            onClick={() => handleAcceptPage(page.id)}
                            disabled={!canAccept}
                            variant="primary"
                            size="sm"
                          >
                            Accept
                          </Button>

                          <label>
                            <Button
                              variant="secondary"
                              size="sm"
                              disabled={!canReupload}
                            >
                              <span>Re-upload</span>
                            </Button>
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

                          <Button
                            onClick={() => handleDeletePage(page.id)}
                            disabled={!canDelete}
                            variant="danger"
                            size="sm"
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Right column - Actions */}
          <div className="space-y-6">
            {/* Naming nudge: shown once pages exist but the document still has its default
                title, so the user is prompted to name it before finishing. */}
            {pages.length > 0 &&
              document.status === "IN_PROGRESS" &&
              isDefaultDocumentTitle(document.title) && (
                <div
                  className="rounded-lg p-4"
                  style={{
                    backgroundColor: 'var(--color-accent-warning-bg)',
                    border: `1px solid var(--color-accent-warning)`,
                    padding: 'var(--spacing-4)'
                  }}
                >
                  <p
                    className="mb-2"
                    style={{
                      fontSize: 'var(--font-size-body)',
                      color: 'var(--color-accent-warning)',
                      fontWeight: 'var(--font-weight-h3)',
                      marginBottom: 'var(--spacing-2)'
                    }}
                  >
                    Don&apos;t forget to name your document
                  </p>
                  <p
                    className="mb-3"
                    style={{
                      fontSize: 'var(--font-size-body)',
                      color: 'var(--color-accent-warning)',
                      marginBottom: 'var(--spacing-3)'
                    }}
                  >
                  Give it a label like &ldquo;Probation Conditions&rdquo; so it&apos;s easy to
                  find later.
                  </p>
                  <button
                    onClick={() => {
                      setTitleInput(document.title);
                      setIsEditingTitle(true);
                    }}
                    className="underline"
                    style={{
                      fontSize: 'var(--font-size-body)',
                      color: 'var(--color-accent-warning)',
                      fontWeight: 'var(--font-weight-h3)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-accent-processing)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-accent-warning)'}
                  >
                    Name it now
                  </button>
                </div>
              )}

            {/* Status card */}
            <Card variant="panel">
              <h2
                style={{
                  fontSize: 'var(--font-size-h3)',
                  fontWeight: 'var(--font-weight-h3)',
                  color: 'var(--color-text-heading)',
                  marginBottom: 'var(--spacing-4)'
                }}
              >
                Document Status
              </h2>
              <div className="space-y-2" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)' }}>
                <div className="flex justify-between text-sm">
                  <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}>Pages uploaded:</span>
                  <span style={{ fontSize: 'var(--font-size-body)', fontWeight: 'var(--font-weight-h3)', color: 'var(--color-text-heading)' }}>{document.pageCount}/10</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}>Pages accepted:</span>
                  <span style={{ fontSize: 'var(--font-size-body)', fontWeight: 'var(--font-weight-h3)', color: 'var(--color-text-heading)' }}>{acceptedPageCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}>Status:</span>
                  <span style={{ fontSize: 'var(--font-size-body)', fontWeight: 'var(--font-weight-h3)', color: 'var(--color-text-heading)' }}>{documentStatusLabel(document.status)}</span>
                </div>
              </div>
            </Card>

            {/* Actions */}
            {document.status === "IN_PROGRESS" && (
              <Card variant="panel">
                <h2
                  style={{
                    fontSize: 'var(--font-size-h3)',
                    fontWeight: 'var(--font-weight-h3)',
                    color: 'var(--color-text-heading)',
                    marginBottom: 'var(--spacing-4)'
                  }}
                >
                  Actions
                </h2>
                <Button
                  onClick={handleFinishDocument}
                  disabled={!canFinish || isFinishing}
                  isLoading={isFinishing}
                  variant="primary"
                  fullWidth
                >
                  {isFinishing ? "Processing..." : "Finish Document"}
                </Button>
                {!canFinish && (
                  <p 
                    className="text-center mt-2"
                    style={{
                      fontSize: 'var(--font-size-caption)',
                      color: 'var(--color-text-meta)',
                      textAlign: 'center',
                      marginTop: 'var(--spacing-2)'
                    }}
                  >
                    Accept at least one page to finish
                  </p>
                )}
              </Card>
            )}

            {(isProcessing || isFinishing) && (
              <div
                className="rounded-lg p-6 text-center"
                style={{
                  backgroundColor: 'var(--color-accent-processing-bg)',
                  border: `1px solid var(--color-accent-processing)`,
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-6)'
                }}
              >
                <div 
                  className="animate-spin rounded-full mx-auto mb-3" 
                  style={{ 
                    width: '2rem', 
                    height: '2rem', 
                    borderBottomColor: 'var(--color-accent-processing)',
                    margin: '0 auto var(--spacing-2) auto'
                  }}
                ></div>
                <h2 
                  style={{
                    fontSize: 'var(--font-size-h3)',
                    fontWeight: 'var(--font-weight-h3)',
                    color: 'var(--color-accent-processing)',
                    marginBottom: 'var(--spacing-1)'
                  }}
                >
                  Organizing your document
                </h2>
                <p 
                  style={{
                    fontSize: 'var(--font-size-body)',
                    color: 'var(--color-accent-processing)'
                  }}
                >
                  We&apos;re creating sections from your accepted pages. This may take a moment.
                </p>
              </div>
            )}

            {isProcessingFailed && (
              <div
                className="rounded-lg"
                style={{
                  backgroundColor: 'var(--color-accent-destructive-bg)',
                  border: `1px solid var(--color-accent-destructive)`,
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-6)'
                }}
              >
                <h2
                  style={{
                    fontSize: 'var(--font-size-h3)',
                    fontWeight: 'var(--font-weight-h3)',
                    color: 'var(--color-accent-destructive)',
                    marginBottom: 'var(--spacing-1)'
                  }}
                >
                  We couldn&apos;t finish organizing this document
                </h2>
                <p
                  style={{
                    fontSize: 'var(--font-size-body)',
                    color: 'var(--color-accent-destructive)',
                    marginBottom: 'var(--spacing-2)'
                  }}
                >
                  Please try again.
                </p>
                <Button
                  onClick={handleRetryProcessing}
                  disabled={isRetrying}
                  isLoading={isRetrying}
                  variant="danger"
                  fullWidth
                >
                  {isRetrying ? "Retrying..." : "Retry"}
                </Button>
              </div>
            )}

            {isReady && (
              <div
                className="rounded-lg"
                style={{
                  backgroundColor: 'var(--color-accent-success-bg)',
                  border: `1px solid var(--color-accent-success)`,
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--spacing-6)'
                }}
              >
                <h2
                  style={{
                    fontSize: 'var(--font-size-h3)',
                    fontWeight: 'var(--font-weight-h3)',
                    color: 'var(--color-accent-success)',
                    marginBottom: 'var(--spacing-1)'
                  }}
                >
                  Document Ready!
                </h2>
                <p
                  style={{
                    fontSize: 'var(--font-size-body)',
                    color: 'var(--color-accent-success)',
                    marginBottom: 'var(--spacing-2)'
                  }}
                >
                  Your document has been organized into sections below. You can now ask questions
                  about it.
                </p>
                <Link
                  href="/app/chat"
                  style={{
                    display: 'inline-block',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--color-accent-success)',
                    padding: 'var(--spacing-2) var(--spacing-4)',
                    fontSize: 'var(--font-size-body)',
                    fontWeight: 'var(--font-weight-h3)',
                    color: 'var(--color-text-inverse)',
                    textDecoration: 'none'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Ask about your documents
                </Link>
              </div>
            )}

            {isReady && document.sections.length > 0 && (
              <div 
                style={{
                  backgroundColor: 'var(--color-background-page)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-md)',
                  padding: 'var(--spacing-6)'
                }}
              >
                <h2 
                  style={{
                    fontSize: 'var(--font-size-h2)',
                    fontWeight: 'var(--font-weight-h2)',
                    color: 'var(--color-text-heading)',
                    marginBottom: 'var(--spacing-4)'
                  }}
                >
                  Sections
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
                  {document.sections.map((section) => (
                    <div 
                      key={section.id} 
                      style={{
                        borderBottom: `1px solid var(--color-border-subtle)`,
                        paddingBottom: 'var(--spacing-4)'
                      }}
                      className="last:border-0 last:pb-0"
                    >
                      <h3 style={{ fontSize: 'var(--font-size-body)', fontWeight: 'var(--font-weight-h3)', color: 'var(--color-text-heading)' }}>
                        {section.heading}
                      </h3>
                      <p 
                        style={{ 
                          fontSize: 'var(--font-size-body)', 
                          color: 'var(--color-text-body)', 
                          marginTop: 'var(--spacing-1)'
                        }}
                      >
                        {section.body}
                      </p>
                      <p 
                        style={{ 
                          fontSize: 'var(--font-size-caption)', 
                          color: 'var(--color-text-meta)', 
                          marginTop: 'var(--spacing-1)'
                        }}
                      >
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
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedImagePage(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Page ${expandedImagePage.order + 1} enlarged`}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setExpandedImagePage(null)}
              className="absolute -top-12 right-0 text-white text-4xl font-bold hover:text-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
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
