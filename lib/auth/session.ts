/**
 * Saved-account auth sessions (`docs/05_Account_Creation_and_Temporary_Access.md`).
 *
 * Deliberately mirrors `lib/session/temporary.ts`: a signed-in user is identified by a
 * random, opaque token stored in the `AuthSession` table and carried in a secure,
 * HttpOnly cookie. There is no NextAuth/Auth.js layer — the schema
 * (`User.passwordHash` + `AuthSession.token`) is shaped for this custom credentials
 * approach and stays consistent with the existing temporary-session pattern.
 *
 * @module lib/auth/session
 */

import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AUTH_SESSION_TTL_HOURS } from "@/lib/constants";
import {
  temporaryOwner,
  userOwner,
  type Owner,
} from "@/lib/permissions/ownership";
import { getTemporarySession } from "@/lib/session/temporary";

/** Name of the HttpOnly cookie that carries the auth-session token. */
const AUTH_SESSION_COOKIE = "auth_session";
/** Cookie `Max-Age` in seconds, derived from {@link AUTH_SESSION_TTL_HOURS}. */
const AUTH_SESSION_MAX_AGE = AUTH_SESSION_TTL_HOURS * 60 * 60;

/**
 * Resolves the cookie `SameSite` policy from `AUTH_COOKIE_SAME_SITE`.
 *
 * @returns `"strict"` or `"none"` when explicitly configured, otherwise `"lax"`.
 */
function cookieSameSite(): "strict" | "lax" | "none" {
  const value = (process.env.AUTH_COOKIE_SAME_SITE ?? "lax").toLowerCase();
  return value === "strict" || value === "none" ? value : "lax";
}

/**
 * Decides whether the auth cookie should carry the `Secure` flag.
 *
 * @returns `true` when explicitly opted in via `AUTH_COOKIE_SECURE=true`, or whenever
 *   running in production.
 */
function cookieSecure(): boolean {
  return process.env.AUTH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
}

/**
 * Creates a persisted auth session for a user and sets its HttpOnly cookie on the response.
 *
 * @param userId - The user to sign in.
 * @returns Resolves once the `AuthSession` row is written and the cookie is set.
 */
export async function createAuthSession(userId: string): Promise<void> {
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + AUTH_SESSION_MAX_AGE * 1000);

  await prisma.authSession.create({
    data: { userId, token, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: cookieSameSite(),
    maxAge: AUTH_SESSION_MAX_AGE,
    path: "/",
  });
}

/**
 * Resolves the signed-in user for the current request.
 *
 * Reads the auth-session token from the request cookie and loads its `AuthSession` (with
 * the related `user`). An absent, unknown, or expired session yields `null`.
 *
 * @returns The authenticated {@link User}, or `null` when not signed in.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;
  if (!token) return null;

  const authSession = await prisma.authSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!authSession || authSession.expiresAt <= new Date()) {
    return null;
  }

  return authSession.user;
}

/**
 * Resolves the {@link Owner} for the current request.
 *
 * A signed-in user always takes precedence over any lingering temporary-session cookie,
 * so once a workspace is saved every ownership-scoped read (documents, chat) resolves to
 * the user. This precedence is what keeps the active chat continuous across ownership
 * transfer.
 *
 * @returns A user owner when authenticated, else a temporary owner when a temporary
 *   session exists, else `null`.
 */
export async function getCurrentOwner(): Promise<Owner | null> {
  const user = await getCurrentUser();
  if (user) {
    return userOwner(user.id);
  }

  const session = await getTemporarySession();
  if (session) {
    return temporaryOwner(session.id);
  }

  return null;
}

/**
 * Signs the current user out.
 *
 * Deletes the matching `AuthSession` row and clears the cookie. A no-op when no
 * auth-session cookie is present.
 *
 * @returns Resolves once the session is removed and the cookie cleared.
 */
export async function destroyAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  if (token) {
    await prisma.authSession.deleteMany({ where: { token } });
    cookieStore.delete(AUTH_SESSION_COOKIE);
  }
}
