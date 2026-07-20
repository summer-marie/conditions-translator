/**
 * Account creation and credential verification for saved accounts
 * (`docs/05_Account_Creation_and_Temporary_Access.md`, roadmap Phase 7).
 *
 * The MVP supports email+password and/or username+password. Passwords are hashed with
 * scrypt (see `lib/auth/password.ts`). This module owns only validation and persistence;
 * the auth-session cookie lives separately in `lib/auth/session.ts`.
 *
 * @module lib/auth/account
 */

import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { deletePageImage } from "@/lib/storage/blob";

/** Minimum accepted password length, in characters. */
const MIN_PASSWORD_LENGTH = 8;
/** Pragmatic email shape check — presence of local/domain parts, not full RFC validation. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Fields accepted when creating a new account via {@link createAccount}. */
export interface CreateAccountInput {
  /** Primary email identifier. At least one of `email`/`username` is required. */
  email?: string | null;
  /** Username identifier. At least one of `email`/`username` is required. */
  username?: string | null;
  /** Plaintext password; must be at least {@link MIN_PASSWORD_LENGTH} characters. */
  password: string;
  /** Optional email used only for account recovery. */
  recoveryEmail?: string | null;
  /**
   * Required acknowledgment when creating a username-only account with no recovery
   * email: such an account has no way to recover access if the password is forgotten.
   */
  acknowledgedNoRecovery?: boolean;
}

/** Credentials accepted when signing in via {@link verifyCredentials}. */
export interface SignInInput {
  /** Either the account's email or its username. */
  identifier: string;
  /** Plaintext password to verify. */
  password: string;
}

/**
 * Normalizes an email for storage and comparison (trimmed, lowercased).
 *
 * @param email - Raw email input.
 * @returns The canonical form used for uniqueness checks.
 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalizes a username (trimmed only — case is preserved as entered).
 *
 * @param username - Raw username input.
 * @returns The trimmed username.
 */
function normalizeUsername(username: string): string {
  return username.trim();
}

/**
 * Creates a new user account, persisting it with a scrypt-hashed password.
 *
 * Enforces every account-creation rule in one place: a password of at least
 * {@link MIN_PASSWORD_LENGTH}; at least one of email/username; a well-formed email when
 * provided; and explicit {@link CreateAccountInput.acknowledgedNoRecovery} for a
 * username-only account with no recovery email. Existing email/username values are
 * rejected as duplicates.
 *
 * @param input - Account details to validate and persist.
 * @returns The newly created {@link User} record.
 * @throws {AppError} `IDENTIFIER_REQUIRED` (400) when neither email nor username is given.
 * @throws {AppError} `INVALID_EMAIL` / `INVALID_RECOVERY_EMAIL` (400) for a malformed address.
 * @throws {AppError} `WEAK_PASSWORD` (400) when the password is too short.
 * @throws {AppError} `RECOVERY_ACK_REQUIRED` (400) for an unacknowledged unrecoverable account.
 * @throws {AppError} `EMAIL_TAKEN` / `USERNAME_TAKEN` (409) when the identifier already exists.
 */
export async function createAccount(input: CreateAccountInput): Promise<User> {
  const email = input.email ? normalizeEmail(input.email) : null;
  const username = input.username ? normalizeUsername(input.username) : null;
  const recoveryEmail = input.recoveryEmail ? normalizeEmail(input.recoveryEmail) : null;

  if (!email && !username) {
    throw new AppError(
      "Enter an email or a username to create your account.",
      400,
      "IDENTIFIER_REQUIRED"
    );
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    throw new AppError("Enter a valid email address.", 400, "INVALID_EMAIL");
  }

  if (recoveryEmail && !EMAIL_PATTERN.test(recoveryEmail)) {
    throw new AppError("Enter a valid recovery email address.", 400, "INVALID_RECOVERY_EMAIL");
  }

  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      400,
      "WEAK_PASSWORD"
    );
  }

  // A username-only account has no recovery path unless a recovery email is supplied;
  // require the user to acknowledge that trade-off before creating one.
  if (username && !email && !recoveryEmail && !input.acknowledgedNoRecovery) {
    throw new AppError(
      "Without an email or recovery email you cannot recover your account. Please acknowledge to continue.",
      400,
      "RECOVERY_ACK_REQUIRED"
    );
  }

  // Fetch is scoped to just the identifier columns so we can distinguish which one
  // collided without pulling the whole row.
  const existing = await prisma.user.findFirst({
    where: {
      OR: [...(email ? [{ email }] : []), ...(username ? [{ username }] : [])],
    },
    select: { email: true, username: true },
  });

  if (existing) {
    if (email && existing.email === email) {
      throw new AppError("An account with this email already exists.", 409, "EMAIL_TAKEN");
    }
    throw new AppError("This username is already taken.", 409, "USERNAME_TAKEN");
  }

  const passwordHash = await hashPassword(input.password);

  return prisma.user.create({
    data: { email, username, passwordHash, recoveryEmail },
  });
}

/**
 * Verifies sign-in credentials against the stored password hash.
 *
 * Looks the user up by email *or* username, then constant-time compares the password.
 * Returns `null` for every failure mode — unknown identifier or wrong password alike —
 * so the caller can show one non-revealing "invalid credentials" message and avoid
 * leaking whether an account exists.
 *
 * @param input - The identifier and password to check.
 * @returns The matching {@link User} on success, otherwise `null`.
 */
export async function verifyCredentials(input: SignInInput): Promise<User | null> {
  const identifier = input.identifier?.trim();
  if (!identifier || !input.password) return null;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalizeEmail(identifier) }, { username: identifier }],
    },
  });

  if (!user) return null;

  const valid = await verifyPassword(input.password, user.passwordHash);
  return valid ? user : null;
}

/**
 * Permanently deletes a user account and every row it owns.
 *
 * Vercel Blob storage is external object storage, not part of the database, so it is never
 * touched by Prisma's `onDelete: Cascade` relations from {@link User} down to
 * `AuthSession`/`Document`/`Page`/`Section`/`ChatSession`/etc. This is a two-step safe delete,
 * matching the Blob-then-DB ordering already established for per-document deletion
 * (`lib/documents/deletion.ts`'s `deleteDocument`) and the account-level cleanup sweep
 * (`lib/cleanup/sweep.ts`'s `sweepExpiredTemporarySessions`):
 *
 * 1. Delete every stored Blob image for every Page across every Document this user owns.
 * 2. Only once every Blob delete has succeeded, hard-delete the {@link User} row — the DB
 *    cascade then removes every remaining child row in one statement.
 *
 * Deliberately **not** best-effort: if any Blob delete fails, this throws immediately and
 * makes no database changes at all — the user row and every Document/Page row are left
 * exactly as they were. This is what makes the operation retry-safe with no extra state to
 * track: `deletePageImage` (`lib/storage/blob.ts`) never throws for an object that is already
 * gone, so re-calling `deleteAccount` after a partial failure just re-attempts the same Blob
 * paths, silently skipping the ones a prior attempt already removed.
 *
 * @param userId - The id of the {@link User} to delete.
 * @throws {AppError} `BLOB_CLEANUP_FAILED` (502) if any stored file could not be deleted.
 *   The user row is left intact; call again to retry.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const pages = await prisma.page.findMany({
    where: { document: { userId }, blobPath: { not: null } },
    select: { id: true, blobPath: true },
  });

  for (const page of pages) {
    try {
      // Non-null by the query filter above; the schema just can't express that in the type.
      await deletePageImage(page.blobPath as string);
    } catch (error) {
      logger.error("deleteAccount: Blob cleanup failed, aborting (user row left intact)", {
        userId,
        pageId: page.id,
        reason: error instanceof Error ? error.name : "unknown",
      });
      throw new AppError(
        "We couldn't fully delete your stored files. Please try again.",
        502,
        "BLOB_CLEANUP_FAILED"
      );
    }
  }

  await prisma.user.delete({ where: { id: userId } });

  logger.info("deleteAccount: account deleted", { userId, blobsDeleted: pages.length });
}
