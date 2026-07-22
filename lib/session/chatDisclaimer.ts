/**
 * Chat-specific "not legal advice" disclaimer acknowledgment.
 *
 * Deliberately separate from the privacy-notice acceptance in `lib/session/temporary.ts`
 * (`noticeAcceptedAt`), which covers data-handling/retention and is shown before first
 * upload. This disclaimer is scoped to chat use only and is acknowledged independently:
 *
 * - A signed-in user acknowledges once per account (`User.chatDisclaimerAcknowledgedAt`),
 *   never re-prompted afterward.
 * - A temporary session acknowledges once per session
 *   (`TemporarySession.chatDisclaimerAcknowledgedAt`) — a new temporary session (after the
 *   previous one expires or a fresh visit mints a new one) always requires re-acknowledgment.
 *
 * @module lib/session/chatDisclaimer
 */

import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { type Owner } from "@/lib/permissions/ownership";

/**
 * Reports whether the current owner has acknowledged the chat disclaimer.
 *
 * @param owner - The current owner (signed-in user or temporary session).
 * @returns `true` once acknowledged; `false` otherwise (including when the owner row can't
 *   be found, e.g. a stale/expired temporary session).
 */
export async function isChatDisclaimerAcknowledged(owner: Owner): Promise<boolean> {
  if (owner.kind === "user") {
    const user = await prisma.user.findUnique({
      where: { id: owner.userId },
      select: { chatDisclaimerAcknowledgedAt: true },
    });
    return !!user?.chatDisclaimerAcknowledgedAt;
  }

  const session = await prisma.temporarySession.findUnique({
    where: { id: owner.temporarySessionId },
    select: { chatDisclaimerAcknowledgedAt: true },
  });
  return !!session?.chatDisclaimerAcknowledgedAt;
}

/**
 * Marks the chat disclaimer as acknowledged for the current owner.
 *
 * @param owner - The current owner (signed-in user or temporary session).
 * @returns Resolves once `chatDisclaimerAcknowledgedAt` is stamped on the owner's row.
 */
export async function acknowledgeChatDisclaimer(owner: Owner): Promise<void> {
  if (owner.kind === "user") {
    await prisma.user.update({
      where: { id: owner.userId },
      data: { chatDisclaimerAcknowledgedAt: new Date() },
    });
    return;
  }

  await prisma.temporarySession.update({
    where: { id: owner.temporarySessionId },
    data: { chatDisclaimerAcknowledgedAt: new Date() },
  });
}

/**
 * Server-side gate for chat entry points: throws unless the current owner has already
 * acknowledged the chat disclaimer. Chat use must never rely on client state alone.
 *
 * @param owner - The current owner.
 * @throws {AppError} `CHAT_DISCLAIMER_NOT_ACKNOWLEDGED` (403) when not yet acknowledged.
 */
export async function requireChatDisclaimerAcknowledged(owner: Owner): Promise<void> {
  const acknowledged = await isChatDisclaimerAcknowledged(owner);
  if (!acknowledged) {
    throw new AppError(
      "Please acknowledge the chat disclaimer before using chat.",
      403,
      "CHAT_DISCLAIMER_NOT_ACKNOWLEDGED"
    );
  }
}
