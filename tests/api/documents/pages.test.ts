// Tests for page upload API route: magic-byte image validation, private Blob storage,
// and 10-page limit enforcement (docs/03_OCR_Specifications.md, Phase 4).
//
// `any` casts on mock Prisma objects below are deliberate: constructing the exact generated
// Prisma types for every partial fixture would add noise without catching real bugs.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "@/app/api/documents/[documentId]/pages/route";
import { prisma } from "@/lib/database/prisma";
import { getCurrentOwner } from "@/lib/auth/session";

// Minimal valid magic-byte prefixes so validateImageUpload's format sniff succeeds.
const JPEG_BYTES = new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00]);

// Mock Prisma
vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    temporarySession: {
      findUnique: vi.fn(),
    },
    document: {
      findFirst: vi.fn(),
    },
    page: {
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock cookies (still used by the POST upload path, which stays temporary-session-scoped)
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

// Mock Blob storage so no real network/OIDC credentials are needed in unit tests.
vi.mock("@/lib/storage/blob", () => ({
  uploadPageImage: vi.fn(),
}));

// Mock owner resolution for the owner-aware GET handler.
vi.mock("@/lib/auth/session", () => ({
  getCurrentOwner: vi.fn(),
}));

describe("GET /api/documents/[documentId]/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists pages for a temporary-session owner", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue({
      kind: "temporary",
      temporarySessionId: "session-123",
    });
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      temporarySessionId: "session-123",
      deletionState: "ACTIVE",
    } as any);
    vi.mocked(prisma.page.findMany).mockResolvedValue([
      { id: "page-1", order: 0, status: "ACCEPTED", ocr: null },
    ] as any);

    const request = new Request("http://localhost/api/documents/doc-123/pages");
    const response = await GET(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pages).toHaveLength(1);
  });

  it("lists pages for a signed-in user owner", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue({ kind: "user", userId: "user-123" });
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      userId: "user-123",
      deletionState: "ACTIVE",
    } as any);
    vi.mocked(prisma.page.findMany).mockResolvedValue([] as any);

    const request = new Request("http://localhost/api/documents/doc-123/pages");
    const response = await GET(request, { params: { documentId: "doc-123" } });

    expect(response.status).toBe(200);
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: "doc-123", userId: "user-123", deletionState: "ACTIVE" },
    });
  });

  it("returns 404 for a document owned by someone else", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue({
      kind: "temporary",
      temporarySessionId: "session-123",
    });
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const request = new Request("http://localhost/api/documents/doc-999/pages");
    const response = await GET(request, { params: { documentId: "doc-999" } });

    expect(response.status).toBe(404);
  });

  it("returns 401 when there is no active session or signed-in user", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(null);

    const request = new Request("http://localhost/api/documents/doc-123/pages");
    const response = await GET(request, { params: { documentId: "doc-123" } });

    expect(response.status).toBe(401);
  });
});

describe("POST /api/documents/[documentId]/pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should upload a page successfully", async () => {
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

    const mockCreatedPage = {
      id: "page-123",
      documentId: "doc-123",
      order: 0,
      status: "PENDING",
      ocrFailureReason: null,
      blobPath: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockUpdatedPage = { ...mockCreatedPage, blobPath: "conditions-translator/documents/doc-123/pages/page-123.jpeg" };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.count).mockResolvedValue(0);
    vi.mocked(prisma.page.create).mockResolvedValue(mockCreatedPage as any);
    vi.mocked(prisma.page.update).mockResolvedValue(mockUpdatedPage as any);

    const { uploadPageImage } = await import("@/lib/storage/blob");
    vi.mocked(uploadPageImage).mockResolvedValue({
      pathname: mockUpdatedPage.blobPath,
      url: "https://example.private.blob.vercel-storage.com/" + mockUpdatedPage.blobPath,
      contentType: "image/jpeg",
    });

    const formData = new FormData();
    formData.append("file", new Blob([JPEG_BYTES], { type: "image/jpeg" }), "test.jpg");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.page).toMatchObject({
      id: mockUpdatedPage.id,
      documentId: mockUpdatedPage.documentId,
      order: mockUpdatedPage.order,
      blobPath: mockUpdatedPage.blobPath,
      status: "PENDING",
    });
    expect(prisma.page.create).toHaveBeenCalledWith({
      data: { documentId: "doc-123", order: 0 },
    });
    expect(uploadPageImage).toHaveBeenCalledWith(
      expect.stringContaining("documents/doc-123/pages/page-123"),
      expect.any(Buffer),
      "image/jpeg"
    );
    expect(prisma.page.update).toHaveBeenCalledWith({
      where: { id: "page-123" },
      data: { blobPath: mockUpdatedPage.blobPath },
    });
  });

  it("should return 401 if no session cookie", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
    } as any);

    const formData = new FormData();
    formData.append("file", new Blob([JPEG_BYTES], { type: "image/jpeg" }), "test.jpg");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("No session found");
  });

  it("should return 401 if session token is invalid", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "invalid-token" }),
    } as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(null);

    const formData = new FormData();
    formData.append("file", new Blob([JPEG_BYTES], { type: "image/jpeg" }), "test.jpg");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Invalid session");
  });

  it("should return 404 if document not found", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-abc",
      noticeAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const formData = new FormData();
    formData.append("file", new Blob([JPEG_BYTES], { type: "image/jpeg" }), "test.jpg");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Document not found");
  });

  it("should return 400 if document is not IN_PROGRESS", async () => {
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
      expiresAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletionState: "ACTIVE",
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);

    const formData = new FormData();
    formData.append("file", new Blob([JPEG_BYTES], { type: "image/jpeg" }), "test.jpg");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("INVALID_DOCUMENT_STATUS");
  });

  it("should return 422 if max pages exceeded", async () => {
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

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.count).mockResolvedValue(10); // Already at max

    const formData = new FormData();
    formData.append("file", new Blob([JPEG_BYTES], { type: "image/jpeg" }), "test.jpg");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(422);
    expect(data.error).toContain("Maximum of 10 pages per document");
    expect(data.code).toBe("MAX_PAGES_EXCEEDED");
  });

  it("should return 400 if no file provided", async () => {
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

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.count).mockResolvedValue(0);

    const formData = new FormData();
    // No file appended

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No file provided");
  });

  it("should return 400 for a file with no recognizable image header", async () => {
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

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.count).mockResolvedValue(0);

    const formData = new FormData();
    formData.append("file", new Blob(["not an image"], { type: "application/zip" }), "test.zip");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("INVALID_FILE_TYPE");
  });

  it("should return 400 for file too large", async () => {
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

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.count).mockResolvedValue(0);

    // Create a large file (11MB), still with a valid JPEG header
    const largeBuffer = new Uint8Array(11 * 1024 * 1024);
    largeBuffer.set(JPEG_BYTES);
    const largeFile = new File([largeBuffer], "large.jpg", { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("file", largeFile);

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("File too large");
  });

  it("should increment page order correctly", async () => {
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

    const mockCreatedPage = {
      id: "page-123",
      documentId: "doc-123",
      order: 5, // 6th page
      status: "PENDING",
      ocrFailureReason: null,
      blobPath: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.count).mockResolvedValue(5); // 5 pages already
    vi.mocked(prisma.page.create).mockResolvedValue(mockCreatedPage as any);
    vi.mocked(prisma.page.update).mockResolvedValue({
      ...mockCreatedPage,
      blobPath: "conditions-translator/documents/doc-123/pages/page-123.jpeg",
    } as any);

    const { uploadPageImage } = await import("@/lib/storage/blob");
    vi.mocked(uploadPageImage).mockResolvedValue({
      pathname: "conditions-translator/documents/doc-123/pages/page-123.jpeg",
      url: "https://example.private.blob.vercel-storage.com/page-123.jpeg",
      contentType: "image/jpeg",
    });

    const formData = new FormData();
    formData.append("file", new Blob([JPEG_BYTES], { type: "image/jpeg" }), "test.jpg");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });

    expect(response.status).toBe(201);
    expect(prisma.page.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        order: 5,
      }),
    });
  });
});
