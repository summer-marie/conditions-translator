// Tests for /api/documents/[documentId]: owner-aware fetch (with sections), title update, and
// deletion. Owner resolution (getCurrentOwner) and the deletion service (deleteDocument) are
// mocked at their module boundaries; ownership.ts itself is left real since it's a thin,
// already-covered wrapper over the mocked Prisma client (see tests/schema/ownership.test.ts for
// its live-DB coverage).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH, DELETE } from "@/app/api/documents/[documentId]/route";
import { prisma } from "@/lib/database/prisma";
import { getCurrentOwner } from "@/lib/auth/session";
import { deleteDocument } from "@/lib/documents/deletion";
import { AppError } from "@/lib/errors";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    document: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentOwner: vi.fn(),
}));

vi.mock("@/lib/documents/deletion", () => ({
  deleteDocument: vi.fn(),
}));

const temporaryOwner = { kind: "temporary" as const, temporarySessionId: "session-123" };
const userOwnerFixture = { kind: "user" as const, userId: "user-123" };

describe("GET /api/documents/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the document with its ordered sections for a temporary-session owner", async () => {
    const mockDocument = {
      id: "doc-123",
      title: "Test Document",
      status: "READY",
      temporarySessionId: "session-123",
      sections: [
        {
          id: "section-1",
          heading: "Reporting",
          body: "Report monthly.",
          order: 0,
          sources: [{ pageId: "page-1" }],
        },
      ],
    };

    vi.mocked(getCurrentOwner).mockResolvedValue(temporaryOwner);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);

    const request = new Request("http://localhost/api/documents/doc-123");
    const response = await GET(request, { params: Promise.resolve({ documentId: "doc-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.document.sections).toHaveLength(1);
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: "doc-123", temporarySessionId: "session-123", deletionState: "ACTIVE" },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: { sources: { select: { pageId: true } } },
        },
      },
    });
  });

  it("scopes the lookup by userId for a signed-in user owner", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(userOwnerFixture);
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      userId: "user-123",
      sections: [],
    } as any);

    const request = new Request("http://localhost/api/documents/doc-123");
    await GET(request, { params: Promise.resolve({ documentId: "doc-123" }) });

    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: "doc-123", userId: "user-123", deletionState: "ACTIVE" },
      include: expect.any(Object),
    });
  });

  it("returns 404 when the document does not belong to the caller", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(temporaryOwner);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const request = new Request("http://localhost/api/documents/doc-999");
    const response = await GET(request, { params: Promise.resolve({ documentId: "doc-999" }) });

    expect(response.status).toBe(404);
  });

  it("returns 401 when there is no active session or signed-in user", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(null);

    const request = new Request("http://localhost/api/documents/doc-123");
    const response = await GET(request, { params: Promise.resolve({ documentId: "doc-123" }) });

    expect(response.status).toBe(401);
  });
});

describe("PATCH /api/documents/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function patchRequest(title: string) {
    return new Request("http://localhost/api/documents/doc-123", {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
  }

  it("updates the title for a temporary-session owner", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(temporaryOwner);
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      temporarySessionId: "session-123",
      deletionState: "ACTIVE",
    } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({
      id: "doc-123",
      title: "New Title",
    } as any);

    const response = await PATCH(patchRequest("New Title"), {
      params: Promise.resolve({ documentId: "doc-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.document.title).toBe("New Title");
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc-123", temporarySessionId: "session-123" },
      data: { title: "New Title" },
    });
  });

  it("updates the title for a signed-in user owner", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(userOwnerFixture);
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      userId: "user-123",
      deletionState: "ACTIVE",
    } as any);
    vi.mocked(prisma.document.update).mockResolvedValue({
      id: "doc-123",
      title: "New Title",
    } as any);

    await PATCH(patchRequest("New Title"), { params: Promise.resolve({ documentId: "doc-123" }) });

    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: "doc-123", userId: "user-123" },
      data: { title: "New Title" },
    });
  });

  it("returns 404 when the document is not owned by the caller", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(temporaryOwner);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const response = await PATCH(patchRequest("New Title"), {
      params: Promise.resolve({ documentId: "doc-123" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 when the title is empty", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(temporaryOwner);
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      temporarySessionId: "session-123",
      deletionState: "ACTIVE",
    } as any);

    const response = await PATCH(patchRequest("   "), { params: Promise.resolve({ documentId: "doc-123" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("TITLE_REQUIRED");
  });

  it("returns 400 when the title exceeds 200 characters", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(temporaryOwner);
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      temporarySessionId: "session-123",
      deletionState: "ACTIVE",
    } as any);

    const response = await PATCH(patchRequest("a".repeat(201)), {
      params: Promise.resolve({ documentId: "doc-123" }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("TITLE_TOO_LONG");
  });

  it("returns 401 when there is no active session or signed-in user", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(null);

    const response = await PATCH(patchRequest("New Title"), {
      params: Promise.resolve({ documentId: "doc-123" }),
    });

    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/documents/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the deletion result on success", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(temporaryOwner);
    vi.mocked(deleteDocument).mockResolvedValue({
      document: { id: "doc-123", deletionState: "DELETED" } as any,
      cleanupComplete: true,
    });

    const request = new Request("http://localhost/api/documents/doc-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ documentId: "doc-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ deletionState: "DELETED", cleanupComplete: true });
    expect(deleteDocument).toHaveBeenCalledWith(temporaryOwner, "doc-123");
  });

  it("reports incomplete cleanup without failing the request", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(temporaryOwner);
    vi.mocked(deleteDocument).mockResolvedValue({
      document: { id: "doc-123", deletionState: "DELETE_PENDING" } as any,
      cleanupComplete: false,
    });

    const request = new Request("http://localhost/api/documents/doc-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ documentId: "doc-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ deletionState: "DELETE_PENDING", cleanupComplete: false });
  });

  it("returns 404 when the document is not owned by the caller (propagated from the service)", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(temporaryOwner);
    vi.mocked(deleteDocument).mockRejectedValue(
      new AppError("Document not found.", 404, "DOCUMENT_NOT_FOUND")
    );

    const request = new Request("http://localhost/api/documents/doc-999", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ documentId: "doc-999" }) });

    expect(response.status).toBe(404);
  });

  it("returns 401 when there is no active session or signed-in user", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(null);

    const request = new Request("http://localhost/api/documents/doc-123", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ documentId: "doc-123" }) });

    expect(response.status).toBe(401);
    expect(deleteDocument).not.toHaveBeenCalled();
  });
});
