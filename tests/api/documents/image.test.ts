// Tests for GET /api/documents/[documentId]/pages/[pageId]/image: owner-aware page image
// streaming (docs/03_OCR_Specifications.md §4.3 preview).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/documents/[documentId]/pages/[pageId]/image/route";
import { prisma } from "@/lib/database/prisma";
import { getCurrentOwner } from "@/lib/auth/session";
import { readPageImage } from "@/lib/storage/blob";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    document: {
      findFirst: vi.fn(),
    },
    page: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentOwner: vi.fn(),
}));

vi.mock("@/lib/storage/blob", () => ({
  readPageImage: vi.fn(),
}));

describe("GET /api/documents/[documentId]/pages/[pageId]/image", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("streams the image for a temporary-session owner", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue({
      kind: "temporary",
      temporarySessionId: "session-123",
    });
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      temporarySessionId: "session-123",
      deletionState: "ACTIVE",
    } as any);
    vi.mocked(prisma.page.findFirst).mockResolvedValue({
      id: "page-1",
      blobPath: "conditions-translator/documents/doc-123/pages/page-1.jpeg",
    } as any);
    vi.mocked(readPageImage).mockResolvedValue({
      buffer: Buffer.from("fake-image-bytes"),
      contentType: "image/jpeg",
    });

    const request = new Request(
      "http://localhost/api/documents/doc-123/pages/page-1/image"
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: "doc-123", pageId: "page-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("streams the image for a signed-in user owner", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue({ kind: "user", userId: "user-123" });
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      userId: "user-123",
      deletionState: "ACTIVE",
    } as any);
    vi.mocked(prisma.page.findFirst).mockResolvedValue({
      id: "page-1",
      blobPath: "conditions-translator/documents/doc-123/pages/page-1.jpeg",
    } as any);
    vi.mocked(readPageImage).mockResolvedValue({
      buffer: Buffer.from("fake-image-bytes"),
      contentType: "image/jpeg",
    });

    const request = new Request(
      "http://localhost/api/documents/doc-123/pages/page-1/image"
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: "doc-123", pageId: "page-1" }),
    });

    expect(response.status).toBe(200);
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: { id: "doc-123", userId: "user-123", deletionState: "ACTIVE" },
    });
  });

  it("returns 404 when the document is not owned by the caller", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue({
      kind: "temporary",
      temporarySessionId: "session-123",
    });
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/documents/doc-999/pages/page-1/image"
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: "doc-999", pageId: "page-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for a deleted document even though the caller is the owner", async () => {
    // getOwnedDocument excludes deletionState != ACTIVE, so a DELETE_PENDING/DELETED document
    // is indistinguishable from "not found" here — this is the guard, exercised at the mock
    // boundary (the real filtering is covered by tests/schema/ownership.test.ts against a live DB).
    vi.mocked(getCurrentOwner).mockResolvedValue({
      kind: "temporary",
      temporarySessionId: "session-123",
    });
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/documents/doc-123/pages/page-1/image"
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: "doc-123", pageId: "page-1" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 401 when there is no active session or signed-in user", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(null);

    const request = new Request(
      "http://localhost/api/documents/doc-123/pages/page-1/image"
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: "doc-123", pageId: "page-1" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when the page has no stored image", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue({
      kind: "temporary",
      temporarySessionId: "session-123",
    });
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-123",
      temporarySessionId: "session-123",
      deletionState: "ACTIVE",
    } as any);
    vi.mocked(prisma.page.findFirst).mockResolvedValue({ id: "page-1", blobPath: null } as any);

    const request = new Request(
      "http://localhost/api/documents/doc-123/pages/page-1/image"
    );
    const response = await GET(request, {
      params: Promise.resolve({ documentId: "doc-123", pageId: "page-1" }),
    });

    expect(response.status).toBe(404);
  });
});
