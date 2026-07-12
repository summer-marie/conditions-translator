// Tests for the save-workspace Server Actions (lib/actions/auth.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { signUpAndSave, signInAndSave, signOut } from "@/lib/actions/auth";
import { createAccount, verifyCredentials } from "@/lib/auth/account";
import { createAuthSession, destroyAuthSession } from "@/lib/auth/session";
import { transferWorkspaceToUser } from "@/lib/auth/transfer";
import { getTemporarySession } from "@/lib/session/temporary";

vi.mock("@/lib/auth/account", () => ({
  createAccount: vi.fn(),
  verifyCredentials: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
  createAuthSession: vi.fn(),
  destroyAuthSession: vi.fn(),
}));
vi.mock("@/lib/auth/transfer", () => ({
  transferWorkspaceToUser: vi.fn(),
}));
vi.mock("@/lib/session/temporary", () => ({
  getTemporarySession: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const tempSession = { id: "temp-1" };

describe("signUpAndSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAccount).mockResolvedValue({ id: "user-1" } as any);
    vi.mocked(getTemporarySession).mockResolvedValue(tempSession as any);
    vi.mocked(transferWorkspaceToUser).mockResolvedValue({ documentCount: 2, chatSessionCount: 1 });
  });

  it("creates the account, transfers the current temporary workspace, then signs the user in", async () => {
    const result = await signUpAndSave({ email: "a@b.com", password: "password123" });

    expect(createAccount).toHaveBeenCalledWith({ email: "a@b.com", password: "password123" });
    expect(transferWorkspaceToUser).toHaveBeenCalledWith("temp-1", "user-1");
    expect(createAuthSession).toHaveBeenCalledWith("user-1");
    expect(result).toEqual({ userId: "user-1", transfer: { documentCount: 2, chatSessionCount: 1 } });
  });

  it("still signs in with a zero-count transfer when there is no temporary session", async () => {
    vi.mocked(getTemporarySession).mockResolvedValue(null);

    const result = await signUpAndSave({ email: "a@b.com", password: "password123" });

    expect(transferWorkspaceToUser).not.toHaveBeenCalled();
    expect(createAuthSession).toHaveBeenCalledWith("user-1");
    expect(result.transfer).toEqual({ documentCount: 0, chatSessionCount: 0 });
  });

  it("does not sign in or transfer if account creation fails (no partial save)", async () => {
    vi.mocked(createAccount).mockRejectedValue(
      Object.assign(new Error("taken"), { code: "EMAIL_TAKEN" })
    );

    await expect(signUpAndSave({ email: "a@b.com", password: "password123" })).rejects.toMatchObject({
      code: "EMAIL_TAKEN",
    });
    expect(transferWorkspaceToUser).not.toHaveBeenCalled();
    expect(createAuthSession).not.toHaveBeenCalled();
  });
});

describe("signInAndSave", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getTemporarySession).mockResolvedValue(tempSession as any);
    vi.mocked(transferWorkspaceToUser).mockResolvedValue({ documentCount: 1, chatSessionCount: 0 });
  });

  it("rejects invalid credentials with a single non-revealing error and no side effects", async () => {
    vi.mocked(verifyCredentials).mockResolvedValue(null);

    await expect(
      signInAndSave({ identifier: "a@b.com", password: "wrong" })
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });

    expect(transferWorkspaceToUser).not.toHaveBeenCalled();
    expect(createAuthSession).not.toHaveBeenCalled();
  });

  it("transfers the workspace and signs in on valid credentials", async () => {
    vi.mocked(verifyCredentials).mockResolvedValue({ id: "user-9" } as any);

    const result = await signInAndSave({ identifier: "a@b.com", password: "right" });

    expect(transferWorkspaceToUser).toHaveBeenCalledWith("temp-1", "user-9");
    expect(createAuthSession).toHaveBeenCalledWith("user-9");
    expect(result.userId).toBe("user-9");
  });
});

describe("signOut", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears the auth session", async () => {
    await signOut();
    expect(destroyAuthSession).toHaveBeenCalled();
  });
});
