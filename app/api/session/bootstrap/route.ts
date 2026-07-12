// GET /api/session/bootstrap
//
// Creates a temporary session and sets its cookie, then redirects to the privacy notice.
// This is the only place a new anonymous session gets created: app/app/layout.tsx (a Server
// Component) cannot set cookies itself, so it redirects here instead — Route Handlers are
// allowed to set cookies. Always redirects to /app/start (the PRD's canonical entry point),
// not the originally-requested URL.

import { NextResponse } from "next/server";
import { getOrCreateTemporarySession } from "@/lib/session/temporary";

export async function GET(request: Request) {
  await getOrCreateTemporarySession();
  return NextResponse.redirect(new URL("/app/start", request.url));
}
