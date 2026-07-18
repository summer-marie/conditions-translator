// Tests for temporary session management.

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getOrCreateTemporarySession,
  getTemporarySession,
  isPrivacyAccepted,
  acceptPrivacyNotice,
} from "@/lib/session/temporary";
import { prisma } from "@/lib/database/prisma";

// Mock Prisma
vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    temporarySession: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

describe("getOrCreateTemporarySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null if user is authenticated", async () => {
    const result = await getOrCreateTemporarySession(true);
    expect(result).toBeNull();
    expect(prisma.temporarySession.findUnique).not.toHaveBeenCalled();
    expect(prisma.temporarySession.create).not.toHaveBeenCalled();
  });

  it("should create a new session if no cookie exists", async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue(null),
      set: vi.fn(),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    const mockSession = {
      id: "session-123",
      token: "token-abc",
      noticeAcceptedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    vi.mocked(prisma.temporarySession.create).mockResolvedValue(mockSession as any);

    const result = await getOrCreateTemporarySession(false);

    expect(result).toEqual(mockSession);
    expect(prisma.temporarySession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        token: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "tmp_session",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        path: "/",
      })
    );
  });

  it("should return existing session if valid cookie exists", async () => {
    const existingToken = "existing-token-xyz";
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: existingToken }),
      set: vi.fn(),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    const mockSession = {
      id: "session-456",
      token: existingToken,
      noticeAcceptedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);

    const result = await getOrCreateTemporarySession(false);

    expect(result).toEqual(mockSession);
    expect(prisma.temporarySession.findUnique).toHaveBeenCalledWith({
      where: { token: existingToken },
    });
    expect(prisma.temporarySession.create).not.toHaveBeenCalled();
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });

  it("should create new session if existing token is expired", async () => {
    const expiredToken = "expired-token";
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: expiredToken }),
      set: vi.fn(),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    const expiredSession = {
      id: "session-789",
      token: expiredToken,
      noticeAcceptedAt: null,
      expiresAt: new Date(Date.now() - 1000), // Expired
    };

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(expiredSession as any);

    const newSession = {
      id: "session-new",
      token: "new-token",
      noticeAcceptedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    vi.mocked(prisma.temporarySession.create).mockResolvedValue(newSession as any);

    const result = await getOrCreateTemporarySession(false);

    expect(result).toEqual(newSession);
    expect(prisma.temporarySession.create).toHaveBeenCalled();
    expect(mockCookieStore.set).toHaveBeenCalled();
  });

  it("should create new session if existing token is invalid", async () => {
    const invalidToken = "invalid-token";
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: invalidToken }),
      set: vi.fn(),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(null);

    const newSession = {
      id: "session-new",
      token: "new-token",
      noticeAcceptedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    vi.mocked(prisma.temporarySession.create).mockResolvedValue(newSession as any);

    const result = await getOrCreateTemporarySession(false);

    expect(result).toEqual(newSession);
    expect(prisma.temporarySession.create).toHaveBeenCalled();
    expect(mockCookieStore.set).toHaveBeenCalled();
  });
});

describe("getTemporarySession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return null if user is authenticated", async () => {
    const result = await getTemporarySession(true);
    expect(result).toBeNull();
  });

  it("should return null if no cookie exists", async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue(null),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    const result = await getTemporarySession(false);

    expect(result).toBeNull();
    expect(prisma.temporarySession.findUnique).not.toHaveBeenCalled();
  });

  it("should return null if session not found", async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: "token-xyz" }),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(null);

    const result = await getTemporarySession(false);

    expect(result).toBeNull();
  });

  it("should return null if session is expired", async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: "token-xyz" }),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    const expiredSession = {
      id: "session-123",
      token: "token-xyz",
      noticeAcceptedAt: null,
      expiresAt: new Date(Date.now() - 1000),
    };

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(expiredSession as any);

    const result = await getTemporarySession(false);

    expect(result).toBeNull();
  });

  it("should return valid session", async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: "token-xyz" }),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    const validSession = {
      id: "session-123",
      token: "token-xyz",
      noticeAcceptedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(validSession as any);

    const result = await getTemporarySession(false);

    expect(result).toEqual(validSession);
  });
});

describe("isPrivacyAccepted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return true if user is authenticated", async () => {
    const result = await isPrivacyAccepted(true);
    expect(result).toBe(true);
  });

  it("should return true if privacy notice has been accepted", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-xyz",
      noticeAcceptedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: "token-xyz" }),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);

    const result = await isPrivacyAccepted(false);

    expect(result).toBe(true);
  });

  it("should return false if privacy notice has not been accepted", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-xyz",
      noticeAcceptedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: "token-xyz" }),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);

    const result = await isPrivacyAccepted(false);

    expect(result).toBe(false);
  });

  it("should return false if no session exists", async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue(null),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    const result = await isPrivacyAccepted(false);

    expect(result).toBe(false);
  });
});

describe("acceptPrivacyNotice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should update session with privacy accepted timestamp", async () => {
    const mockSession = {
      id: "session-123",
      token: "token-xyz",
      noticeAcceptedAt: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: "token-xyz" }),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);

    vi.mocked(prisma.temporarySession.update).mockResolvedValue({
      ...mockSession,
      noticeAcceptedAt: new Date(),
    } as any);

    await acceptPrivacyNotice();

    expect(prisma.temporarySession.update).toHaveBeenCalledWith({
      where: { id: "session-123" },
      data: { noticeAcceptedAt: expect.any(Date) },
    });
  });

  it("should throw error if no session found", async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue(null),
    };

    const { cookies } = await import("next/headers");
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);

    await expect(acceptPrivacyNotice()).rejects.toThrow("No temporary session found");
  });
});