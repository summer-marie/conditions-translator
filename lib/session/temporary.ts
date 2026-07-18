// Temporary session management for anonymous users.
//
// Generates a UUID v4 temporary session ID and stores it in a signed, HttpOnly cookie.
// If the visitor is authenticated (NextAuth session), the temp cookie is not set.
// Session is stable for the lifetime of the cookie (default: 7 days).

import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { TEMP_SESSION_TTL_HOURS } from "@/lib/constants";
import { prisma } from "@/lib/database/prisma";

const TMP_SESSION_COOKIE = "tmp_session";
const TMP_SESSION_MAX_AGE = TEMP_SESSION_TTL_HOURS * 60 * 60; // Convert hours to seconds
const PRIVACY_ACCEPTED_FLAG = "privacy_accepted";

export interface TemporarySession {
  id: string;
  token: string;
  noticeAcceptedAt: Date | null;
  expiresAt: Date;
}

/**
 * Gets or creates a temporary session for the current visitor.
 * Returns null if the user is authenticated (has a NextAuth session).
 */
export async function getOrCreateTemporarySession(
  isAuthenticated: boolean = false
): Promise<TemporarySession | null> {
  // If user is authenticated, don't create/use temporary session
  if (isAuthenticated) {
    return null;
  }

  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(TMP_SESSION_COOKIE);

  if (existingCookie) {
    // Verify and return existing session
    const session = await prisma.temporarySession.findUnique({
      where: { token: existingCookie.value },
    });

    if (session && session.expiresAt > new Date()) {
      return session;
    }

    // Session expired or invalid, create a new one
  }

  // Create new temporary session
  const token = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TMP_SESSION_MAX_AGE * 1000);

  const session = await prisma.temporarySession.create({
    data: {
      token,
      expiresAt,
    },
  });

  // Set the cookie. sameSite must be "lax", not "strict": this cookie is set on the
  // /api/session/bootstrap redirect response that app/app/layout.tsx sends unauthenticated
  // visitors through, and a "strict" cookie set during a redirect is not guaranteed to be sent
  // back on the very next request when the browsing context is a fresh top-level navigation with
  // no same-site referrer -- exactly what happens every time an installed PWA is (re)launched
  // from the OS home screen/icon. That dropped the cookie on the follow-up request, which
  // re-triggered the same bootstrap redirect forever (the installed-PWA "too many redirects"
  // loop). "lax" is also this project's documented default for the analogous auth session cookie
  // (see AUTH_COOKIE_SAME_SITE in env.example / lib/auth/session.ts's cookieSameSite()) --  this
  // temporary-session cookie just hadn't been kept in sync with that convention.
  cookieStore.set(TMP_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TMP_SESSION_MAX_AGE,
    path: "/",
  });

  return session;
}

/**
 * Gets the current temporary session from the cookie without creating one.
 * Returns null if no valid session exists or user is authenticated.
 */
export async function getTemporarySession(
  isAuthenticated: boolean = false
): Promise<TemporarySession | null> {
  if (isAuthenticated) {
    return null;
  }

  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(TMP_SESSION_COOKIE);

  if (!existingCookie) {
    return null;
  }

  const session = await prisma.temporarySession.findUnique({
    where: { token: existingCookie.value },
  });

  if (!session || session.expiresAt <= new Date()) {
    return null;
  }

  return session;
}

/**
 * Checks if the privacy notice has been accepted for the current session.
 */
export async function isPrivacyAccepted(
  isAuthenticated: boolean = false
): Promise<boolean> {
  if (isAuthenticated) {
    return true; // Authenticated users have already accepted privacy
  }

  const session = await getTemporarySession(false);
  return !!session && session.noticeAcceptedAt !== null;
}

/**
 * Marks the privacy notice as accepted for the current session.
 */
export async function acceptPrivacyNotice(): Promise<void> {
  const session = await getTemporarySession(false);
  
  if (!session) {
    throw new Error("No temporary session found");
  }

  await prisma.temporarySession.update({
    where: { id: session.id },
    data: { noticeAcceptedAt: new Date() },
  });
}

/**
 * Invalidates the current temporary session by clearing the cookie.
 */
export async function invalidateTemporarySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TMP_SESSION_COOKIE);
}