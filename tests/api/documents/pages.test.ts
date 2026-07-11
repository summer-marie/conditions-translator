// Tests for page upload API route with 10-page limit enforcement.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/documents/[documentId]/pages/route";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";

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
    },
  },
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

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

    const mockPage = {
      id: "page-123",
      documentId: "doc-123",
      order: 0,
      blobPath: "documents/doc-123/test.jpg",
      accepted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.count).mockResolvedValue(0);
    vi.mocked(prisma.page.create).mockResolvedValue(mockPage as any);

    const formData = new FormData();
    formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.page).toMatchObject({
      id: mockPage.id,
      documentId: mockPage.documentId,
      order: mockPage.order,
      blobPath: mockPage.blobPath,
      accepted: mockPage.accepted,
    });
    expect(prisma.page.create).toHaveBeenCalledWith({
      data: {
        documentId: "doc-123",
        order: 0,
        blobPath: expect.stringContaining("documents/doc-123/"),
      },
    });
  });

  it("should return 401 if no session cookie", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(null),
    } as any);

    const formData = new FormData();
    formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");

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
    formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");

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
    formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe("Document not found");
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
    formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");

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

  it("should return 400 for invalid file type", async () => {
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
    formData.append("file", new Blob(["test"], { type: "application/zip" }), "test.zip");

    const request = new Request("http://localhost/api/documents/doc-123/pages", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request, { params: { documentId: "doc-123" } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Invalid file type");
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

    // Create a large file (11MB)
    const largeBuffer = new ArrayBuffer(11 * 1024 * 1024);
    const largeBlob = new Blob([largeBuffer], { type: "image/jpeg" });
    const largeFile = new File([largeBlob], "large.jpg", { type: "image/jpeg" });

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

    const mockPage = {
      id: "page-123",
      documentId: "doc-123",
      order: 5, // 6th page
      blobPath: "documents/doc-123/test.jpg",
      accepted: false,
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
    vi.mocked(prisma.page.create).mockResolvedValue(mockPage as any);

    const formData = new FormData();
    formData.append("file", new Blob(["test"], { type: "image/jpeg" }), "test.jpg");

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