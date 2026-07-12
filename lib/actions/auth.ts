// Server Actions for saving a temporary workspace to an account
// (docs/05_Account_Creation_and_Temporary_Access.md, docs/08 roadmap Phase 7).
//
// Account creation/sign-in is triggered only when the user chooses to save — temporary use never
// requires it. On success we run the atomic ownership transfer and only then set the auth cookie,
// so a "signed in" state always implies the workspace was actually transferred. Canceling is pure
// client navigation (no server action) and leaves the temporary workspace and chat untouched.

"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@/lib/errors";
import { getTemporarySession } from "@/lib/session/temporary";
import { createAuthSession, destroyAuthSession } from "@/lib/auth/session";
import {
  createAccount,
  verifyCredentials,
  type CreateAccountInput,
  type SignInInput,
} from "@/lib/auth/account";
import { transferWorkspaceToUser, type TransferResult } from "@/lib/auth/transfer";

export interface SaveResult {
  userId: string;
  transfer: TransferResult;
}

async function transferCurrentTemporaryWorkspace(userId: string): Promise<TransferResult> {
  const session = await getTemporarySession();
  if (!session) {
    return { documentCount: 0, chatSessionCount: 0 };
  }
  return transferWorkspaceToUser(session.id, userId);
}

/** Creates an account, transfers the current temporary workspace to it, then signs the user in. */
export async function signUpAndSave(input: CreateAccountInput): Promise<SaveResult> {
  const user = await createAccount(input);
  const transfer = await transferCurrentTemporaryWorkspace(user.id);
  await createAuthSession(user.id);

  revalidatePath("/app/workspace");
  revalidatePath("/app/chat");

  return { userId: user.id, transfer };
}

/** Signs in to an existing account and transfers the current temporary workspace to it. */
export async function signInAndSave(input: SignInInput): Promise<SaveResult> {
  const user = await verifyCredentials(input);
  if (!user) {
    // Single non-revealing message whether the identifier is unknown or the password is wrong.
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

/** Signs the current user out (clears the auth session). Does not touch saved Documents. */
export async function signOut(): Promise<void> {
  await destroyAuthSession();
  revalidatePath("/app/workspace");
}
