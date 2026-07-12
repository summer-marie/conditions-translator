// GET /api/session/status
//
// Bootstraps the client workspace with privacy-acceptance and session state. Exists because
// `lib/session/temporary.ts` uses next/headers (cookies()), which cannot be imported from a
// "use client" component — the workspace page must fetch this instead of calling those
// functions directly (fixes a pre-existing Phase 3 client/server boundary violation that broke
// `next build`; no session/ownership/privacy behavior changes).

import { NextResponse } from "next/server";
import { getTemporarySession, isPrivacyAccepted } from "@/lib/session/temporary";

export async function GET() {
  const privacyAccepted = await isPrivacyAccepted();
  const session = await getTemporarySession();

  return NextResponse.json({
    privacyAccepted,
    sessionId: session?.id ?? null,
  });
}
