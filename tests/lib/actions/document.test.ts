// Tests for document Server Actions.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createTemporaryDocument,
  finishDocument,
  updateDocumentTitle,
} from "@/lib/actions/document";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";

// Mock Prisma
vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    page: {
      count: vi.fn(),
    },
    document: {
      update: vi.fn(),
      findFirst: vi.fn(),
    },
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

  it("should transition document from IN_PROGRESS to READY", async () => {
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

    const mockUpdatedDocument = {
      ...mockDocument,
      status: "READY",
    };

    const { getTemporarySession } = await import("@/lib/session/temporary");
    const { temporaryOwner } = await import("@/lib/permissions/ownership");
    const { getOwnedDocument } = await import("@/lib/permissions/ownership");
    const { revalidatePath } = await import("next/cache");

    vi.mocked(getTemporarySession).mockResolvedValue(mockSession);
    vi.mocked(temporaryOwner).mockReturnValue({ kind: "temporary", temporarySessionId: "session-123" });
    vi.mocked(getOwnedDocument).mockResolvedValue(mockDocument);
    vi.mocked(prisma.page.count).mockResolvedValue(1);
    vi.mocked(prisma.document.update).mockResolvedValue(mockUpdatedDocument as any);

    const result = await finishDocument("doc-123");

    expect(result.status).toBe("READY");
    expect(prisma.page.count).toHaveBeenCalledWith({ where: { documentId: "doc-123" } });
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc-123", temporarySessionId: "session-123" },
      data: { status: "READY" },
    });
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
    vi.mocked(getOwnedDocument).mockResolvedValue(mockDocument);

    await expect(finishDocument("doc-123")).rejects.toThrow(
      "Document is not in IN_PROGRESS status."
    );
  });

  it("should throw error if document has no pages", async () => {
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
    vi.mocked(getOwnedDocument).mockResolvedValue(mockDocument);
    vi.mocked(prisma.page.count).mockResolvedValue(0);

    await expect(finishDocument("doc-123")).rejects.toThrow(
      "Document must have at least one page before finishing."
    );
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
    vi.mocked(getOwnedDocument).mockResolvedValue(mockDocument);
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