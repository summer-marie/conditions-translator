// Tests for document Server Actions.
//
// `any` casts on mock Prisma objects below are deliberate: constructing the exact generated
// Prisma types for every partial fixture would add noise without catching real bugs.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTemporaryDocument,
  finishDocument,
  retryDocumentProcessing,
  updateDocumentTitle,
  acceptPage,
  reuploadPage,
  deletePage,
} from "@/lib/actions/document";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { generateSectionsForDocument } from "@/lib/sections/generate";

vi.mock("@/lib/sections/generate", () => ({
  generateSectionsForDocument: vi.fn(),
}));

// Mock Prisma
vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    page: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    document: {
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    ocrResult: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

// Mock session functions
vi.mock("@/lib/session/temporary", () => ({
  getTemporarySession: vi.fn(),
  isPrivacyAccepted: vi.fn(),
}));

// Mock ownership functions
vi.mock("@/lib/permissions/ownership", () => ({
  temporaryOwner: vi.fn(),
  getOwnedDocument: vi.fn(),
  createDocument: vi.fn(),
}));

// Mock cache revalidation
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock image validation and Blob storage (used by reuploadPage)
vi.mock("@/lib/validation/image", () => ({
  validateImageUpload: vi.fn(),
}));

vi.mock("@/lib/storage/blob", () => ({
  uploadPageImage: vi.fn(),
  deletePageImage: vi.fn(),
}));

describe("createTemporaryDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create an IN_PROGRESS document with temporary session ownership", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-abc",
      noticeAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const mockDocument = {
      id: "doc-123",
      title: "Test Document",
      status: "IN_PROGRESS",
      userId: null,
      temporarySessionId: "session-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletionState: "ACTIVE",
    };

    const { isPrivacyAccepted } = await import("@/lib/session/temporary");
    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { createDocument } = await import("@/lib/permissions/ownership");

    vi.mocked(isPrivacyAccepted).mockResolvedValue(true);
    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(createDocument).mockResolvedValue(mockDocument as any);

    const result = await createTemporaryDocument("Test Document");

    expect(result).toEqual(mockDocument);
    expect(isPrivacyAccepted).toHaveBeenCalled();
    expect(getTemporarySession).toHaveBeenCalled();
    expect(createDocument).toHaveBeenCalledWith(
      { kind: "temporary", temporarySessionId: "session-123" },
      { title: "Test Document", expiresAt: expect.any(Date) }
    );
  });

  it("should throw error if privacy not accepted", async () => {
    const { isPrivacyAccepted } = await import("@/lib/session/temporary");

    vi.mocked(isPrivacyAccepted).mockResolvedValue(false);

    await expect(createTemporaryDocument()).rejects.toThrow(
      "Privacy notice must be accepted before creating a document."
    );
  });

  it("should throw error if no session found", async () => {
    const { isPrivacyAccepted } = await import("@/lib/session/temporary");
    const { getTemporarySession } = await import("@/lib/session/temporary");

    vi.mocked(isPrivacyAccepted).mockResolvedValue(true);
    vi.mocked(getTemporarySession).mockResolvedValue(null);

    await expect(createTemporaryDocument()).rejects.toThrow("No active session found");
  });

  it("should use default title if not provided", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-abc",
      noticeAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const mockDocument = {
      id: "doc-123",
      title: "Untitled Document",
      status: "IN_PROGRESS",
      userId: null,
      temporarySessionId: "session-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletionState: "ACTIVE",
    };

    const { isPrivacyAccepted } = await import("@/lib/session/temporary");
    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { createDocument } = await import("@/lib/permissions/ownership");

    vi.mocked(isPrivacyAccepted).mockResolvedValue(true);
    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(createDocument).mockResolvedValue(mockDocument as any);

    const result = await createTemporaryDocument();

    expect(result.title).toBe("Untitled Document");
    expect(createDocument).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ title: "Untitled Document" })
    );
  });
});

describe("finishDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks the document COMPLETED and delegates to generateSectionsForDocument", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-abc",
      noticeAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const mockDocument = {
      id: "doc-123",
      title: "Test Document",
      status: "IN_PROGRESS",
      userId: null,
      temporarySessionId: "session-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletionState: "ACTIVE",
    };

    const mockReadyDocument = { ...mockDocument, status: "READY" };

    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { getOwnedDocument } = await import("@/lib/permissions/ownership");
    const { revalidatePath } = await import("next/cache");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.count).mockResolvedValue(1);
    vi.mocked(prisma.document.update).mockResolvedValue({ ...mockDocument, status: "COMPLETED" } as any);
    vi.mocked(generateSectionsForDocument).mockResolvedValue(mockReadyDocument as any);

    const result = await finishDocument("doc-123");

    expect(result.status).toBe("READY");
    expect(prisma.page.count).toHaveBeenCalledWith({
      where: { documentId: "doc-123", status: "ACCEPTED" },
    });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc-123", temporarySessionId: "session-123" },
      data: { status: "COMPLETED" },
    });
    expect(generateSectionsForDocument).toHaveBeenCalledWith(
      { kind: "temporary", temporarySessionId: "session-123" },
      "doc-123"
    );
    expect(revalidatePath).toHaveBeenCalledWith("/app/workspace");
  });

  it("should throw error if no session found", async () => {
    const { getTemporarySession } = await import("@/lib/session/temporary");

    vi.mocked(getTemporarySession).mockResolvedValue(null);

    await expect(finishDocument("doc-123")).rejects.toThrow("No active session found");
  });

  it("should throw error if document not found", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-abc",
      noticeAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { getOwnedDocument } = await import("@/lib/permissions/ownership");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(null);

    await expect(finishDocument("doc-123")).rejects.toThrow("Document not found");
  });

  it("should throw error if document is not IN_PROGRESS", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-abc",
      noticeAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const mockDocument = {
      id: "doc-123",
      title: "Test Document",
      status: "READY",
      userId: null,
      temporarySessionId: "session-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletionState: "ACTIVE",
    };

    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { getOwnedDocument } = await import("@/lib/permissions/ownership");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(mockDocument as any);

    await expect(finishDocument("doc-123")).rejects.toThrow(
      "Document is not in IN_PROGRESS status."
    );
  });

  it("should throw error if document has no accepted pages", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-abc",
      noticeAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const mockDocument = {
      id: "doc-123",
      title: "Test Document",
      status: "IN_PROGRESS",
      userId: null,
      temporarySessionId: "session-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletionState: "ACTIVE",
    };

    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { getOwnedDocument } = await import("@/lib/permissions/ownership");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.count).mockResolvedValue(0);

    await expect(finishDocument("doc-123")).rejects.toThrow(
      "Document must have at least one accepted page before finishing."
    );
    expect(generateSectionsForDocument).not.toHaveBeenCalled();
  });
});

describe("retryDocumentProcessing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockSession = {
    id: "session-123",
    token: "token-abc",
    noticeAcceptedAt: new Date(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  it("delegates to generateSectionsForDocument when the document is PROCESSING_FAILED", async () => {
    const mockDocument = {
      id: "doc-123",
      title: "Test Document",
      status: "PROCESSING_FAILED",
      userId: null,
      temporarySessionId: "session-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletionState: "ACTIVE",
    };
    const mockReadyDocument = { ...mockDocument, status: "READY" };

    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { getOwnedDocument } = await import("@/lib/permissions/ownership");
    const { revalidatePath } = await import("next/cache");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(mockDocument as any);
    vi.mocked(generateSectionsForDocument).mockResolvedValue(mockReadyDocument as any);

    const result = await retryDocumentProcessing("doc-123");

    expect(result.status).toBe("READY");
    expect(generateSectionsForDocument).toHaveBeenCalledWith(
      { kind: "temporary", temporarySessionId: "session-123" },
      "doc-123"
    );
    expect(revalidatePath).toHaveBeenCalledWith("/app/workspace");
  });

  it("throws if no session found", async () => {
    const { getTemporarySession } = await import("@/lib/session/temporary");
    vi.mocked(getTemporarySession).mockResolvedValue(null);

    await expect(retryDocumentProcessing("doc-123")).rejects.toThrow("No active session found");
  });

  it("throws if document not found", async () => {
    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { getOwnedDocument } = await import("@/lib/permissions/ownership");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(null);

    await expect(retryDocumentProcessing("doc-123")).rejects.toThrow("Document not found");
  });

  it("throws if the document is not in PROCESSING_FAILED", async () => {
    const mockDocument = {
      id: "doc-123",
      title: "Test Document",
      status: "READY",
      userId: null,
      temporarySessionId: "session-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletionState: "ACTIVE",
    };

    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { getOwnedDocument } = await import("@/lib/permissions/ownership");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(mockDocument as any);

    await expect(retryDocumentProcessing("doc-123")).rejects.toThrow(
      "Document is not in a failed processing state."
    );
    expect(generateSectionsForDocument).not.toHaveBeenCalled();
  });
});

describe("updateDocumentTitle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update document title", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-abc",
      noticeAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const mockDocument = {
      id: "doc-123",
      title: "Old Title",
      status: "IN_PROGRESS",
      userId: null,
      temporarySessionId: "session-123",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletionState: "ACTIVE",
    };

    const mockUpdatedDocument = {
      ...mockDocument,
      title: "New Title",
    };

    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { getOwnedDocument } = await import("@/lib/permissions/ownership");
    const { revalidatePath } = await import("next/cache");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.document.update).mockResolvedValue(mockUpdatedDocument as any);

    const result = await updateDocumentTitle("doc-123", "New Title");

    expect(result.title).toBe("New Title");
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc-123", temporarySessionId: "session-123" },
      data: { title: "New Title" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/app/workspace");
  });

  it("should throw error if no session found", async () => {
    const { getTemporarySession } = await import("@/lib/session/temporary");

    vi.mocked(getTemporarySession).mockResolvedValue(null);

    await expect(updateDocumentTitle("doc-123", "New Title")).rejects.toThrow(
      "No active session found"
    );
  });

  it("should throw error if document not found", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-abc",
      noticeAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { getOwnedDocument } = await import("@/lib/permissions/ownership");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(null);

    await expect(updateDocumentTitle("doc-123", "New Title")).rejects.toThrow(
      "Document not found"
    );
  });
});

const mockInProgressDocument = {
  id: "doc-123",
  title: "Test Document",
  status: "IN_PROGRESS",
  userId: null,
  temporarySessionId: "session-123",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletionState: "ACTIVE",
};

const mockSession = {
  id: "session-123",
  token: "token-abc",
  noticeAcceptedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
};

async function setUpOwnedInProgressDocument() {
  const { getTemporarySession } = await import("@/lib/session/temporary");
  const { temporaryOwner, getOwnedDocument } = await import("@/lib/permissions/ownership");

  vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
  vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
  vi.mocked(getOwnedDocument).mockResolvedValue(mockInProgressDocument as any);
}

describe("acceptPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets status to ACCEPTED, making the extracted text the immutable source", async () => {
    await setUpOwnedInProgressDocument();

    const mockPage = {
      id: "page-123",
      documentId: "doc-123",
      status: "OCR_COMPLETE",
      ocr: {
        extractedText: "Report to your officer monthly.",
        warnings: {
          blurry: false,
          cutOff: false,
          sideways: false,
          incomplete: false,
          unreadable: false,
        },
      },
    };
    vi.mocked(prisma.page.findFirst).mockResolvedValue(mockPage as any);
    vi.mocked(prisma.page.update).mockResolvedValue({ ...mockPage, status: "ACCEPTED" } as any);

    const result = await acceptPage("doc-123", "page-123");

    expect(result.status).toBe("ACCEPTED");
    expect(prisma.page.update).toHaveBeenCalledWith({
      where: { id: "page-123" },
      data: { status: "ACCEPTED" },
    });
  });

  it("throws if the document is not owned by the caller", async () => {
    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner, getOwnedDocument } = await import("@/lib/permissions/ownership");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(null);

    await expect(acceptPage("doc-123", "page-123")).rejects.toThrow("Document not found");
  });

  it("throws if OCR has not completed successfully", async () => {
    await setUpOwnedInProgressDocument();
    vi.mocked(prisma.page.findFirst).mockResolvedValue({
      id: "page-123",
      documentId: "doc-123",
      status: "PENDING",
      ocr: null,
    } as any);

    await expect(acceptPage("doc-123", "page-123")).rejects.toThrow(
      "must complete OCR successfully"
    );
  });

  it("throws when the model reports the page unreadable", async () => {
    await setUpOwnedInProgressDocument();
    vi.mocked(prisma.page.findFirst).mockResolvedValue({
      id: "page-123",
      documentId: "doc-123",
      status: "OCR_COMPLETE",
      ocr: {
        extractedText: "",
        warnings: {
          blurry: true,
          cutOff: false,
          sideways: false,
          incomplete: false,
          unreadable: true,
        },
      },
    } as any);

    await expect(acceptPage("doc-123", "page-123")).rejects.toThrow(
      "quality is too low"
    );
  });

  it("throws when extracted text is too short to be a usable page (mostly missing)", async () => {
    await setUpOwnedInProgressDocument();
    vi.mocked(prisma.page.findFirst).mockResolvedValue({
      id: "page-123",
      documentId: "doc-123",
      status: "OCR_COMPLETE",
      ocr: {
        extractedText: "hi",
        warnings: {
          blurry: false,
          cutOff: false,
          sideways: false,
          incomplete: false,
          unreadable: false,
        },
      },
    } as any);

    await expect(acceptPage("doc-123", "page-123")).rejects.toThrow(
      "quality is too low"
    );
  });

  it("accepts a page with framing warnings (blurry/cutOff/incomplete) when the text is readable", async () => {
    await setUpOwnedInProgressDocument();
    vi.mocked(prisma.page.findFirst).mockResolvedValue({
      id: "page-123",
      documentId: "doc-123",
      status: "OCR_COMPLETE",
      ocr: {
        extractedText: "ARIZONA CODE OF JUDICIAL ADMINISTRATION Part 6: Probation Chapter 2: Adult",
        warnings: {
          blurry: true,
          cutOff: true,
          sideways: false,
          incomplete: true,
          unreadable: false,
        },
      },
    } as any);
    vi.mocked(prisma.page.update).mockResolvedValue({
      id: "page-123",
      status: "ACCEPTED",
    } as any);

    const result = await acceptPage("doc-123", "page-123");

    expect(result.status).toBe("ACCEPTED");
  });
});

describe("reuploadPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets the page to PENDING and clears its prior OcrResult", async () => {
    await setUpOwnedInProgressDocument();

    const { validateImageUpload } = await import("@/lib/validation/image");
    const { uploadPageImage } = await import("@/lib/storage/blob");

    vi.mocked(prisma.page.findFirst).mockResolvedValue({
      id: "page-123",
      documentId: "doc-123",
      status: "OCR_FAILED",
      blobPath: "conditions-translator/documents/doc-123/pages/page-123.jpeg",
    } as any);
    vi.mocked(validateImageUpload).mockReturnValue({ mimeType: "image/jpeg", exifOrientation: null });
    vi.mocked(uploadPageImage).mockResolvedValue({
      pathname: "conditions-translator/documents/doc-123/pages/page-123.jpeg",
      url: "https://example.private.blob.vercel-storage.com/page-123.jpeg",
      contentType: "image/jpeg",
    });
    vi.mocked(prisma.ocrResult.deleteMany).mockResolvedValue({ count: 1 } as any);
    vi.mocked(prisma.page.update).mockResolvedValue({
      id: "page-123",
      documentId: "doc-123",
      status: "PENDING",
      ocrFailureReason: null,
      blobPath: "conditions-translator/documents/doc-123/pages/page-123.jpeg",
    } as any);

    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "retake.jpg", { type: "image/jpeg" }));

    const result = await reuploadPage("doc-123", "page-123", formData);

    expect(result.status).toBe("PENDING");
    expect(prisma.ocrResult.deleteMany).toHaveBeenCalledWith({ where: { pageId: "page-123" } });
    expect(prisma.page.update).toHaveBeenCalledWith({
      where: { id: "page-123" },
      data: {
        status: "PENDING",
        ocrFailureReason: null,
        blobPath: "conditions-translator/documents/doc-123/pages/page-123.jpeg",
      },
    });
  });

  it("throws if the page has already been accepted", async () => {
    await setUpOwnedInProgressDocument();
    vi.mocked(prisma.page.findFirst).mockResolvedValue({
      id: "page-123",
      documentId: "doc-123",
      status: "ACCEPTED",
    } as any);

    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([0xff, 0xd8, 0xff])], "retake.jpg", { type: "image/jpeg" }));

    await expect(reuploadPage("doc-123", "page-123", formData)).rejects.toThrow(
      "already been accepted"
    );
  });
});

describe("deletePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the page's stored image and record, and compacts remaining page order", async () => {
    await setUpOwnedInProgressDocument();

    const { deletePageImage } = await import("@/lib/storage/blob");

    vi.mocked(prisma.page.findFirst).mockResolvedValue({
      id: "page-2",
      documentId: "doc-123",
      order: 1,
      blobPath: "conditions-translator/documents/doc-123/pages/page-2.jpeg",
    } as any);
    vi.mocked(prisma.page.delete).mockResolvedValue({} as any);
    // Pages 0 and 3 remain after deleting order=1; order=3 must compact down to 1.
    vi.mocked(prisma.page.findMany).mockResolvedValue([
      { id: "page-1", order: 0 },
      { id: "page-3", order: 3 },
    ] as any);
    vi.mocked(prisma.page.update).mockResolvedValue({} as any);

    const result = await deletePage("doc-123", "page-2");

    expect(result.deleted).toBe(true);
    expect(deletePageImage).toHaveBeenCalledWith(
      "conditions-translator/documents/doc-123/pages/page-2.jpeg"
    );
    expect(prisma.page.delete).toHaveBeenCalledWith({ where: { id: "page-2" } });
    expect(prisma.page.update).toHaveBeenCalledWith({
      where: { id: "page-3" },
      data: { order: 1 },
    });
    // page-1 was already at the correct order (0) and should not be rewritten.
    expect(prisma.page.update).not.toHaveBeenCalledWith({
      where: { id: "page-1" },
      data: expect.anything(),
    });
  });

  it("throws if the page is not found under the owned document", async () => {
    await setUpOwnedInProgressDocument();
    vi.mocked(prisma.page.findFirst).mockResolvedValue(null);

    await expect(deletePage("doc-123", "missing-page")).rejects.toThrow("Page not found");
  });
});