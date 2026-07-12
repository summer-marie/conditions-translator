// Tests for account creation and credential verification (lib/auth/account.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createAccount, verifyCredentials } from "@/lib/auth/account";
import { prisma } from "@/lib/database/prisma";
import { verifyPassword } from "@/lib/auth/password";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    user: { findFirst: vi.fn(), create: vi.fn() },
  },
}));

// Hash with a fast, deterministic stub so account tests don't pay scrypt's cost and can assert
// that a *hashed* (not plaintext) value is persisted. Password hashing itself is tested separately.
vi.mock("@/lib/auth/password", () => ({
  hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
  verifyPassword: vi.fn(),
}));

describe("createAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.user.create).mockImplementation((async (args: any) => ({
      id: "user-1",
      ...args.data,
    })) as any);
  });

  it("creates an email account and stores a HASHED password (never plaintext)", async () => {
    const user = await createAccount({ email: "User@Example.com", password: "password123" });

    const createArgs = vi.mocked(prisma.user.create).mock.calls[0][0] as any;
    expect(createArgs.data.email).toBe("user@example.com"); // normalized
    expect(createArgs.data.username).toBeNull();
    // The persisted value is the hash from lib/auth/password, not the raw password.
    expect(createArgs.data.passwordHash).toBe("hashed:password123");
    expect(user.id).toBe("user-1");
  });

  it("creates a username account", async () => {
    // Username-only with no recovery email requires the acknowledgment (covered separately below).
    await createAccount({
      username: "  parolee42 ",
      password: "password123",
      acknowledgedNoRecovery: true,
    });
    const createArgs = vi.mocked(prisma.user.create).mock.calls[0][0] as any;
    expect(createArgs.data.username).toBe("parolee42"); // trimmed
    expect(createArgs.data.email).toBeNull();
  });

  it("requires at least an email or a username", async () => {
    await expect(createAccount({ password: "password123" })).rejects.toMatchObject({
      code: "IDENTIFIER_REQUIRED",
    });
  });

  it("rejects an invalid email", async () => {
    await expect(
      createAccount({ email: "not-an-email", password: "password123" })
    ).rejects.toMatchObject({ code: "INVALID_EMAIL" });
  });

  it("rejects a password shorter than the minimum", async () => {
    await expect(
      createAccount({ email: "a@b.com", password: "short" })
    ).rejects.toMatchObject({ code: "WEAK_PASSWORD" });
  });

  it("requires acknowledgment for a username-only account with no recovery email", async () => {
    await expect(
      createAccount({ username: "solo", password: "password123" })
    ).rejects.toMatchObject({ code: "RECOVERY_ACK_REQUIRED" });
  });

  it("allows a username-only account once the no-recovery warning is acknowledged", async () => {
    const user = await createAccount({
      username: "solo",
      password: "password123",
      acknowledgedNoRecovery: true,
    });
    expect(user.id).toBe("user-1");
  });

  it("allows a username-only account when a recovery email is provided", async () => {
    await createAccount({
      username: "solo",
      password: "password123",
      recoveryEmail: "backup@example.com",
    });
    const createArgs = vi.mocked(prisma.user.create).mock.calls[0][0] as any;
    expect(createArgs.data.recoveryEmail).toBe("backup@example.com");
  });

  it("rejects a duplicate email with a clear code", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      email: "taken@example.com",
      username: null,
    } as any);

    await expect(
      createAccount({ email: "taken@example.com", password: "password123" })
    ).rejects.toMatchObject({ code: "EMAIL_TAKEN" });
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects a duplicate username with a clear code", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      email: null,
      username: "taken",
    } as any);

    await expect(
      createAccount({ username: "taken", password: "password123", acknowledgedNoRecovery: true })
    ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
  });
});

describe("verifyCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for an unknown identifier (no user found)", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue(null);
    const user = await verifyCredentials({ identifier: "ghost@example.com", password: "x" });
    expect(user).toBeNull();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it("returns null when the password does not match", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "user-1",
      passwordHash: "hashed:right",
    } as any);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    const user = await verifyCredentials({ identifier: "a@b.com", password: "wrong" });
    expect(user).toBeNull();
  });

  it("returns the user on a correct password", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: "user-1",
      passwordHash: "hashed:right",
    } as any);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    const user = await verifyCredentials({ identifier: "a@b.com", password: "right" });
    expect(user?.id).toBe("user-1");
  });

  it("returns null for empty input without hitting the database", async () => {
    expect(await verifyCredentials({ identifier: "", password: "x" })).toBeNull();
    expect(await verifyCredentials({ identifier: "a@b.com", password: "" })).toBeNull();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });
});
