// Tests for chat-specific disclaimer acknowledgment (lib/session/chatDisclaimer.ts).
//
// Deliberately separate from the privacy-notice tests (tests/lib/session/temporary.test.ts):
// this covers a distinct flag (chatDisclaimerAcknowledgedAt) on both User and TemporarySession,
// scoped to chat use only.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isChatDisclaimerAcknowledged,
  acknowledgeChatDisclaimer,
  requireChatDisclaimerAcknowledged,
} from "@/lib/session/chatDisclaimer";
import { userOwner, temporaryOwner } from "@/lib/permissions/ownership";
import { prisma } from "@/lib/database/prisma";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    temporarySession: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

describe("isChatDisclaimerAcknowledged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true for a user who has already acknowledged", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      chatDisclaimerAcknowledgedAt: new Date(),
    } as any);

    const result = await isChatDisclaimerAcknowledged(userOwner("user-1"));

    expect(result).toBe(true);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { chatDisclaimerAcknowledgedAt: true },
    });
  });

  it("returns false for a user who has not acknowledged", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      chatDisclaimerAcknowledgedAt: null,
    } as any);

    const result = await isChatDisclaimerAcknowledged(userOwner("user-1"));

    expect(result).toBe(false);
  });

  it("returns true for a temporary session that has already acknowledged", async () => {
    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue({
      chatDisclaimerAcknowledgedAt: new Date(),
    } as any);

    const result = await isChatDisclaimerAcknowledged(temporaryOwner("session-1"));

    expect(result).toBe(true);
    expect(prisma.temporarySession.findUnique).toHaveBeenCalledWith({
      where: { id: "session-1" },
      select: { chatDisclaimerAcknowledgedAt: true },
    });
  });

  it("returns false for a temporary session that has not acknowledged", async () => {
    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue({
      chatDisclaimerAcknowledgedAt: null,
    } as any);

    const result = await isChatDisclaimerAcknowledged(temporaryOwner("session-1"));

    expect(result).toBe(false);
  });

  it("returns false when the owner row cannot be found", async () => {
    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(null);

    const result = await isChatDisclaimerAcknowledged(temporaryOwner("missing-session"));

    expect(result).toBe(false);
  });
});

describe("acknowledgeChatDisclaimer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stamps chatDisclaimerAcknowledgedAt on the User row for a signed-in owner", async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({} as any);

    await acknowledgeChatDisclaimer(userOwner("user-1"));

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { chatDisclaimerAcknowledgedAt: expect.any(Date) },
    });
    expect(prisma.temporarySession.update).not.toHaveBeenCalled();
  });

  it("stamps chatDisclaimerAcknowledgedAt on the TemporarySession row for a temporary owner", async () => {
    vi.mocked(prisma.temporarySession.update).mockResolvedValue({} as any);

    await acknowledgeChatDisclaimer(temporaryOwner("session-1"));

    expect(prisma.temporarySession.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: { chatDisclaimerAcknowledgedAt: expect.any(Date) },
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe("requireChatDisclaimerAcknowledged", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves silently when already acknowledged", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      chatDisclaimerAcknowledgedAt: new Date(),
    } as any);

    await expect(requireChatDisclaimerAcknowledged(userOwner("user-1"))).resolves.toBeUndefined();
  });

  it("throws CHAT_DISCLAIMER_NOT_ACKNOWLEDGED when not yet acknowledged", async () => {
    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue({
      chatDisclaimerAcknowledgedAt: null,
    } as any);

    await expect(
      requireChatDisclaimerAcknowledged(temporaryOwner("session-1"))
    ).rejects.toMatchObject({
      code: "CHAT_DISCLAIMER_NOT_ACKNOWLEDGED",
      statusCode: 403,
    });
  });
});
