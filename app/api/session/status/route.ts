/**
 * Session-status API route.
 *
 * @module app/api/session/status/route
 */

import { NextResponse } from "next/server";
import { getTemporarySession, isPrivacyAccepted } from "@/lib/session/temporary";
import { isChatDisclaimerAcknowledged } from "@/lib/session/chatDisclaimer";
import { getCurrentUser } from "@/lib/auth/session";
import { userOwner, temporaryOwner } from "@/lib/permissions/ownership";

/**
 * GET /api/session/status — reports the current owner and privacy/disclaimer state to the
 * client.
 *
 * Exists because `lib/session/temporary.ts` and `lib/auth/session.ts` use `next/headers`
 * (`cookies()`), which can't be imported from a `"use client"` component — the workspace/chat
 * pages fetch this instead of calling those functions directly.
 *
 * Response body: `{ privacyAccepted, chatDisclaimerAcknowledged, sessionId, userId }`. A
 * signed-in user (Phase 7) is reported via `userId` (with `privacyAccepted: true`,
 * `sessionId: null`, and their own chat-disclaimer acknowledgment); otherwise the temporary
 * session's id and its own privacy/chat-disclaimer flags are returned with `userId: null`.
 * `chatDisclaimerAcknowledged` is a separate flag from `privacyAccepted` (see
 * `lib/session/chatDisclaimer.ts`) — it does not imply or depend on privacy-notice acceptance.
 *
 * @returns A JSON {@link NextResponse} with the owner/privacy/disclaimer state.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (user) {
    // A signed-in user has already passed the privacy gate and owns their workspace.
    const chatDisclaimerAcknowledged = await isChatDisclaimerAcknowledged(userOwner(user.id));
    return NextResponse.json({
      privacyAccepted: true,
      chatDisclaimerAcknowledged,
      sessionId: null,
      userId: user.id,
    });
  }

  const privacyAccepted = await isPrivacyAccepted();
  const session = await getTemporarySession();
  const chatDisclaimerAcknowledged = session
    ? await isChatDisclaimerAcknowledged(temporaryOwner(session.id))
    : false;

  return NextResponse.json({
    privacyAccepted,
    chatDisclaimerAcknowledged,
    sessionId: session?.id ?? null,
    userId: null,
  });
}
