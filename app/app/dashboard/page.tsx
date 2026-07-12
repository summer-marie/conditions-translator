// Dashboard UI for saved documents.
//
// Shows all documents for the current owner (user or temporary session) with:
// - document cards displaying title, status, page count, and created date
// - loading, empty, and error states
// - delete confirmation modal (stub - backend implementation pending)
// - navigation to view sections or start chat for READY documents
//
// This is a UI-only implementation. Real deletion logic and Blob cleanup
// will be implemented in the Phase 8 backend pass.

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<DashboardState>({
    documents: [],
    isLoading: true,
    error: null,
  });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    document: Document | null;
  }>({ isOpen: false, document: null });

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

  const handleDeleteClick = (document: Document) => {
    setDeleteModal({ isOpen: true, document });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteModal.document) return;

    // TODO: Phase 8 backend pass - wire to real deletion API route
    // This is a UI-only stub. The real implementation will:
    // 1. Call deletion endpoint that sets deletionState to DELETE_PENDING
    // 2. Remove document from local state immediately
    // 3. Backend will handle database children and Blob cleanup
    console.log("Delete requested for document:", deleteModal.document.id);
    
    // For now, just close the modal and show a message
    setDeleteModal({ isOpen: false, document: null });
    alert("Deletion will be implemented in the Phase 8 backend pass");
  };

  const handleDeleteCancel = () => {
    setDeleteModal({ isOpen: false, document: null });
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
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">My Documents</h1>
          <p className="text-gray-600">
            {state.documents.length} document{state.documents.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Document grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.documents.map((document) => {
            const isReady = document.status === "READY";
            const hasSections = document.sections.length > 0;

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
                          onClick={() => {
                            // TODO: Phase 8 backend pass - wire to document detail view
                            // This would navigate to a page showing all sections with source page references
                            alert("Document detail view will be implemented in the Phase 8 backend pass");
                          }}
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
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}