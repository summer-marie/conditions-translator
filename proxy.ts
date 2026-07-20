/**
 * Next.js request proxy (formerly `middleware.ts`) for `/app/*` routes.
 *
 * Temporary-session bootstrap deliberately does NOT happen here — it moved to
 * `app/app/layout.tsx` + `app/api/session/bootstrap/route.ts`. This runs on the Edge runtime
 * by default, which cannot load Prisma's generated client (it needs `node:path`/`node:url`), so
 * this file must stay free of Prisma/database imports.
 *
 * No routing rules are needed yet; this is a placeholder until Phase 7 needs auth-gated
 * redirects. Migrated from the deprecated `middleware.ts` convention to `proxy.ts` (Next.js 16)
 * — same behavior and matcher, just a different file/export name.
 *
 * @module proxy
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Pass-through proxy handler: currently forwards every matched request unchanged.
 *
 * @param _request - The incoming request (unused until auth-gated redirects are added).
 * @returns `NextResponse.next()`, continuing to the matched route.
 */
export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

/** Proxy matcher config: scopes {@link proxy} to `/app/*` routes. */
export const config = {
  matcher: "/app/:path*",
};
