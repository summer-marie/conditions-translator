// GET /api/session/status
//
// Bootstraps the client workspace with owner/privacy state. Exists because
// `lib/session/temporary.ts` and `lib/auth/session.ts` use next/headers (cookies()), which cannot
// be imported from a "use client" component — the workspace/chat pages fetch this instead of
// calling those functions directly.
//
// Reports the signed-in user (Phase 7) when present so the UI can show a "saved" state and list
// user-owned documents; otherwise reports the temporary session.

import { NextResponse } from "next/server";
import { getTemporarySession, isPrivacyAccepted } from "@/lib/session/temporary";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();

  if (user) {
    // A signed-in user has already passed the privacy gate and owns their workspace.
    return NextResponse.json({
      privacyAccepted: true,
      sessionId: null,
      userId: user.id,
    });
  }

  const privacyAccepted = await isPrivacyAccepted();
  const session = await getTemporarySession();

  return NextResponse.json({
    privacyAccepted,
    sessionId: session?.id ?? null,
    userId: null,
  });
}
