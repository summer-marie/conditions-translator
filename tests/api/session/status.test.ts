// Tests for GET /api/session/status, including the chatDisclaimerAcknowledged flag added
// alongside the existing privacyAccepted flag. The two are intentionally independent —
// see lib/session/chatDisclaimer.ts's module docstring for why they're not the same gate.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "@/app/api/session/status/route";
import { getTemporarySession, isPrivacyAccepted } from "@/lib/session/temporary";
import { isChatDisclaimerAcknowledged } from "@/lib/session/chatDisclaimer";
import { getCurrentUser } from "@/lib/auth/session";

vi.mock("@/lib/session/temporary", () => ({
  getTemporarySession: vi.fn(),
  isPrivacyAccepted: vi.fn(),
}));

vi.mock("@/lib/session/chatDisclaimer", () => ({
  isChatDisclaimerAcknowledged: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(),
}));

describe("GET /api/session/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports a signed-in user's own chat-disclaimer acknowledgment", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);
    vi.mocked(isChatDisclaimerAcknowledged).mockResolvedValue(true);

    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({
      privacyAccepted: true,
      chatDisclaimerAcknowledged: true,
      sessionId: null,
      userId: "user-1",
    });
    expect(isChatDisclaimerAcknowledged).toHaveBeenCalledWith({ kind: "user", userId: "user-1" });
  });

  it("reports false for a signed-in user who has not yet acknowledged", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1" } as any);
    vi.mocked(isChatDisclaimerAcknowledged).mockResolvedValue(false);

    const response = await GET();
    const data = await response.json();

    expect(data.chatDisclaimerAcknowledged).toBe(false);
  });

  it("reports a temporary session's own chat-disclaimer acknowledgment", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(isPrivacyAccepted).mockResolvedValue(true);
    vi.mocked(getTemporarySession).mockResolvedValue({ id: "session-1" } as any);
    vi.mocked(isChatDisclaimerAcknowledged).mockResolvedValue(true);

    const response = await GET();
    const data = await response.json();

    expect(data).toEqual({
      privacyAccepted: true,
      chatDisclaimerAcknowledged: true,
      sessionId: "session-1",
      userId: null,
    });
    expect(isChatDisclaimerAcknowledged).toHaveBeenCalledWith({
      kind: "temporary",
      temporarySessionId: "session-1",
    });
  });

  it("reports false without querying when there is no temporary session yet", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    vi.mocked(isPrivacyAccepted).mockResolvedValue(false);
    vi.mocked(getTemporarySession).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(data.chatDisclaimerAcknowledged).toBe(false);
    expect(isChatDisclaimerAcknowledged).not.toHaveBeenCalled();
  });
});
