// Dashboard UI for saved documents.
//
// Shows all documents for the current owner (user or temporary session) with:
// - document cards displaying title, status, page count, and created date
// - loading, empty, and error states
// - delete confirmation modal wired to DELETE /api/documents/[documentId]
// - navigation to view sections or start chat for READY documents
//
// "View sections" (document detail view) remains a stub — out of scope for the Phase 8
// backend pass, which covers deletion + owner-aware reads only.

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type DocumentStatus =
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PROCESSING"
  | "READY"
  | "PROCESSING_FAILED";

interface Document {
  id: string;
  title: string;
  status: DocumentStatus;
  createdAt: string;
  _count: {
    pages: number;
  };
  sections: Array<{
    id: string;
    heading: string;
    body: string;
    order: number;
  }>;
}

interface DashboardState {
  documents: Document[];
  isLoading: boolean;
  error: string | null;
}

interface SectionsModalState {
  isOpen: boolean;
  document: Document | null;
  sections: Array<{
    id: string;
    heading: string;
    body: string;
    order: number;
    sources: Array<{ pageId: string }>;
  }> | null;
  isLoading: boolean;
  error: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({
    documents: [],
    isLoading: true,
    error: null,
  });
  // Set once the dashboard is viewed by a signed-in account (Phase 7). null while temporary.
  const [savedUserId, setSavedUserId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    document: Document | null;
    isDeleting: boolean;
    error: string | null;
  }>({ isOpen: false, document: null, isDeleting: false, error: null });
  
  const [sectionsModal, setSectionsModal] = useState<SectionsModalState>({
    isOpen: false,
    document: null,
    sections: null,
    isLoading: false,
    error: null,
  });

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch("/api/documents");
      if (!response.ok) {
        throw new Error("Failed to load documents");
      }
      const data = await response.json();
      return { documents: data.documents || [], error: null };
    } catch (error) {
      return { 
        documents: [], 
        error: error instanceof Error ? error.message : "Failed to load documents" 
      };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadDocuments = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      const result = await fetchDocuments();
      
      if (isMounted) {
        setState({
          documents: result.documents,
          isLoading: false,
          error: result.error,
        });
      }
    };

    loadDocuments();

    return () => {
      isMounted = false;
    };
  }, [fetchDocuments]);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/session/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((status) => {
        if (isMounted && status) {
          setSavedUserId(status.userId ?? null);
        }
      })
      .catch(() => {
        // Non-fatal: the sign-out button simply won't show if this fails.
      });

    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleDeleteClick = (document: Document) => {
    setDeleteModal({ isOpen: true, document, isDeleting: false, error: null });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.document) return;
    const documentId = deleteModal.document.id;

    setDeleteModal((prev) => ({ ...prev, isDeleting: true, error: null }));

    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete document");
      }

      // The document is already inaccessible server-side (deletionState left ACTIVE) the
      // moment this request succeeds, regardless of whether storage cleanup fully finished —
      // so it disappears from the list immediately either way.
      setState((prev) => ({
        ...prev,
        documents: prev.documents.filter((d) => d.id !== documentId),
      }));
      setDeleteModal({ isOpen: false, document: null, isDeleting: false, error: null });
    } catch (error) {
      setDeleteModal((prev) => ({
        ...prev,
        isDeleting: false,
        error: error instanceof Error ? error.message : "Failed to delete document",
      }));
    }
  };

  const handleDeleteCancel = () => {
    setDeleteModal({ isOpen: false, document: null, isDeleting: false, error: null });
  };

  const handleViewSections = async (document: Document) => {
    setSectionsModal({
      isOpen: true,
      document,
      sections: null,
      isLoading: true,
      error: null,
    });

    try {
      const response = await fetch(`/api/documents/${document.id}`);
      if (!response.ok) {
        throw new Error("Failed to load document sections");
      }
      const data = await response.json();
      
      setSectionsModal((prev) => ({
        ...prev,
        sections: data.document?.sections || [],
        isLoading: false,
      }));
    } catch (error) {
      setSectionsModal((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load sections",
      }));
    }
  };

  const handleCloseSectionsModal = () => {
    setSectionsModal({
      isOpen: false,
      document: null,
      sections: null,
      isLoading: false,
      error: null,
    });
  };

  // Simple duplicate detection: case-insensitive equality with whitespace normalization
  const normalizeTitle = (title: string): string => {
    return title.trim().toLowerCase().replace(/\s+/g, " ");
  };

  const hasDuplicateTitle = (document: Document, documents: Document[]): boolean => {
    const normalizedTitle = normalizeTitle(document.title);
    return documents.some(
      (doc) => doc.id !== document.id && normalizeTitle(doc.title) === normalizedTitle
    );
  };

  const documentStatusLabel = (status: DocumentStatus): string => {
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
  };

  const getStatusBadgeVariant = (status: DocumentStatus): "success" | "warning" | "destructive" | "processing" | "neutral" => {
    switch (status) {
      case "READY":
        return "success";
      case "PROCESSING_FAILED":
        return "destructive";
      case "COMPLETED":
      case "PROCESSING":
        return "processing";
      case "IN_PROGRESS":
        return "warning";
      default:
        return "neutral";
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Loading skeleton
  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-(--color-background-page) p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="font-(--font-weight-h1) mb-2" style={{ fontSize: 'var(--font-size-h1)', color: 'var(--color-text-heading)' }}>
              My Documents
            </h1>
            <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}>Loading your documents...</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="space-y-4">
                <div className="h-6 bg-(--color-background-subtle) rounded animate-pulse"></div>
                <div className="h-4 bg-(--color-background-subtle) rounded w-2/3 animate-pulse"></div>
                <div className="h-4 bg-(--color-background-subtle) rounded w-1/2 animate-pulse"></div>
                <div className="space-y-2 pt-4">
                  <div className="h-8 bg-(--color-background-subtle) rounded animate-pulse"></div>
                  <div className="h-8 bg-(--color-background-subtle) rounded animate-pulse"></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="min-h-screen bg-(--color-background-page) flex items-center justify-center p-4">
        <Card padding="lg" className="text-center max-w-md">
          <div className="text-(--color-accent-destructive) text-5xl mb-4">⚠️</div>
          <h2 className="font-(--font-weight-h2) mb-2" style={{ fontSize: 'var(--font-size-h2)', color: 'var(--color-text-heading)' }}>
            Unable to load documents
          </h2>
          <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }} className="mb-6">{state.error}</p>
          <Button onClick={fetchDocuments} variant="primary" size="md">
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  // Empty state
  if (state.documents.length === 0) {
    return (
      <div className="min-h-screen bg-(--color-background-page) flex items-center justify-center p-4">
        <Card padding="lg" className="text-center max-w-md">
          <div className="text-(--color-text-meta) text-6xl mb-4">📄</div>
          <h2 className="font-(--font-weight-h2) mb-2" style={{ fontSize: 'var(--font-size-h2)', color: 'var(--color-text-heading)' }}>
            No documents yet
          </h2>
            <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }} className="mb-6">
              Upload your first supervision document to get started with AI-powered
              explanations.
            </p>
          <Link href="/app/workspace" className="inline-block">
            <Button variant="primary" size="md">
              Create new document
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Main dashboard with documents
  return (
    <div className="min-h-screen bg-(--color-background-page) p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h1 className="font-(--font-weight-h1) mb-2" style={{ fontSize: 'var(--font-size-h1)', color: 'var(--color-text-heading)' }}>
              My Documents
            </h1>
            <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}>
              {state.documents.length} document{state.documents.length !== 1 ? "s" : ""}
            </p>
          </div>
          {savedUserId && (
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="text-sm font-medium text-(--color-text-body) hover:text-(--color-text-heading) disabled:opacity-50 self-start sm:self-auto"
            >
              {isSigningOut ? "Signing out..." : "Sign out"}
            </button>
          )}
        </div>

        {/* Document grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.documents.map((document) => {
            const isReady = document.status === "READY";
            const hasSections = document.sections.length > 0;
            const isDuplicate = hasDuplicateTitle(document, state.documents);

            return (
              <Card
                key={document.id}
                hover
                className="flex flex-col"
              >
                {/* Document header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3
                      className="font-(--font-weight-h3) truncate"
                      title={document.title}
                      style={{ fontSize: 'var(--font-size-h3)', color: 'var(--color-text-heading)' }}
                    >
                      {document.title}
                    </h3>
                    <p className="text-sm text-(--color-text-meta) mt-1">
                      {document._count.pages} page{document._count.pages !== 1 ? "s" : ""}
                    </p>
                    {isDuplicate && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-(--color-accent-warning-bg) text-(--color-accent-warning) rounded text-xs font-medium">
                        <span aria-hidden="true">⚠️</span>
                        <span>Similar document name</span>
                      </div>
                    )}
                  </div>
                  <Badge variant={getStatusBadgeVariant(document.status)} size="sm">
                    {documentStatusLabel(document.status)}
                  </Badge>
                </div>

                {/* Document metadata */}
                <div className="text-sm text-(--color-text-meta) mb-4">
                  Created {formatDate(document.createdAt)}
                </div>

                {/* Document info */}
                {hasSections && (
                  <div className="text-sm text-(--color-text-body) mb-4">
                    {document.sections.length} section{document.sections.length !== 1 ? "s" : ""}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-auto space-y-2">
                  {isReady && (
                    <>
                      <Link
                        href={`/app/chat`}
                        className="block"
                      >
                        <Button variant="primary" size="md" fullWidth>
                          Start chat
                        </Button>
                      </Link>
                      {hasSections && (
                        <Button
                          onClick={() => handleViewSections(document)}
                          variant="secondary"
                          size="md"
                          fullWidth
                        >
                          View sections
                        </Button>
                      )}
                    </>
                  )}

                  {/* Delete button - always available */}
                  <Button
                    onClick={() => handleDeleteClick(document)}
                    variant="ghost"
                    size="md"
                    fullWidth
                    className="text-(--color-accent-destructive) hover:bg-(--color-accent-destructive-bg) hover:text-(--color-accent-destructive)"
                    aria-label={`Delete ${document.title}`}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteModal.isOpen && deleteModal.document && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleDeleteCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div
            className="bg-(--color-background-card) rounded-lg shadow-xl max-w-md w-full p-6 border border-(--color-border-card)"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2
                id="delete-modal-title"
                className="font-(--font-weight-h2) mb-2"
                style={{ fontSize: 'var(--font-size-h2)', color: 'var(--color-text-heading)' }}
              >
                Delete document?
              </h2>
              <p style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-text-body)' }}>
                This will permanently delete{" "}
                <span className="font-medium">{deleteModal.document.title}</span> and all
                its pages. This action cannot be undone.
              </p>
              {deleteModal.error && (
                <p className="text-(--color-accent-destructive) text-sm mt-2">{deleteModal.error}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                onClick={handleDeleteCancel}
                disabled={deleteModal.isDeleting}
                variant="secondary"
                size="md"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirm}
                disabled={deleteModal.isDeleting}
                variant="danger"
                size="md"
                isLoading={deleteModal.isDeleting}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Sections view modal */}
      {sectionsModal.isOpen && sectionsModal.document && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseSectionsModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sections-modal-title"
        >
          <div
            className="bg-(--color-background-card) rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-(--color-border-card)"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="p-6 border-b border-(--color-border-divider)">
              <div className="flex items-center justify-between mb-4">
                <h2
                  id="sections-modal-title"
                  className="font-(--font-weight-h2)"
                  style={{ fontSize: 'var(--font-size-h2)', color: 'var(--color-text-heading)' }}
                >
                  {sectionsModal.document.title}
                </h2>
                <button
                  onClick={handleCloseSectionsModal}
                  className="text-(--color-text-meta) hover:text-(--color-text-heading) focus:outline-none focus:ring-2 focus:ring-(--color-border-focus-ring) rounded p-1"
                  aria-label="Close"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal body */}
            <div className="p-6 overflow-y-auto flex-1">
              {sectionsModal.isLoading ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-(--color-accent-processing)"></div>
                  <p className="mt-4 text-(--color-text-body)">Loading sections...</p>
                </div>
              ) : sectionsModal.error ? (
                <div className="text-center py-8">
                  <div className="text-(--color-accent-destructive) text-5xl mb-4">⚠️</div>
                  <p className="text-(--color-text-body)">{sectionsModal.error}</p>
                  <Button
                    onClick={() => handleViewSections(sectionsModal.document!)}
                    variant="primary"
                    size="sm"
                    className="mt-4"
                  >
                    Try again
                  </Button>
                </div>
              ) : !sectionsModal.sections || sectionsModal.sections.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-(--color-text-meta) text-6xl mb-4">📄</div>
                  <p className="text-(--color-text-body)">No sections available for this document</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sectionsModal.sections.map((section) => (
                    <div key={section.id} className="border-b border-(--color-border-divider) pb-6 last:border-0">
                      <h3 className="font-(--font-weight-h3) mb-2" style={{ fontSize: 'var(--font-size-h3)', color: 'var(--color-text-heading)' }}>
                        {section.order + 1}. {section.heading}
                      </h3>
                      <p className="text-(--color-text-body) whitespace-pre-wrap leading-relaxed">
                        {section.body}
                      </p>
                      {section.sources && section.sources.length > 0 && (
                        <div className="mt-3 text-sm text-(--color-text-meta)">
                          <span className="font-medium">Source pages:</span>{" "}
                          {section.sources.map((source, idx) => (
                            <span key={source.pageId}>
                              {idx > 0 && ", "}
                              {source.pageId}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="p-6 border-t border-(--color-border-divider) flex justify-end">
              <Button
                onClick={handleCloseSectionsModal}
                variant="secondary"
                size="md"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}