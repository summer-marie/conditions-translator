// Lightweight routing for /app/* routes.
//
// Temporary session bootstrap does NOT happen here (moved to app/app/layout.tsx +
// app/api/session/bootstrap/route.ts): this runs on the Edge runtime by default, which cannot
// load Prisma's generated client (needs node:path/node:url). Keep this file free of
// Prisma/database imports. See .agent-memory/DECISIONS.md for the full reasoning.
//
// No routing rules are needed yet; this is a placeholder until Phase 7 needs auth-gated
// redirects here. Migrated from the deprecated middleware.ts convention to proxy.ts
// (Next.js 16) — same behavior, same matcher, just the file/export name.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: "/app/:path*",
};
