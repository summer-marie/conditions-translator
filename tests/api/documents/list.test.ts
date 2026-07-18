// Tests for GET /api/documents (the dashboard/workspace document list). This route needs a
// Document include (_count.pages, sections) that the shared listOwnedDocuments() helper doesn't
// support, so it duplicates listOwnedDocuments' where-clause shape directly rather than calling
// it (see app/api/documents/route.ts and lib/permissions/ownership.ts). These tests exist because
// that duplication means fixing the shared helper alone would not fix this route.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/documents/route";
import { prisma } from "@/lib/database/prisma";
import { getCurrentOwner } from "@/lib/auth/session";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentOwner: vi.fn(),
}));

const temporaryOwner = { kind: "temporary" as const, temporarySessionId: "session-123" };
const userOwnerFixture = { kind: "user" as const, userId: "user-123" };

describe("GET /api/documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scopes the list to the temporary session and excludes expired documents", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(temporaryOwner);
    vi.mocked(prisma.document.findMany).mockResolvedValue([{ id: "doc-1" }] as any);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.documents).toEqual([{ id: "doc-1" }]);
    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        temporarySessionId: "session-123",
        deletionState: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      include: expect.any(Object),
      orderBy: { createdAt: "desc" },
    });
  });

  it("scopes the list by userId for a signed-in user (saved documents never expire)", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(userOwnerFixture);
    vi.mocked(prisma.document.findMany).mockResolvedValue([] as any);

    await GET();

    expect(prisma.document.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-123",
        deletionState: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      include: expect.any(Object),
      orderBy: { createdAt: "desc" },
    });
  });

  it("returns 401 when there is no active session or signed-in user", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });
});
