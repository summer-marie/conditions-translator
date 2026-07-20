/**
 * Temporary-session bootstrap API route.
 *
 * @module app/api/session/bootstrap/route
 */

import { NextResponse } from "next/server";
import { getOrCreateTemporarySession } from "@/lib/session/temporary";

/**
 * GET /api/session/bootstrap — creates an anonymous session, then redirects to onboarding.
 *
 * This is the only place a new anonymous session is created: `app/app/layout.tsx` is a Server
 * Component and cannot set cookies, so it redirects here instead (Route Handlers can). The
 * response always redirects to `/app/start` (the PRD's canonical entry point), never the
 * originally-requested URL.
 *
 * @param request - The incoming request (used as the base URL for the redirect).
 * @returns A redirect {@link NextResponse} to `/app/start` with the session cookie set.
 */
export async function GET(request: Request) {
  await getOrCreateTemporarySession();
  return NextResponse.redirect(new URL("/app/start", request.url));
}
