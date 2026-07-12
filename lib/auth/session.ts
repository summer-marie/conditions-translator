// Saved-account auth sessions (docs/05_Account_Creation_and_Temporary_Access.md).
//
// Deliberately mirrors lib/session/temporary.ts: a signed-in user is identified by a random,
// opaque token stored in the AuthSession table and carried in a secure, HttpOnly cookie. There is
// no NextAuth/Auth.js layer — the schema (User.passwordHash + AuthSession token) is shaped for this
// custom credentials approach, and it stays consistent with the existing temporary-session pattern.

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

const AUTH_SESSION_COOKIE = "auth_session";
const AUTH_SESSION_MAX_AGE = AUTH_SESSION_TTL_HOURS * 60 * 60; // seconds

function cookieSameSite(): "strict" | "lax" | "none" {
  const value = (process.env.AUTH_COOKIE_SAME_SITE ?? "lax").toLowerCase();
  return value === "strict" || value === "none" ? value : "lax";
}

function cookieSecure(): boolean {
  // Explicit opt-in via env, or automatically in production.
  return process.env.AUTH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
}

/** Creates a persisted auth session for the user and sets its HttpOnly cookie. */
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

/** Returns the signed-in user for the current request, or null if not authenticated. */
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
 * Resolves the owner for the current request. A signed-in user always takes precedence over any
 * lingering temporary-session cookie, so once a workspace is saved every ownership-scoped read
 * (documents, chat) resolves to the user — this is what keeps the active chat continuous after
 * ownership transfer. Returns null when neither a user nor a temporary session is present.
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

/** Signs the current user out: removes the auth session row and clears the cookie. */
export async function destroyAuthSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_SESSION_COOKIE)?.value;

  if (token) {
    await prisma.authSession.deleteMany({ where: { token } });
    cookieStore.delete(AUTH_SESSION_COOKIE);
  }
}
