// Tests for the document deletion lifecycle (docs/08 Phase 8, docs/09 Coding Risk Register R-002).
//
// Covers: immediate access removal (ACTIVE -> DELETE_PENDING), DB child cleanup, the Blob
// cleanup success path, a simulated Blob cleanup failure, and the retry path that completes
// cleanup on a second call once the transient failure is gone.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { deleteDocument } from "@/lib/documents/deletion";
import { prisma } from "@/lib/database/prisma";
import { deletePageImage } from "@/lib/storage/blob";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    document: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    page: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    section: {
      deleteMany: vi.fn(),
    },
    chatSessionDocument: {
      deleteMany: vi.fn(),
    },
    chatMessageSource: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/storage/blob", () => ({
  deletePageImage: vi.fn(),
}));

const owner = { kind: "temporary" as const, temporarySessionId: "session-123" };

describe("deleteDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.page.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.section.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.chatSessionDocument.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.chatMessageSource.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.$transaction).mockImplementation((ops: any) => Promise.all(ops));
  });

  it("throws 404 when the document is not owned by the caller, or already DELETED", async () => {
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    await expect(deleteDocument(owner, "doc-999")).rejects.toMatchObject({
      statusCode: 404,
      code: "DOCUMENT_NOT_FOUND",
    });
    expect(prisma.document.updateMany).not.toHaveBeenCalled();
  });

  it("flips ACTIVE to DELETE_PENDING and completes cleanup when Blob deletes succeed", async () => {
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      temporarySessionId: "session-123",
      deletionState: "ACTIVE",
    } as any);
    vi.mocked(prisma.page.findMany).mockResolvedValue([
      { id: "page-1", blobPath: "conditions-translator/documents/doc-123/pages/page-1.jpeg" },
      { id: "page-2", blobPath: "conditions-translator/documents/doc-123/pages/page-2.jpeg" },
    ] as any);
    vi.mocked(deletePageImage).mockResolvedValue(undefined);
    vi.mocked(prisma.document.update).mockResolvedValue({
      id: "doc-123",
      deletionState: "DELETED",
    } as any);

    const result = await deleteDocument(owner, "doc-123");

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: "doc-123", temporarySessionId: "session-123", deletionState: "ACTIVE" },
      data: { deletionState: "DELETE_PENDING" },
    });
    expect(deletePageImage).toHaveBeenCalledTimes(2);
    expect(prisma.page.deleteMany).toHaveBeenCalledWith({
      where: { documentId: "doc-123", document: { temporarySessionId: "session-123" } },
    });
    expect(prisma.section.deleteMany).toHaveBeenCalled();
    expect(prisma.chatSessionDocument.deleteMany).toHaveBeenCalled();
    expect(prisma.chatMessageSource.deleteMany).toHaveBeenCalled();
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc-123", temporarySessionId: "session-123" },
      data: { deletionState: "DELETED" },
    });
    expect(result).toEqual({
      document: { id: "doc-123", deletionState: "DELETED" },
      cleanupComplete: true,
    });
  });

  it("leaves the document DELETE_PENDING and skips DB cleanup when a Blob delete fails", async () => {
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      temporarySessionId: "session-123",
      deletionState: "ACTIVE",
    } as any);
    vi.mocked(prisma.page.findMany).mockResolvedValue([
      { id: "page-1", blobPath: "conditions-translator/documents/doc-123/pages/page-1.jpeg" },
    ] as any);
    vi.mocked(deletePageImage).mockRejectedValue(new Error("blob store unavailable"));

    const result = await deleteDocument(owner, "doc-123");

    expect(result.cleanupComplete).toBe(false);
    expect(result.document.deletionState).toBe("DELETE_PENDING");
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.page.deleteMany).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it("retries and completes cleanup on a second call once the Blob failure clears", async () => {
    // First call: ACTIVE -> DELETE_PENDING, but the Blob delete fails.
    vi.mocked(prisma.document.findFirst).mockResolvedValueOnce({
      id: "doc-123",
      temporarySessionId: "session-123",
      deletionState: "ACTIVE",
    } as any);
    vi.mocked(prisma.page.findMany).mockResolvedValueOnce([
      { id: "page-1", blobPath: "conditions-translator/documents/doc-123/pages/page-1.jpeg" },
    ] as any);
    vi.mocked(deletePageImage).mockRejectedValueOnce(new Error("transient failure"));

    const first = await deleteDocument(owner, "doc-123");
    expect(first.cleanupComplete).toBe(false);

    // Second call (retry): document is now DELETE_PENDING; the Page row (and blobPath) is
    // still present because cleanup never got far enough to delete it.
    vi.mocked(prisma.document.findFirst).mockResolvedValueOnce({
      id: "doc-123",
      temporarySessionId: "session-123",
      deletionState: "DELETE_PENDING",
    } as any);
    vi.mocked(prisma.page.findMany).mockResolvedValueOnce([
      { id: "page-1", blobPath: "conditions-translator/documents/doc-123/pages/page-1.jpeg" },
    ] as any);
    vi.mocked(deletePageImage).mockResolvedValueOnce(undefined);
    vi.mocked(prisma.document.update).mockResolvedValue({
      id: "doc-123",
      deletionState: "DELETED",
    } as any);

    const second = await deleteDocument(owner, "doc-123");

    expect(second.cleanupComplete).toBe(true);
    expect(second.document.deletionState).toBe("DELETED");
    // The flip is only attempted once — the retry call must not re-run it since the document
    // was no longer ACTIVE.
    expect(prisma.document.updateMany).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for a Document owned by a different owner", async () => {
    // getDeletableDocument's WHERE includes the owner, so a cross-owner lookup resolves null
    // exactly like a nonexistent document — never distinguishable from the outside.
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    await expect(
      deleteDocument({ kind: "user", userId: "someone-else" }, "doc-123")
    ).rejects.toBeInstanceOf(AppError);
  });
});
