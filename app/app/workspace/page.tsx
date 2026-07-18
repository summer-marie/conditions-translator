// Workspace UI shell for temporary document intake.
//
// Shows: document title (editable inline), page list with OCR preview/accept/re-upload/delete,
// upload button, Finish Document button.
// Upload button is disabled once page_count = 10.
// Finish Document button is disabled when page_count = 0.
// No AI controls are visible while status = IN_PROGRESS.

"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createTemporaryDocument,
  finishDocument,
  retryDocumentProcessing,
  acceptPage,
  correctPageOcr,
  reuploadPage,
  deletePage,
} from "@/lib/actions/document";
import { signOut } from "@/lib/actions/auth";
import {
  DEFAULT_DOCUMENT_TITLE,
  isDefaultDocumentTitle,
  OCR_MAX_CORRECTION_CHARACTERS,
} from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { useFocusTrap } from "@/hooks/useFocusTrap";

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
  correctedText: string | null;
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

// Shared attributes for both page-image file inputs (initial upload and re-upload): prefers
// opening the rear camera on supported mobile browsers via the standard capture-attribute hint,
// while desktop browsers ignore both attributes and open the normal file picker. This is a
// browser/OS hint, not a guarantee -- some mobile browsers show a camera/gallery choice instead of
// jumping straight to the camera, and none of this is enforced; actual format/size validation
// happens server-side in lib/validation/image.ts regardless of what was selected. Exported (like
// the helpers below) so it can be asserted on without a component-rendering harness.
export const PAGE_IMAGE_FILE_INPUT_PROPS = {
  accept: "image/*",
  capture: "environment" as const,
};

// Builds the workspace URL for switching the finished-document view between its "Sections" tab
// (default -- omits the param, matching today's plain sidenav document link) and its "Pages" tab
// (read-only page set, reached via the sidenav overflow menu's "Review pages" action -- see
// components/layout/AppNav.tsx). Takes the current search string so ?documentId= (and anything
// else already present) survives the tab switch untouched. Exported so this can be
// regression-tested without a component-rendering harness (see initialCorrectionValue below).
export function buildWorkspacePanelUrl(currentSearch: string, panel: "sections" | "pages"): string {
  const params = new URLSearchParams(currentSearch);
  if (panel === "pages") {
    params.set("panel", "pages");
  } else {
    params.delete("panel");
  }
  const qs = params.toString();
  return `/app/workspace${qs ? `?${qs}` : ""}`;
}

// Initial value for a page's correction textarea: the current accepted-text source
// (correctedText ?? extractedText), matching the same selection used by section generation,
// chat context, and the document inspector. Exported so this and validateCorrectionText below
// can be regression-tested without a component-rendering harness (this repo's vitest config runs
// in the "node" environment, with no jsdom/React Testing Library — see
// tests/components/chat/DocumentInspector.test.ts for the same approach).
export function initialCorrectionValue(ocr: OcrResult | null | undefined): string {
  return ocr?.correctedText ?? ocr?.extractedText ?? "";
}

// Client-side mirror of correctPageOcr's validation (lib/actions/document.ts): trims outer
// whitespace only (internal spaces/line breaks are preserved), rejects empty/whitespace-only
// text, and enforces the same OCR_MAX_CORRECTION_CHARACTERS limit. Used both to gate the Save
// button and to short-circuit an obviously-invalid save before calling the server.
export function validateCorrectionText(value: string): { trimmed: string; error: string | null } {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return { trimmed, error: "Correction cannot be empty." };
  }

  if (trimmed.length > OCR_MAX_CORRECTION_CHARACTERS) {
    return {
      trimmed,
      error: `Correction cannot exceed ${OCR_MAX_CORRECTION_CHARACTERS} characters.`,
    };
  }

  return { trimmed, error: null };
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
  return (
    // useSearchParams() requires a Suspense boundary in the App Router (same pattern as
    // app/app/save/page.tsx).
    <Suspense fallback={null}>
      <WorkspacePageContent />
    </Suspense>
  );
}

function WorkspacePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Presence of ?documentId= means the user picked a finished document from the sidenav; absence
  // means "show my active intake document" (today's default behavior, unchanged).
  const viewedDocumentId = searchParams.get("documentId");

  // The document currently rendered in the main content area -- either the active intake
  // document (default) or a different, already-finished document selected via the sidenav.
  const [document, setDocument] = useState<Document | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  // The user's own active IN_PROGRESS document (or null if none exists yet). Kept separate from
  // `document` above so the Upload Pages box always targets the user's real intake document, even
  // while `document` is showing a different, finished document browsed from the sidenav.
  const [intakeDocument, setIntakeDocument] = useState<Document | null>(null);
  const [isLoadingViewedDocument, setIsLoadingViewedDocument] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");
  const [ocrRunningIds, setOcrRunningIds] = useState<Record<string, boolean>>({});
  const [actioningPageId, setActioningPageId] = useState<string | null>(null);
  // OCR transcription correction (docs/OCR_Master_Implementation_Plan.md §7-8): local textarea
  // drafts, per-page save/error/saved state. Keyed by pageId, separate from actioningPageId so
  // Save stays a distinct action from Accept/Re-upload/Delete.
  const [correctionDrafts, setCorrectionDrafts] = useState<Record<string, string>>({});
  const [savingCorrectionIds, setSavingCorrectionIds] = useState<Record<string, boolean>>({});
  const [correctionErrors, setCorrectionErrors] = useState<Record<string, string | null>>({});
  const [correctionSavedIds, setCorrectionSavedIds] = useState<Record<string, boolean>>({});
  const [expandedImagePage, setExpandedImagePage] = useState<Page | null>(null);
  const expandedImageModalRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(expandedImagePage !== null, expandedImageModalRef);
  const [deletePageModal, setDeletePageModal] = useState<{
    isOpen: boolean;
    pageId: string | null;
    isDeleting: boolean;
    error: string | null;
  }>({ isOpen: false, pageId: null, isDeleting: false, error: null });
  const deletePageModalRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(deletePageModal.isOpen, deletePageModalRef);
  // Keyed by page id: an explicit ref->click() trigger for each page's hidden re-upload file
  // input, since a <label> wrapping both a visible Button and the input resolves its implicit
  // control to the first labelable descendant (the button), not the input -- clicking never
  // opened the file picker. See docs/USABILITY_UI_AUDIT.md follow-up diagnosis.
  const reuploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
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
      // Resolve the user's active intake document exactly as before: prefer the most recent
      // IN_PROGRESS document (still under construction) over the most recent document overall —
      // otherwise a signed-in user with an older unfinished document and a newer finished one
      // would land on the finished one and be unable to resume uploading pages to the unfinished
      // one. This resolution is unaffected by ?documentId= -- the Upload Pages box always targets
      // this document regardless of what's currently shown in the main content area.
      let resolvedIntake: Document | null = null;
      if (data.documents && data.documents.length > 0) {
        const inProgress = data.documents.find(
          (d: { status: DocumentStatus }) => d.status === "IN_PROGRESS"
        );
        if (inProgress) {
          resolvedIntake = {
            id: inProgress.id,
            title: inProgress.title,
            status: inProgress.status,
            pageCount: inProgress._count.pages,
            sections: inProgress.sections || [],
          };
        }
      } else if (!status.userId) {
        // Only auto-create a fresh document in temporary mode; a saved account with no documents
        // is handled by the empty-state below rather than silently creating a temporary one.
        setIsCreating(true);
        try {
          const newDoc = await createTemporaryDocument(DEFAULT_DOCUMENT_TITLE);
          if (newDoc) {
            resolvedIntake = {
              id: newDoc.id,
              title: newDoc.title,
              status: newDoc.status as DocumentStatus,
              pageCount: 0,
              sections: [],
            };
          }
        } finally {
          setIsCreating(false);
        }
      }
      setIntakeDocument(resolvedIntake);

      // With no ?documentId= param, the main content area shows the intake document itself
      // (today's default behavior, unchanged). With the param present, a separate effect below
      // fetches and shows that specific document instead.
      if (!viewedDocumentId) {
        if (resolvedIntake) {
          setDocument(resolvedIntake);
          await refetchPages(resolvedIntake.id);
        } else if (data.documents && data.documents.length > 0) {
          // Signed-in owner with documents but none IN_PROGRESS and no ?documentId= selected:
          // show the most recent one so the workspace isn't blank.
          const doc = data.documents[0];
          setDocument({
            id: doc.id,
            title: doc.title,
            status: doc.status,
            pageCount: doc._count.pages,
            sections: doc.sections || [],
          });
          await refetchPages(doc.id);
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
      return pagesData.pages || [];
    }
    return [];
  };

  // Loads a specific, already-finished document selected from the sidenav (?documentId=) into
  // the main content area, independent of the user's own active intake document. Reuses the same
  // owner-aware endpoints as the default flow -- no new persistence path for guests or accounts.
  const loadViewedDocument = async (id: string) => {
    setIsLoadingViewedDocument(true);
    try {
      const response = await fetch(`/api/documents/${id}`);
      if (!response.ok) {
        throw new Error("Failed to load document");
      }
      const data = await response.json();
      const loadedPages = await refetchPages(id);
      setDocument({
        id: data.document.id,
        title: data.document.title,
        status: data.document.status,
        pageCount: loadedPages.length,
        sections: data.document.sections || [],
      });
    } catch (error) {
      console.error("Failed to load selected document:", error);
    } finally {
      setIsLoadingViewedDocument(false);
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
        prev.some((p) => p.id === pageId)
          ? prev.map((p) => (p.id === pageId ? { ...p, ...data.page, ocr: data.ocr } : p))
          : prev
      );
    } catch (error) {
      console.error("OCR error:", error);
    } finally {
      setOcrRunningIds((prev) => ({ ...prev, [pageId]: false }));
    }
  };

  // An in-progress local edit if one exists, otherwise falls back to initialCorrectionValue.
  const getCorrectionValue = (page: Page): string => {
    if (page.id in correctionDrafts) return correctionDrafts[page.id];
    return initialCorrectionValue(page.ocr);
  };

  const handleCorrectionChange = (pageId: string, value: string) => {
    setCorrectionDrafts((prev) => ({ ...prev, [pageId]: value }));
    // Editing again clears a stale "Saved" indicator or error from a prior attempt.
    setCorrectionSavedIds((prev) => (prev[pageId] ? { ...prev, [pageId]: false } : prev));
    setCorrectionErrors((prev) => (prev[pageId] ? { ...prev, [pageId]: null } : prev));
  };

  const handleSaveCorrection = async (pageId: string) => {
    if (!document) return;
    const page = pages.find((p) => p.id === pageId);
    if (!page) return;

    const value = getCorrectionValue(page);
    const { error: validationError } = validateCorrectionText(value);

    if (validationError) {
      setCorrectionErrors((prev) => ({ ...prev, [pageId]: validationError }));
      return;
    }

    setSavingCorrectionIds((prev) => ({ ...prev, [pageId]: true }));
    setCorrectionErrors((prev) => ({ ...prev, [pageId]: null }));
    try {
      const updatedOcr = await correctPageOcr(document.id, pageId, value);
      setPages((prev) =>
        prev.map((p) =>
          p.id === pageId && p.ocr
            ? { ...p, ocr: { ...p.ocr, correctedText: updatedOcr.correctedText } }
            : p
        )
      );
      setCorrectionDrafts((prev) => {
        const next = { ...prev };
        delete next[pageId];
        return next;
      });
      setCorrectionSavedIds((prev) => ({ ...prev, [pageId]: true }));
    } catch (error) {
      setCorrectionErrors((prev) => ({
        ...prev,
        [pageId]: error instanceof Error ? error.message : "Failed to save correction",
      }));
    } finally {
      setSavingCorrectionIds((prev) => ({ ...prev, [pageId]: false }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // The Upload box always targets the user's active intake document, not necessarily whatever
    // is currently shown in the main content area (see intakeDocument's declaration above). If
    // `document` already IS the intake document, it's the freshest copy -- handlers like
    // handleFinishDocument only update `document`, not the separate intakeDocument snapshot, so
    // checking intakeDocument.status directly here would go stale the moment the active intake
    // document finishes.
    const liveIntake =
      document && intakeDocument && document.id === intakeDocument.id ? document : intakeDocument;
    let targetDocument = liveIntake && liveIntake.status === "IN_PROGRESS" ? liveIntake : null;

    if (!targetDocument) {
      // No usable active intake document (none exists yet, or the previous one just finished) --
      // start a new one. Reuses the existing guest auto-create action (createTemporaryDocument),
      // just triggered here instead of only on mount. Signed-in accounts hit this only if the
      // render guard below is bypassed, which it isn't: the Upload box is disabled for them in
      // this state (see canOfferNewDocument/newDocumentUploadDisabled), since
      // createTemporaryDocument doesn't yet resolve an authenticated owner -- a known,
      // pre-existing gap this change doesn't attempt to fix.
      if (savedUserId) {
        e.target.value = "";
        return;
      }
      setIsCreating(true);
      try {
        const newDoc = await createTemporaryDocument(DEFAULT_DOCUMENT_TITLE);
        if (!newDoc) {
          e.target.value = "";
          return;
        }
        targetDocument = {
          id: newDoc.id,
          title: newDoc.title,
          status: newDoc.status as DocumentStatus,
          pageCount: 0,
          sections: [],
        };
        setIntakeDocument(targetDocument);
      } finally {
        setIsCreating(false);
      }
    }

    const targetId = targetDocument.id;
    const newPageCount = targetDocument.pageCount + files.length;
    if (newPageCount > 10) {
      alert(`Cannot upload ${files.length} page(s). Maximum is 10 pages per document. You can upload ${10 - targetDocument.pageCount} more page(s).`);
      e.target.value = "";
      return;
    }

    // Switch the main view to the intake document being uploaded to, so the new page is visible
    // immediately even if the user was browsing a different finished document via the sidenav.
    if (document?.id !== targetId) {
      router.push("/app/workspace");
      setDocument(targetDocument);
      setPages([]);
    }

    setIsUploading(true);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/documents/${targetId}/pages`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to upload page");
        }

        const data = await response.json();
        setPages((prev) => [...prev, { ...data.page, ocr: null }]);
        setDocument((prev) => (prev && prev.id === targetId ? { ...prev, pageCount: prev.pageCount + 1 } : prev));
        setIntakeDocument((prev) => (prev && prev.id === targetId ? { ...prev, pageCount: prev.pageCount + 1 } : prev));

        await runOcrForPage(targetId, data.page.id);
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

  const handleDeletePageClick = (pageId: string) => {
    setDeletePageModal({ isOpen: true, pageId, isDeleting: false, error: null });
  };

  const handleDeletePageCancel = () => {
    setDeletePageModal({ isOpen: false, pageId: null, isDeleting: false, error: null });
  };

  const handleDeletePageConfirm = async () => {
    if (!document || !deletePageModal.pageId) return;
    const pageId = deletePageModal.pageId;

    setDeletePageModal((prev) => ({ ...prev, isDeleting: true, error: null }));
    setActioningPageId(pageId);
    try {
      await deletePage(document.id, pageId);
      await refetchPages(document.id);
      setDocument((prev) => (prev ? { ...prev, pageCount: prev.pageCount - 1 } : null));
      setDeletePageModal({ isOpen: false, pageId: null, isDeleting: false, error: null });
    } catch (error) {
      setDeletePageModal((prev) => ({
        ...prev,
        isDeleting: false,
        error: error instanceof Error ? error.message : "Failed to delete page",
      }));
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
    initializeWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initializeWorkspace is stable per mount
  }, []);

  // Reacts to ?documentId= changing (sidenav navigation between finished documents, or back to
  // the plain /app/workspace URL) without requiring a full page reload. Runs after the initial
  // intake resolution above so a bad/foreign id can fall back to the intake document instead of
  // leaving the page blank.
  useEffect(() => {
    if (isLoading) return;
    if (viewedDocumentId) {
      loadViewedDocument(viewedDocumentId);
    } else if (intakeDocument && document?.id !== intakeDocument.id) {
      // Only refetches when actually switching back from a different viewed document -- the
      // initial load already put the intake document in place, so this avoids a redundant fetch.
      // Fetches fresh rather than trusting the intakeDocument snapshot, which can go stale (e.g.
      // it finished while the user was browsing a different document via the sidenav).
      loadViewedDocument(intakeDocument.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadViewedDocument/refetchPages are stable per render cycle; re-running on their identity would loop
  }, [viewedDocumentId, isLoading]);

  useEffect(() => {
    if (!expandedImagePage) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setExpandedImagePage(null);
    }
    window.document.addEventListener("keydown", handleKeyDown);
    return () => window.document.removeEventListener("keydown", handleKeyDown);
  }, [expandedImagePage]);

  useEffect(() => {
    if (!deletePageModal.isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleDeletePageCancel();
    }
    window.document.addEventListener("keydown", handleKeyDown);
    return () => window.document.removeEventListener("keydown", handleKeyDown);
  }, [deletePageModal.isOpen]);

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
  // Which tab of the finished-document organized view is showing: "Sections" (default, matches
  // today's behavior for the plain sidenav document link) or "Pages" (read-only page set, reached
  // via the sidenav overflow menu's "Review pages" action -- see components/layout/AppNav.tsx).
  // Derived straight from the URL, the same way ?documentId= itself already is, so switching tabs
  // is just a query-param update and there's no separate state to keep in sync on document change.
  const viewedPanel = searchParams.get("panel") === "pages" ? "pages" : "sections";
  function setViewedPanel(panel: "sections" | "pages") {
    router.push(buildWorkspacePanelUrl(searchParams.toString(), panel));
  }
  const acceptedPageCount = pages.filter((p) => p.status === "ACCEPTED").length;
  const canFinish = acceptedPageCount > 0 && document.status === "IN_PROGRESS";
  const isViewingIntake = document.id === intakeDocument?.id;
  // `document` is the freshest copy of the intake document whenever it's the one being viewed
  // (kept live by the handlers above); otherwise fall back to the separately-tracked snapshot.
  const effectiveIntake = isViewingIntake ? document : intakeDocument;
  const hasActiveIntakeRoom =
    !!effectiveIntake && effectiveIntake.status === "IN_PROGRESS" && effectiveIntake.pageCount < 10;
  // Once the active intake document is finished (or none exists yet), the Upload box switches
  // from "add a page" to "start a new document" instead of disappearing.
  const canOfferNewDocument = !hasActiveIntakeRoom && (!effectiveIntake || effectiveIntake.status !== "IN_PROGRESS");
  const showUploadBox = hasActiveIntakeRoom || canOfferNewDocument;
  // createTemporaryDocument doesn't yet resolve an authenticated owner (pre-existing, tracked
  // gap -- see .agent-memory/OPEN_QUESTIONS.md) so "start a new document" is guest-only for now.
  const newDocumentUploadDisabled = canOfferNewDocument && !hasActiveIntakeRoom && !!savedUserId;

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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
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
                    aria-label="Document title"
                  />
                </div>
              ) : (
                <div className="flex min-w-0 items-center gap-2 group">
                  <h1
                    className="min-w-0 truncate font-bold cursor-pointer transition-colors"
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

            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <div
                className="shrink-0 text-sm"
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
                    className="shrink-0 font-medium disabled:opacity-50"
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
                  <Link href="/app/save?mode=signin" className="shrink-0">
                    <Button variant="secondary" size="sm">Log in</Button>
                  </Link>
                  <Link href="/app/save" className="shrink-0">
                    <Button variant="confirm" size="sm">Save workspace</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoadingViewedDocument && (
          <p
            className="mb-4"
            style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-meta)' }}
          >
            Loading document…
          </p>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Document info and pages */}
          <div className="lg:col-span-2 space-y-6">
            {/* Upload section: adding pages to the active intake document, or -- once that
                document is finished (or none exists yet) -- starting a new one. Always visible
                so the user can keep working even while browsing a different, finished document
                below (see intakeDocument's declaration above). */}
            {showUploadBox && (
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
                  {hasActiveIntakeRoom ? "Upload Pages" : "Start a New Document"}
                </h2>
                <div className="flex items-center justify-center w-full">
                  <label
                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg ${newDocumentUploadDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                    style={{
                      borderColor: 'var(--color-border-default)',
                      backgroundColor: 'var(--color-background-subtle)',
                      borderRadius: 'var(--radius-md)'
                    }}
                    onMouseEnter={(e) => { if (!newDocumentUploadDisabled) e.currentTarget.style.backgroundColor = 'var(--color-border-subtle)'; }}
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
                        <span style={{ fontWeight: 'var(--font-weight-h3)' }}>Click to upload</span>
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
                      {...PAGE_IMAGE_FILE_INPUT_PROPS}
                      multiple
                      onChange={handleFileUpload}
                      disabled={isUploading || newDocumentUploadDisabled}
                    />
                  </label>
                </div>
                {newDocumentUploadDisabled && (
                  <p
                    className="mt-2 text-center"
                    style={{ fontSize: 'var(--font-size-caption)', color: 'var(--color-text-meta)' }}
                  >
                    Starting a new document isn&apos;t available for signed-in accounts yet.
                  </p>
                )}
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

            {/* Pages list -- once the document is finished, this whole review area is replaced
                by the organized Sections view below, since page-by-page review is no longer the
                point of the page for a document that's already been organized. */}
            {document.status === "IN_PROGRESS" && (
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
              {pages.length > 0 && document.status === "IN_PROGRESS" && (
                <Alert tone="warning" radius="md" padding="sm" className="mb-4">
                  <p
                    style={{
                      fontSize: 'var(--font-size-caption)',
                      color: 'var(--color-accent-warning)'
                    }}
                  >
                    You are responsible for reviewing each page before accepting it. Conditions
                    Translator assists with transcription but does not verify legal accuracy —
                    correct any mistakes so the text matches your document.
                  </p>
                </Alert>
              )}
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
                    const isSavingCorrection = !!savingCorrectionIds[page.id];
                    const blocked = hasBlockingQuality(
                      page.ocr?.warnings ?? null,
                      page.ocr?.extractedText ?? null
                    );
                    const canAccept =
                      page.status === "OCR_COMPLETE" &&
                      !blocked &&
                      !isActioning &&
                      !isSavingCorrection;
                    const canReupload =
                      page.status !== "ACCEPTED" && !isActioning && !isSavingCorrection;
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
                                  <span className="text-xs bg-(--color-accent-warning-bg) text-(--color-accent-warning) px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>📷</span> Blurry
                                  </span>
                                )}
                                {page.ocr.warnings.cutOff && (
                                  <span className="text-xs bg-(--color-accent-warning-bg) text-(--color-accent-warning) px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>✂️</span> Cut off
                                  </span>
                                )}
                                {page.ocr.warnings.sideways && (
                                  <span className="text-xs bg-(--color-accent-warning-bg) text-(--color-accent-warning) px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>🔄</span> Sideways
                                  </span>
                                )}
                                {page.ocr.warnings.incomplete && (
                                  <span className="text-xs bg-(--color-accent-warning-bg) text-(--color-accent-warning) px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>📄</span> Incomplete
                                  </span>
                                )}
                                {page.ocr.warnings.unreadable && (
                                  <span className="text-xs bg-(--color-accent-warning-bg) text-(--color-accent-warning) px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <span>❓</span> Unreadable
                                  </span>
                                )}
                              </div>
                            )}

                            {page.status === "OCR_FAILED" && page.ocrFailureReason && (
                              <div className="mt-2">
                                <p className="text-sm text-(--color-accent-destructive) font-medium">
                                  {page.ocrFailureReason}
                                </p>
                                <p className="text-xs text-(--color-text-meta) mt-1">
                                  Please try re-uploading the image with better quality.
                                </p>
                              </div>
                            )}

                            {blocked && page.ocr?.warnings?.retakeGuidance && (
                              <p className="text-sm text-(--color-accent-destructive) mt-2 font-medium">
                                {page.ocr.warnings.retakeGuidance}
                              </p>
                            )}

                            {page.status === "OCR_COMPLETE" && page.ocr && (
                              <PageCorrectionField
                                page={page}
                                value={getCorrectionValue(page)}
                                onChange={(value) => handleCorrectionChange(page.id, value)}
                                onSave={() => handleSaveCorrection(page.id)}
                                isSaving={isSavingCorrection}
                                disabled={isActioning || isOcrRunning}
                                error={correctionErrors[page.id] ?? null}
                                saved={!!correctionSavedIds[page.id]}
                              />
                            )}

                            {page.status === "ACCEPTED" && page.ocr && (
                              <p className="text-xs text-(--color-text-meta) mt-1 line-clamp-3">
                                {page.ocr.correctedText ?? page.ocr.extractedText}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            onClick={() => handleAcceptPage(page.id)}
                            disabled={!canAccept}
                            variant="primary"
                            size="sm"
                            className="min-h-11 sm:min-h-0"
                          >
                            Accept
                          </Button>

                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={!canReupload}
                            className="min-h-11 sm:min-h-0"
                            onClick={() => reuploadInputRefs.current[page.id]?.click()}
                          >
                            Re-upload
                          </Button>
                          <input
                            type="file"
                            ref={(el) => {
                              reuploadInputRefs.current[page.id] = el;
                            }}
                            className="hidden"
                            // Same camera-first hint as the initial upload input, and for the same
                            // reason: re-upload's purpose is retaking a photo of the physical page
                            // (see the retake-guidance copy shown on a blocked page), not browsing
                            // an existing gallery image.
                            {...PAGE_IMAGE_FILE_INPUT_PROPS}
                            disabled={!canReupload}
                            aria-hidden="true"
                            tabIndex={-1}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleReuploadPage(page.id, file);
                              e.target.value = "";
                            }}
                          />

                          <Button
                            onClick={() => handleDeletePageClick(page.id)}
                            disabled={!canDelete}
                            variant="danger"
                            size="sm"
                            className="min-h-11 sm:min-h-0"
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
            )}

            {/* Organized document view: replaces the Pages review area once the document is
                finished, matching how the document reads after Finish Document -- browsing/
                reading, not page-by-page review. */}
            {document.status !== "IN_PROGRESS" && (
              <Card variant="panel">
                <div className="flex items-center justify-between mb-4" style={{ marginBottom: 'var(--spacing-4)' }}>
                  <h2
                    style={{
                      fontSize: 'var(--font-size-h3)',
                      fontWeight: 'var(--font-weight-h3)',
                      color: 'var(--color-text-heading)',
                    }}
                  >
                    {viewedPanel === "pages" ? "Pages" : "Sections"}
                  </h2>
                  <div
                    role="tablist"
                    aria-label="Document view"
                    className="inline-flex rounded-md border border-(--color-border-card) p-0.5"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewedPanel === "sections"}
                      onClick={() => setViewedPanel("sections")}
                      className={`min-h-11 sm:min-h-0 rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm font-medium transition-colors ${
                        viewedPanel === "sections"
                          ? "bg-(--color-background-subtle) text-(--color-text-heading)"
                          : "text-(--color-text-meta) hover:text-(--color-text-body)"
                      }`}
                    >
                      Sections
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={viewedPanel === "pages"}
                      onClick={() => setViewedPanel("pages")}
                      className={`min-h-11 sm:min-h-0 rounded-[calc(var(--radius-md)-2px)] px-3 py-1.5 text-sm font-medium transition-colors ${
                        viewedPanel === "pages"
                          ? "bg-(--color-background-subtle) text-(--color-text-heading)"
                          : "text-(--color-text-meta) hover:text-(--color-text-body)"
                      }`}
                    >
                      Pages
                    </button>
                  </div>
                </div>
                {viewedPanel === "pages" ? (
                  pages.length === 0 ? (
                    <p
                      className="text-center py-8"
                      style={{
                        fontSize: 'var(--font-size-body)',
                        color: 'var(--color-text-meta)',
                        textAlign: 'center',
                        padding: 'var(--spacing-8) 0'
                      }}
                    >
                      This document has no pages.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {pages.map((page) => (
                        <div
                          key={page.id}
                          className="flex items-start gap-3"
                          style={{
                            border: `1px solid var(--color-border-card)`,
                            borderRadius: 'var(--radius-md)',
                            padding: 'var(--spacing-4)'
                          }}
                        >
                          <button
                            onClick={() => setExpandedImagePage(page)}
                            className="shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring) rounded"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- Dynamic authenticated API route with private Blob storage */}
                            <img
                              src={`/api/documents/${document.id}/pages/${page.id}/image`}
                              alt={`Page ${page.order + 1} (click to enlarge)`}
                              style={{
                                width: '5rem',
                                height: '6.67rem',
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
                            <div className="flex items-center justify-between gap-2">
                              <span style={{ fontSize: 'var(--font-size-body)', fontWeight: 'var(--font-weight-h3)', color: 'var(--color-text-heading)' }}>
                                Page {page.order + 1}
                              </span>
                              <Badge variant={page.status === "ACCEPTED" ? "success" : "neutral"} size="sm">
                                {statusLabel(page)}
                              </Badge>
                            </div>
                            {page.ocr && (
                              <p className="text-xs text-(--color-text-meta) mt-1 line-clamp-3">
                                {page.ocr.correctedText ?? page.ocr.extractedText}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : isReady && document.sections.length > 0 ? (
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
                ) : (
                  <p
                    className="text-center py-8"
                    style={{
                      fontSize: 'var(--font-size-body)',
                      color: 'var(--color-text-meta)',
                      textAlign: 'center',
                      padding: 'var(--spacing-8) 0'
                    }}
                  >
                    {isReady
                      ? "No sections were generated for this document."
                      : isProcessingFailed
                      ? "Organizing this document failed. Use Retry to try again."
                      : "Your document is still being organized. Sections will appear here shortly."}
                  </p>
                )}
              </Card>
            )}
          </div>

          {/* Right column - Actions */}
          <div className="space-y-6">
            {/* Naming nudge: shown once pages exist but the document still has its default
                title, so the user is prompted to name it before finishing. */}
            {pages.length > 0 &&
              document.status === "IN_PROGRESS" &&
              isDefaultDocumentTitle(document.title) && (
                <Alert tone="warning" radius="lg" padding="md">
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
                </Alert>
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
              <Alert tone="processing" padding="lg" className="text-center">
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
              </Alert>
            )}

            {isProcessingFailed && (
              <Alert tone="destructive" padding="lg">
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
              </Alert>
            )}

            {isReady && (
              <Alert tone="success" padding="lg">
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
              </Alert>
            )}

          </div>
        </div>
      </main>

      {/* Delete page confirmation modal (mirrors the dashboard's delete-document modal pattern) */}
      {deletePageModal.isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleDeletePageCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-page-modal-title"
        >
          <div
            ref={deletePageModalRef}
            className="bg-(--color-background-card) rounded-lg shadow-xl max-w-md w-full p-6 border border-(--color-border-card)"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2
                id="delete-page-modal-title"
                className="font-(--font-weight-h2) mb-2"
                style={{ fontSize: 'var(--font-size-h2)', color: 'var(--color-text-heading)' }}
              >
                Delete this page?
              </h2>
              <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}>
                This cannot be undone.
              </p>
              {deletePageModal.error && (
                <p className="text-(--color-accent-destructive) text-sm mt-2">{deletePageModal.error}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleDeletePageCancel}
                disabled={deletePageModal.isDeleting}
                variant="secondary"
                size="md"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeletePageConfirm}
                disabled={deletePageModal.isDeleting}
                variant="danger"
                size="md"
                isLoading={deletePageModal.isDeleting}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Expanded image modal */}
      {expandedImagePage && document && (
        <div
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
          onClick={() => setExpandedImagePage(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Page ${expandedImagePage.order + 1} enlarged`}
        >
          <div ref={expandedImageModalRef} className="relative max-w-4xl max-h-[90vh]">
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

// Compact transcript preview (for an OCR_COMPLETE page) that opens a full-size <dialog> for
// editing (docs/03_OCR_Specifications.md §5, docs/OCR_Master_Implementation_Plan.md §7-8). Save
// is a distinct action from Accept: saving only writes OcrResult.correctedText and never changes
// page/document status or the image. Kept as a single component (preview trigger + dialog)
// rather than splitting further -- both halves share the same page/value/error/saved state and
// there's only ever one caller.
function PageCorrectionField({
  page,
  value,
  onChange,
  onSave,
  isSaving,
  disabled,
  error,
  saved,
}: {
  page: Page;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  // True while a different action (Accept/Re-upload/Delete, or a running OCR call) is in
  // flight for this page, so Save can't race with it.
  disabled: boolean;
  error: string | null;
  saved: boolean;
}) {
  const { trimmed, error: validationError } = validateCorrectionText(value);
  const trimmedLength = trimmed.length;
  const overLimit = trimmedLength > OCR_MAX_CORRECTION_CHARACTERS;
  const isInvalid = !!error || !!validationError;
  const fieldId = `correction-${page.id}`;
  const errorId = `${fieldId}-error`;
  const dialogId = `correction-dialog-${page.id}`;
  const titleId = `${dialogId}-title`;
  const fieldDisabled = disabled || isSaving;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openModal() {
    dialogRef.current?.showModal();
    window.document.documentElement.classList.add("overflow-hidden");
  }

  function closeModal() {
    dialogRef.current?.close();
    window.document.documentElement.classList.remove("overflow-hidden");
    triggerRef.current?.focus();
  }

  // The native "cancel" event fires on Escape (and only then, for a <dialog> opened via
  // showModal()) -- prevented so closeModal can also unlock scroll and return focus, instead of
  // just letting the dialog's own default close happen.
  useEffect(() => {
    const dialogEl = dialogRef.current;
    if (!dialogEl) return;
    function handleCancel(e: Event) {
      e.preventDefault();
      closeModal();
    }
    dialogEl.addEventListener("cancel", handleCancel);
    return () => dialogEl.removeEventListener("cancel", handleCancel);
  }, []);

  return (
    <div className="mt-2">
      <button
        ref={triggerRef}
        type="button"
        onClick={openModal}
        className="block w-full rounded-md border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-(--color-border-focus-ring)"
        style={{ borderColor: "var(--color-border-card)", backgroundColor: "var(--color-surface-input)" }}
        aria-haspopup="dialog"
        aria-controls={dialogId}
      >
        <span className="mb-1 flex items-center justify-between gap-2">
          <span style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}>
            Proposed transcription
          </span>
          {saved && !isSaving && (
            <Badge variant="success" size="sm">
              Saved
            </Badge>
          )}
        </span>
        <span
          className="block max-h-16 overflow-hidden whitespace-pre-wrap font-mono text-xs leading-5"
          style={{ color: "var(--color-text-body)" }}
        >
          {value || "No text extracted — tap to review"}
        </span>
        <span
          className="mt-2 inline-flex text-xs font-medium"
          style={{ color: "var(--color-accent-processing)" }}
        >
          View / edit full transcript
        </span>
        {error && (
          <span
            role="alert"
            className="mt-1 block"
            style={{ fontSize: "var(--font-size-caption)", color: "var(--color-accent-destructive)" }}
          >
            {error}
          </span>
        )}
      </button>

      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-labelledby={titleId}
        className="m-auto w-[calc(100vw-2rem)] max-w-none rounded-xl border-0 p-0 shadow-lg backdrop:bg-black/50 sm:w-full sm:max-w-lg md:max-w-2xl lg:max-w-3xl"
      >
        <div
          className="flex max-h-[95vh] flex-col rounded-xl sm:max-h-[85vh]"
          style={{ backgroundColor: "var(--color-background-card)" }}
        >
          <div
            className="flex items-start justify-between gap-4 border-b p-4 sm:p-6"
            style={{ borderColor: "var(--color-border-divider)" }}
          >
            <div className="min-w-0">
              <h2
                id={titleId}
                className="font-(--font-weight-h3)"
                style={{ fontSize: "var(--font-size-h3)", color: "var(--color-text-heading)" }}
              >
                Page {page.order + 1} transcript
              </h2>
              <p
                className="mt-1"
                style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}
              >
                Review and edit the proposed transcription. Saving does not accept the page.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeModal}
              aria-label="Close transcript dialog"
              className="shrink-0"
            >
              Close
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <label
              htmlFor={fieldId}
              className="mb-1 block"
              style={{ fontSize: "var(--font-size-caption)", color: "var(--color-text-meta)" }}
            >
              Proposed transcription
            </label>
            <Textarea
              id={fieldId}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              disabled={fieldDisabled}
              invalid={isInvalid}
              aria-describedby={error ? errorId : undefined}
              className="min-h-40 w-full font-mono text-xs sm:min-h-56 sm:text-sm md:min-h-64"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span
                style={{
                  fontSize: "var(--font-size-caption)",
                  color: overLimit ? "var(--color-accent-destructive)" : "var(--color-text-meta)",
                }}
              >
                {trimmedLength}/{OCR_MAX_CORRECTION_CHARACTERS}
              </span>
              <span role="status">
                {saved && !isSaving && (
                  <Badge variant="success" size="sm">
                    Saved
                  </Badge>
                )}
              </span>
            </div>
            {error && (
              <p
                id={errorId}
                role="alert"
                className="mt-2"
                style={{ fontSize: "var(--font-size-caption)", color: "var(--color-accent-destructive)" }}
              >
                {error}
              </p>
            )}
          </div>

          <div
            className="flex justify-end gap-3 border-t p-4 sm:p-6"
            style={{ borderColor: "var(--color-border-divider)" }}
          >
            <Button
              type="button"
              variant="secondary"
              onClick={onSave}
              disabled={fieldDisabled || !!validationError}
              isLoading={isSaving}
            >
              Save correction
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
