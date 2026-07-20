/**
 * Temporary session management for anonymous users.
 *
 * An anonymous visitor is identified by a UUID v4 token stored in an HttpOnly cookie and
 * backed by a `TemporarySession` row. When the caller reports the visitor is already
 * signed in, no temporary session is created or read — the user account owns the request
 * instead. Sessions live for the cookie's lifetime ({@link TEMP_SESSION_TTL_HOURS}).
 *
 * @module lib/session/temporary
 */

import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import { TEMP_SESSION_TTL_HOURS } from "@/lib/constants";
import { prisma } from "@/lib/database/prisma";

/** Name of the HttpOnly cookie carrying the temporary-session token. */
const TMP_SESSION_COOKIE = "tmp_session";
/** Cookie `Max-Age` in seconds, derived from {@link TEMP_SESSION_TTL_HOURS}. */
const TMP_SESSION_MAX_AGE = TEMP_SESSION_TTL_HOURS * 60 * 60;
/** Cookie flag name reserved for the privacy-acceptance marker. */
const PRIVACY_ACCEPTED_FLAG = "privacy_accepted";

/** A persisted anonymous session and its privacy-acceptance/expiry state. */
export interface TemporarySession {
  /** Database id. */
  id: string;
  /** Opaque token stored in the cookie and matched on lookup. */
  token: string;
  /** When the privacy notice was accepted, or `null` if not yet accepted. */
  noticeAcceptedAt: Date | null;
  /** When this session expires. */
  expiresAt: Date;
}

/**
 * Returns the current temporary session, creating (and cookie-setting) one if needed.
 *
 * Reuses a valid existing session from the cookie; otherwise mints a new token, persists a
 * `TemporarySession`, and sets the cookie. Returns `null` for authenticated visitors,
 * who are represented by their user account rather than a temporary session.
 *
 * @param isAuthenticated - Whether a signed-in user already owns this request.
 * @returns The active {@link TemporarySession}, or `null` when authenticated.
 */
export async function getOrCreateTemporarySession(
  isAuthenticated: boolean = false
): Promise<TemporarySession | null> {
  // Authenticated requests are owned by the user account; never attach a temp session.
  if (isAuthenticated) {
    return null;
  }

  const cookieStore = await cookies();
  const existingCookie = cookieStore.get(TMP_SESSION_COOKIE);

  if (existingCookie) {
    // Reuse the cookie's session only if it still exists and hasn't expired; otherwise
    // fall through and mint a fresh one.
    const session = await prisma.temporarySession.findUnique({
      where: { token: existingCookie.value },
    });

    if (session && session.expiresAt > new Date()) {
      return session;
    }
  }

  const token = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TMP_SESSION_MAX_AGE * 1000);

  const session = await prisma.temporarySession.create({
    data: {
      token,
      expiresAt,
    },
  });

  // sameSite MUST be "lax", not "strict". This cookie is set on the
  // /api/session/bootstrap redirect that app/app/layout.tsx routes unauthenticated visitors
  // through, and a "strict" cookie set during a redirect is not reliably sent back on the
  // next request when that request is a fresh top-level navigation with no same-site
  // referrer — exactly what happens each time an installed PWA is (re)launched from the OS
  // icon. A dropped cookie there re-triggered the bootstrap redirect endlessly (the
  // installed-PWA "too many redirects" loop). "lax" also matches this project's documented
  // default for the analogous auth cookie (AUTH_COOKIE_SAME_SITE / cookieSameSite()).
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
 * Reads the current temporary session from the cookie without creating one.
 *
 * @param isAuthenticated - Whether a signed-in user already owns this request.
 * @returns The active {@link TemporarySession}, or `null` when none is valid or the
 *   visitor is authenticated.
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
 * Reports whether the privacy notice has been accepted for the current session.
 *
 * @param isAuthenticated - Whether a signed-in user already owns this request; such users
 *   are treated as having already accepted.
 * @returns `true` when accepted (or authenticated), otherwise `false`.
 */
export async function isPrivacyAccepted(
  isAuthenticated: boolean = false
): Promise<boolean> {
  if (isAuthenticated) {
    return true; // Signed-in users accepted the notice during account creation.
  }

  const session = await getTemporarySession(false);
  return !!session && session.noticeAcceptedAt !== null;
}

/**
 * Marks the privacy notice as accepted for the current temporary session.
 *
 * @returns Resolves once `noticeAcceptedAt` is stamped on the session.
 * @throws {Error} When there is no active temporary session to update.
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
 * Invalidates the current temporary session by clearing its cookie.
 *
 * Only the cookie is removed; the `TemporarySession` row (and any expiry-based cleanup) is
 * left to the Phase 9 sweep.
 *
 * @returns Resolves once the cookie is cleared.
 */
export async function invalidateTemporarySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TMP_SESSION_COOKIE);
}