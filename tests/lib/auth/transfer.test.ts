// Tests for atomic ownership transfer (lib/auth/transfer.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { transferWorkspaceToUser } from "@/lib/auth/transfer";
import { prisma } from "@/lib/database/prisma";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    document: { updateMany: vi.fn() },
    chatSession: { updateMany: vi.fn() },
    // Array form: run the batched operations together, mirroring a real transaction.
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

describe("transferWorkspaceToUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 2 } as any);
    vi.mocked(prisma.chatSession.updateMany).mockResolvedValue({ count: 1 } as any);
  });

  it("runs both moves inside a single $transaction", async () => {
    await transferWorkspaceToUser("temp-1", "user-1");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const ops = vi.mocked(prisma.$transaction).mock.calls[0][0] as unknown as unknown[];
    expect(ops).toHaveLength(2);
  });

  it("switches Documents to the user, clears the temp owner, and clears expiry in one update", async () => {
    await transferWorkspaceToUser("temp-1", "user-1");

    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { temporarySessionId: "temp-1", deletionState: "ACTIVE" },
      data: { userId: "user-1", temporarySessionId: null, expiresAt: null },
    });
  });

  it("moves ChatSessions to the user but does NOT clear their expiry (chat stays temporary)", async () => {
    await transferWorkspaceToUser("temp-1", "user-1");

    const chatArgs = vi.mocked(prisma.chatSession.updateMany).mock.calls[0][0] as any;
    expect(chatArgs.where).toEqual({ temporarySessionId: "temp-1" });
    expect(chatArgs.data).toEqual({ userId: "user-1", temporarySessionId: null });
    expect(chatArgs.data).not.toHaveProperty("expiresAt");
  });

  it("returns the moved-record counts", async () => {
    const result = await transferWorkspaceToUser("temp-1", "user-1");
    expect(result).toEqual({ documentCount: 2, chatSessionCount: 1 });
  });

  it("is a harmless no-op when the temporary session owns nothing (idempotent)", async () => {
    vi.mocked(prisma.document.updateMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.chatSession.updateMany).mockResolvedValue({ count: 0 } as any);

    const result = await transferWorkspaceToUser("temp-already-moved", "user-1");
    expect(result).toEqual({ documentCount: 0, chatSessionCount: 0 });
  });
});
