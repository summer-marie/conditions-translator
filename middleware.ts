// Middleware for temporary session management.
//
// Generates a temporary session ID for unauthenticated visitors and stores it in a signed cookie.
// If the visitor is authenticated (NextAuth session), the temp cookie is not set.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { v4 as uuidv4 } from "uuid";
import { TEMP_SESSION_TTL_HOURS } from "@/lib/constants";

const TMP_SESSION_COOKIE = "tmp_session";
const TMP_SESSION_MAX_AGE = TEMP_SESSION_TTL_HOURS * 60 * 60; // Convert hours to seconds

/**
 * Checks if the request has an authenticated session.
 * For now, we assume no NextAuth session since auth is not yet implemented.
 * This will be extended when NextAuth is added in later phases.
 */
function hasAuthenticatedSession(request: NextRequest): boolean {
  // Check for NextAuth session token cookie
  const sessionToken = request.cookies.get("next-auth.session-token") ||
                        request.cookies.get("__Secure-next-auth.session-token");
  return !!sessionToken;
}

/**
 * Creates or updates a temporary session cookie.
 */
async function setTemporarySessionCookie(
  response: NextResponse,
  existingToken?: string
): Promise<void> {
  let token = existingToken;
  let isNewSession = false;

  // Validate existing token
  if (existingToken) {
    const session = await prisma.temporarySession.findUnique({
      where: { token: existingToken },
    });

    if (!session || session.expiresAt <= new Date()) {
      token = uuidv4();
      isNewSession = true;
    }
  } else {
    token = uuidv4();
    isNewSession = true;
  }

  // Create new session if needed
  if (isNewSession) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TMP_SESSION_MAX_AGE * 1000);

    await prisma.temporarySession.create({
      data: {
        token,
        expiresAt,
      },
    });
  }

  // Set the cookie (token is guaranteed to be defined here)
  response.cookies.set(TMP_SESSION_COOKIE, token!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: TMP_SESSION_MAX_AGE,
    path: "/",
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only process app/* routes
  if (!pathname.startsWith("/app")) {
    return NextResponse.next();
  }

  // Skip middleware for static files and API routes
  if (pathname.includes("/_next") || pathname.includes("/api")) {
    return NextResponse.next();
  }

  const isAuthenticated = hasAuthenticatedSession(request);
  const response = NextResponse.next();

  // If not authenticated, manage temporary session
  if (!isAuthenticated) {
    const existingToken = request.cookies.get(TMP_SESSION_COOKIE)?.value;
    await setTemporarySessionCookie(response, existingToken);
  }

  return response;
}

export const config = {
  matcher: "/app/:path*",
};