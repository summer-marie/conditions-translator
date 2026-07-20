/**
 * Server Actions for saving a temporary workspace to an account
 * (`docs/05_Account_Creation_and_Temporary_Access.md`, roadmap Phase 7).
 *
 * Account creation/sign-in happens only when the user chooses to save — temporary use never
 * requires it. The ownership transfer runs *before* the auth cookie is set, so a "signed in"
 * state always implies the workspace was actually transferred. Canceling is pure client
 * navigation (no server action) and leaves the temporary workspace and chat untouched.
 *
 * @module lib/actions/auth
 */

"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { getTemporarySession } from "@/lib/session/temporary";
import { createAuthSession, destroyAuthSession, getCurrentUser } from "@/lib/auth/session";
import {
  createAccount,
  verifyCredentials,
  deleteAccount,
  type CreateAccountInput,
  type SignInInput,
} from "@/lib/auth/account";
import { transferWorkspaceToUser, type TransferResult } from "@/lib/auth/transfer";

/** Return value of the save actions: the signed-in user and what was transferred. */
export interface SaveResult {
  /** The account the workspace now belongs to. */
  userId: string;
  /** Counts of Documents and chat sessions moved to the account. */
  transfer: TransferResult;
}

/**
 * Transfers the request's current temporary workspace to a user, if one exists.
 *
 * @param userId - The destination account.
 * @returns The transfer counts, or zeros when there is no temporary session to move.
 */
async function transferCurrentTemporaryWorkspace(userId: string): Promise<TransferResult> {
  const session = await getTemporarySession();
  if (!session) {
    return { documentCount: 0, chatSessionCount: 0 };
  }
  return transferWorkspaceToUser(session.id, userId);
}

/**
 * Creates an account, transfers the current temporary workspace to it, then signs the user in.
 *
 * @param input - New-account details forwarded to {@link createAccount}.
 * @returns The {@link SaveResult} with the new user id and transfer counts.
 * @throws {AppError} Propagated from account creation (validation, duplicate identifier).
 */
export async function signUpAndSave(input: CreateAccountInput): Promise<SaveResult> {
  const user = await createAccount(input);
  const transfer = await transferCurrentTemporaryWorkspace(user.id);
  await createAuthSession(user.id);

  revalidatePath("/app/workspace");
  revalidatePath("/app/chat");

  return { userId: user.id, transfer };
}

/**
 * Signs in to an existing account and transfers the current temporary workspace to it.
 *
 * @param input - Sign-in credentials forwarded to {@link verifyCredentials}.
 * @returns The {@link SaveResult} with the user id and transfer counts.
 * @throws {AppError} `INVALID_CREDENTIALS` (401) on any authentication failure.
 */
export async function signInAndSave(input: SignInInput): Promise<SaveResult> {
  const user = await verifyCredentials(input);
  if (!user) {
    // One non-revealing message whether the identifier is unknown or the password is wrong,
    // so sign-in can't be used to probe which accounts exist.
    throw new AppError(
      "The email/username or password is incorrect.",
      401,
      "INVALID_CREDENTIALS"
    );
  }

  const transfer = await transferCurrentTemporaryWorkspace(user.id);
  await createAuthSession(user.id);

  revalidatePath("/app/workspace");
  revalidatePath("/app/chat");

  return { userId: user.id, transfer };
}

/**
 * Signs the current user out by clearing the auth session. Saved Documents are untouched.
 *
 * @returns Resolves once the session is destroyed and the workspace path revalidated.
 */
export async function signOut(): Promise<void> {
  await destroyAuthSession();
  revalidatePath("/app/workspace");
}

/**
 * Permanently deletes the signed-in user's account and all owned data, then clears the auth
 * session cookie.
 *
 * See {@link deleteAccount} for the Blob-then-DB deletion ordering and its retry-safe failure
 * behavior: if Blob cleanup fails, this rejects and the account is left intact (and still
 * signed in), so the caller can surface an error and retry.
 *
 * @returns Resolves once the account is deleted and the session cleared.
 * @throws {AppError} `UNAUTHENTICATED` (401) when no user is signed in.
 * @throws {AppError} `BLOB_CLEANUP_FAILED` (502) propagated when stored files can't be deleted.
 */
export async function deleteAccountAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new AppError("You must be signed in to delete your account.", 401, "UNAUTHENTICATED");
  }

  await deleteAccount(user.id);
  await destroyAuthSession(); // Cookie cleanup only — the row is already gone via cascade.

  revalidatePath("/app/workspace");
  revalidatePath("/app/chat");
  revalidatePath("/app/dashboard");
}
