/**
 * Server Action for chat-disclaimer acknowledgment.
 *
 * @module lib/actions/chatDisclaimer
 */

"use server";

import { AppError } from "@/lib/errors";
import { getCurrentOwner } from "@/lib/auth/session";
import { acknowledgeChatDisclaimer as acknowledge } from "@/lib/session/chatDisclaimer";

/**
 * Acknowledges the chat-specific disclaimer for the current owner (signed-in user or
 * temporary session).
 *
 * @throws {AppError} `NO_ACTIVE_SESSION` (401) when there is no current owner.
 */
export async function acknowledgeChatDisclaimer(): Promise<void> {
  const owner = await getCurrentOwner();
  if (!owner) {
    throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
  }

  await acknowledge(owner);
}
