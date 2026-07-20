/**
 * Session-status API route.
 *
 * @module app/api/session/status/route
 */

import { NextResponse } from "next/server";
import { getTemporarySession, isPrivacyAccepted } from "@/lib/session/temporary";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * GET /api/session/status — reports the current owner and privacy state to the client.
 *
 * Exists because `lib/session/temporary.ts` and `lib/auth/session.ts` use `next/headers`
 * (`cookies()`), which can't be imported from a `"use client"` component — the workspace/chat
 * pages fetch this instead of calling those functions directly.
 *
 * Response body: `{ privacyAccepted, sessionId, userId }`. A signed-in user (Phase 7) is
 * reported via `userId` (with `privacyAccepted: true`, `sessionId: null`); otherwise the
 * temporary session's id and its privacy-acceptance flag are returned with `userId: null`.
 *
 * @returns A JSON {@link NextResponse} with the owner/privacy state.
 */
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
