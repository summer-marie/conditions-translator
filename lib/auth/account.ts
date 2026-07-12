// Account creation and credential verification for saved accounts
// (docs/05_Account_Creation_and_Temporary_Access.md, docs/08 roadmap Phase 7).
//
// MVP supports email+password and/or username+password. Passwords are hashed with scrypt
// (lib/auth/password.ts). This module owns validation and persistence only; the auth-session
// cookie is handled separately in lib/auth/session.ts.

import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateAccountInput {
  email?: string | null;
  username?: string | null;
  password: string;
  recoveryEmail?: string | null;
  // Required acknowledgment when creating a username-only account with no recovery email:
  // the user has no way to recover access if they forget the password.
  acknowledgedNoRecovery?: boolean;
}

export interface SignInInput {
  identifier: string; // email or username
  password: string;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeUsername(username: string): string {
  return username.trim();
}

/**
 * Creates a new user account. Enforces: a password of at least the minimum length; at least one
 * of email/username; valid email shape when provided; and explicit acknowledgment for a
 * username-only account without a recovery email. Rejects duplicate email/username.
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

  // Username-only accounts have no recovery path unless a recovery email is supplied; require the
  // user to acknowledge that before we create one.
  if (username && !email && !recoveryEmail && !input.acknowledgedNoRecovery) {
    throw new AppError(
      "Without an email or recovery email you cannot recover your account. Please acknowledge to continue.",
      400,
      "RECOVERY_ACK_REQUIRED"
    );
  }

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
 * Verifies sign-in credentials. Returns the matching user, or null for any failure (unknown
 * identifier or wrong password) so the caller can present a single, non-revealing error message.
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
