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

  const getStatusBadgeColor = (status: DocumentStatus): string => {
    switch (status) {
      case "READY":
        return "bg-green-100 text-green-800";
      case "PROCESSING_FAILED":
        return "bg-red-100 text-red-800";
      case "COMPLETED":
      case "PROCESSING":
        return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
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
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Documents</h1>
            <p className="text-gray-600">Loading your documents...</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 space-y-4">
                <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                <div className="space-y-2 pt-4">
                  <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (state.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Unable to load documents
          </h2>
          <p className="text-gray-600 mb-6">{state.error}</p>
          <button
            onClick={fetchDocuments}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (state.documents.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-gray-400 text-6xl mb-4">📄</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            No documents yet
          </h2>
          <p className="text-gray-600 mb-6">
            Upload your first supervision document to get started with AI-powered
            explanations.
          </p>
          <Link
            href="/app/workspace"
            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Create new document
          </Link>
        </div>
      </div>
    );
  }

  // Main dashboard with documents
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">My Documents</h1>
            <p className="text-gray-600">
              {state.documents.length} document{state.documents.length !== 1 ? "s" : ""}
            </p>
          </div>
          {savedUserId && (
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
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
              <div
                key={document.id}
                className="bg-white rounded-lg shadow p-6 flex flex-col"
              >
                {/* Document header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3
                      className="text-lg font-semibold text-gray-900 truncate"
                      title={document.title}
                    >
                      {document.title}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {document._count.pages} page{document._count.pages !== 1 ? "s" : ""}
                    </p>
                    {isDuplicate && (
                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-800 rounded text-xs font-medium">
                        <span aria-hidden="true">⚠️</span>
                        <span>Similar document name</span>
                      </div>
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${getStatusBadgeColor(
                    document.status
                  )}`}
                  >
                    {documentStatusLabel(document.status)}
                  </span>
                </div>

                {/* Document metadata */}
                <div className="text-sm text-gray-500 mb-4">
                  Created {formatDate(document.createdAt)}
                </div>

                {/* Document info */}
                {hasSections && (
                  <div className="text-sm text-gray-600 mb-4">
                    {document.sections.length} section{document.sections.length !== 1 ? "s" : ""}
                  </div>
                )}

                {/* Action buttons */}
                <div className="mt-auto space-y-2">
                  {isReady && (
                    <>
                      <Link
                        href={`/app/chat`}
                        className="block w-full text-center bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                      >
                        Start chat
                      </Link>
                      {hasSections && (
                        <button
                          onClick={() => handleViewSections(document)}
                          className="block w-full text-center bg-gray-100 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-200 transition-colors"
                        >
                          View sections
                        </button>
                      )}
                    </>
                  )}

                  {/* Delete button - always available */}
                  <button
                    onClick={() => handleDeleteClick(document)}
                    className="block w-full text-center bg-red-50 text-red-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
                    aria-label={`Delete ${document.title}`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteModal.isOpen && deleteModal.document && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleDeleteCancel}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2
                id="delete-modal-title"
                className="text-xl font-semibold text-gray-900 mb-2"
              >
                Delete document?
              </h2>
              <p className="text-gray-600">
                This will permanently delete{" "}
                <span className="font-medium">{deleteModal.document.title}</span> and all
                its pages. This action cannot be undone.
              </p>
              {deleteModal.error && (
                <p className="text-red-600 text-sm mt-2">{deleteModal.error}</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                disabled={deleteModal.isDeleting}
                className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteModal.isDeleting}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteModal.isDeleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sections view modal */}
      {sectionsModal.isOpen && sectionsModal.document && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleCloseSectionsModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="sections-modal-title"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2
                  id="sections-modal-title"
                  className="text-xl font-semibold text-gray-900"
                >
                  {sectionsModal.document.title}
                </h2>
                <button
                  onClick={handleCloseSectionsModal}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
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
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600">Loading sections...</p>
                </div>
              ) : sectionsModal.error ? (
                <div className="text-center py-8">
                  <div className="text-red-600 text-5xl mb-4">⚠️</div>
                  <p className="text-gray-600">{sectionsModal.error}</p>
                  <button
                    onClick={() => handleViewSections(sectionsModal.document!)}
                    className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    Try again
                  </button>
                </div>
              ) : !sectionsModal.sections || sectionsModal.sections.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-6xl mb-4">📄</div>
                  <p className="text-gray-600">No sections available for this document</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sectionsModal.sections.map((section) => (
                    <div key={section.id} className="border-b border-gray-200 pb-6 last:border-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {section.order + 1}. {section.heading}
                      </h3>
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {section.body}
                      </p>
                      {section.sources && section.sources.length > 0 && (
                        <div className="mt-3 text-sm text-gray-500">
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
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={handleCloseSectionsModal}
                className="px-6 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}