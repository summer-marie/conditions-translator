// Tests for the Phase 9 cleanup sweep (docs/08 Phase 9, docs/09 Coding Risk Register R-002).
//
// Covers: expired ChatSession deletion (any owner), expired TemporarySession scanning, reuse of
// the existing deleteDocument pipeline per Document, retry-safety (a session stays undeleted
// while any Document cleanup is still pending), and the zero-Document case.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  sweepExpiredChatSessions,
  sweepExpiredTemporarySessions,
  runCleanupSweep,
} from "@/lib/cleanup/sweep";
import { prisma } from "@/lib/database/prisma";
import { deleteDocument } from "@/lib/documents/deletion";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    chatSession: {
      deleteMany: vi.fn(),
    },
    temporarySession: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/documents/deletion", () => ({
  deleteDocument: vi.fn(),
}));

describe("sweepExpiredChatSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes every ChatSession whose expiresAt has passed, regardless of owner", async () => {
    vi.mocked(prisma.chatSession.deleteMany).mockResolvedValue({ count: 3 });

    const count = await sweepExpiredChatSessions();

    expect(count).toBe(3);
    expect(prisma.chatSession.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });
});

describe("sweepExpiredTemporarySessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("does nothing when no TemporarySession has expired", async () => {
    vi.mocked(prisma.temporarySession.findMany).mockResolvedValue([]);

    const result = await sweepExpiredTemporarySessions();

    expect(result).toEqual({
      scanned: 0,
      sessionsDeleted: 0,
      documentsCleanedUp: 0,
      documentsPendingRetry: 0,
    });
    expect(prisma.document.findMany).not.toHaveBeenCalled();
    expect(prisma.temporarySession.deleteMany).not.toHaveBeenCalled();
  });

  it("hard-deletes an expired session with no remaining Documents", async () => {
    vi.mocked(prisma.temporarySession.findMany).mockResolvedValue([
      { id: "session-1" },
    ] as any);
    vi.mocked(prisma.document.findMany).mockResolvedValue([]);
    vi.mocked(prisma.temporarySession.deleteMany).mockResolvedValue({ count: 1 });

    const result = await sweepExpiredTemporarySessions();

    expect(result).toEqual({
      scanned: 1,
      sessionsDeleted: 1,
      documentsCleanedUp: 0,
      documentsPendingRetry: 0,
    });
    expect(prisma.temporarySession.deleteMany).toHaveBeenCalledWith({
      where: { id: "session-1" },
    });
  });

  it("cleans up every ACTIVE/DELETE_PENDING Document via deleteDocument, then deletes the session", async () => {
    vi.mocked(prisma.temporarySession.findMany).mockResolvedValue([
      { id: "session-1" },
    ] as any);
    vi.mocked(prisma.document.findMany).mockResolvedValue([
      { id: "doc-1" },
      { id: "doc-2" },
    ] as any);
    vi.mocked(deleteDocument).mockResolvedValue({
      document: { deletionState: "DELETED" } as any,
      cleanupComplete: true,
    });
    vi.mocked(prisma.temporarySession.deleteMany).mockResolvedValue({ count: 1 });

    const result = await sweepExpiredTemporarySessions();

    expect(deleteDocument).toHaveBeenCalledTimes(2);
    expect(deleteDocument).toHaveBeenCalledWith(
      { kind: "temporary", temporarySessionId: "session-1" },
      "doc-1"
    );
    expect(result.documentsCleanedUp).toBe(2);
    expect(result.documentsPendingRetry).toBe(0);
    expect(result.sessionsDeleted).toBe(1);
  });

  it("leaves the session row in place when a Document's Blob cleanup is still pending", async () => {
    vi.mocked(prisma.temporarySession.findMany).mockResolvedValue([
      { id: "session-1" },
    ] as any);
    vi.mocked(prisma.document.findMany).mockResolvedValue([{ id: "doc-1" }] as any);
    vi.mocked(deleteDocument).mockResolvedValue({
      document: { deletionState: "DELETE_PENDING" } as any,
      cleanupComplete: false,
    });

    const result = await sweepExpiredTemporarySessions();

    expect(result.documentsPendingRetry).toBe(1);
    expect(result.sessionsDeleted).toBe(0);
    expect(prisma.temporarySession.deleteMany).not.toHaveBeenCalled();
  });

  it("does not delete the session if a Document cleanup throws unexpectedly", async () => {
    vi.mocked(prisma.temporarySession.findMany).mockResolvedValue([
      { id: "session-1" },
    ] as any);
    vi.mocked(prisma.document.findMany).mockResolvedValue([{ id: "doc-1" }] as any);
    vi.mocked(deleteDocument).mockRejectedValue(new Error("unexpected failure"));

    const result = await sweepExpiredTemporarySessions();

    expect(result.sessionsDeleted).toBe(0);
    expect(prisma.temporarySession.deleteMany).not.toHaveBeenCalled();
  });
});

describe("runCleanupSweep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("combines both sweeps into one summary", async () => {
    vi.mocked(prisma.chatSession.deleteMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.temporarySession.findMany).mockResolvedValue([]);

    const result = await runCleanupSweep();

    expect(result).toEqual({
      expiredChatSessionsDeleted: 2,
      expiredTemporarySessionsScanned: 0,
      temporarySessionsDeleted: 0,
      documentsCleanedUp: 0,
      documentsPendingRetry: 0,
    });
  });
});
