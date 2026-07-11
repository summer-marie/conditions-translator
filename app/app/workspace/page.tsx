// Workspace UI shell for temporary document intake.
//
// Shows: document title (editable inline), page list, upload button, Finish Document button.
// Upload button is disabled once page_count = 10.
// Finish Document button is disabled when page_count = 0.
// No AI controls are visible while status = IN_PROGRESS.

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createTemporaryDocument, finishDocument } from "@/lib/actions/document";
import { getTemporarySession, isPrivacyAccepted } from "@/lib/session/temporary";

interface Page {
  id: string;
  order: number;
  blobPath: string | null;
  createdAt: string;
}

interface Document {
  id: string;
  title: string;
  status: string;
  pageCount: number;
}

export default function WorkspacePage() {
  const router = useRouter();
  const [document, setDocument] = useState<Document | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState("");

  useEffect(() => {
    initializeWorkspace();
  }, []);

  const initializeWorkspace = async () => {
    try {
      // Check if privacy has been accepted
      const privacyAccepted = await isPrivacyAccepted();
      if (!privacyAccepted) {
        router.push("/app/start");
        return;
      }

      // Get session
      const session = await getTemporarySession();
      if (!session) {
        router.push("/app/start");
        return;
      }

      // Load document or create one
      const response = await fetch(`/api/documents?sessionId=${session.id}`);
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
        });
        
        // Load pages
        const pagesResponse = await fetch(`/api/documents/${doc.id}/pages`);
        if (pagesResponse.ok) {
          const pagesData = await pagesResponse.json();
          setPages(pagesData.pages || []);
        }
      } else {
        // Create new document
        setIsCreating(true);
        try {
          const newDoc = await createTemporaryDocument("Untitled Document");
          if (newDoc) {
            setDocument({
              id: newDoc.id,
              title: newDoc.title,
              status: newDoc.status,
              pageCount: 0,
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
        formData.append("sessionId", document.id); // Using document ID as session identifier

        const response = await fetch(`/api/documents/${document.id}/pages`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to upload page");
        }

        const data = await response.json();
        setPages((prev) => [...prev, data.page]);
        setDocument((prev) => prev ? { ...prev, pageCount: prev.pageCount + 1 } : null);
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

  const handleFinishDocument = async () => {
    if (!document) return;

    setIsFinishing(true);
    try {
      const result = await finishDocument(document.id);
      if (result) {
        setDocument((prev) => prev ? { ...prev, status: result.status } : null);
        // Redirect to chat or show AI controls would happen here
        alert("Document is now ready! AI features will be available in the next phase.");
      }
    } finally {
      setIsFinishing(false);
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
  const canFinish = document.pageCount > 0 && document.status === "IN_PROGRESS";
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
                <h1
                  className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                  onClick={() => {
                    setTitleInput(document.title);
                    setIsEditingTitle(true);
                  }}
                >
                  {document.title}
                </h1>
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
                    : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {isReady ? "Ready" : "In Progress"}
              </span>
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
                        JPEG, PNG, PDF (MAX 10 pages total)
                      </p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/jpeg,image/png,application/pdf"
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {pages.map((page) => (
                    <div
                      key={page.id}
                      className="border border-gray-200 rounded-lg p-4 flex flex-col items-center"
                    >
                      <div className="w-full aspect-[3/4] bg-gray-100 rounded mb-2 flex items-center justify-center">
                        <svg
                          className="w-12 h-12 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <span className="text-sm text-gray-600">Page {page.order + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column - Actions */}
          <div className="space-y-6">
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
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium">{document.status}</span>
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
                    Upload at least one page to finish
                  </p>
                )}
              </div>
            )}

            {isReady && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-green-900 mb-2">
                  Document Ready!
                </h2>
                <p className="text-sm text-green-700">
                  Your document is ready for AI processing. AI features will be available in the next phase.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}