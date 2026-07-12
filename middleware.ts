// Lightweight routing for /app/* routes.
//
// Temporary session bootstrap does NOT happen here (moved to app/app/layout.tsx +
// app/api/session/bootstrap/route.ts): middleware runs on the Edge runtime by default, which
// cannot load Prisma's generated client (needs node:path/node:url). Keep this file free of
// Prisma/database imports. See .agent-memory/DECISIONS.md for the full reasoning.
//
// No routing rules are needed yet; this is a placeholder until Phase 7 needs auth-gated
// redirects here.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: "/app/:path*",
};
