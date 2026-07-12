// Tests for GET /api/documents/[documentId]: ownership-scoped fetch of a document plus its
// generated sections, used by the workspace UI to refresh state after Finish Document / Retry.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/documents/[documentId]/route";
import { prisma } from "@/lib/database/prisma";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    temporarySession: {
      findUnique: vi.fn(),
    },
    document: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("GET /api/documents/[documentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the document with its ordered sections when owned by the caller", async () => {
    const mockSession = { id: "session-123", token: "token-abc" };
    const mockDocument = {
      id: "doc-123",
      title: "Test Document",
      status: "READY",
      temporarySessionId: "session-123",
      sections: [
        { id: "section-1", heading: "Reporting", body: "Report monthly.", order: 0, sources: [{ pageId: "page-1" }] },
      ],
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);
    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);

    const request = new Request("http://localhost/api/documents/doc-123");
    const response = await GET(request, { params: { documentId: "doc-123" } });
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

  it("returns 404 when the document does not belong to the caller's session", async () => {
    const mockSession = { id: "session-123", token: "token-abc" };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "token-abc" }),
    } as any);
    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const request = new Request("http://localhost/api/documents/doc-999");
    const response = await GET(request, { params: { documentId: "doc-999" } });

    expect(response.status).toBe(404);
  });

  it("returns 401 when there is no session cookie", async () => {
    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    } as any);

    const request = new Request("http://localhost/api/documents/doc-123");
    const response = await GET(request, { params: { documentId: "doc-123" } });

    expect(response.status).toBe(401);
  });
});
