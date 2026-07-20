/**
 * Atomic ownership transfer: temporary session → saved user account
 * (`docs/05_Account_Creation_and_Temporary_Access.md`, roadmap Phase 7).
 *
 * Invariants preserved (see the CHECK constraints in `prisma/schema.prisma`):
 *
 * - **Single owner, always.** Each Document row is switched from `temporarySessionId`
 *   to `userId` and has its `expiresAt` cleared in the *same* update, so it never
 *   transiently violates `documents_single_owner_check` or `documents_owner_expiry_check`.
 * - **No Document is created here.** Ownership moves in place, so the flow can never
 *   produce a duplicate, and re-running it is a harmless no-op (the second pass matches
 *   nothing because the temporary owner is already gone).
 * - **Children move automatically.** Pages, OcrResult, Sections, SectionSource, and chat
 *   messages/sources/docs reference their parent Document/ChatSession by id, not by
 *   owner, so they follow their parent.
 * - **Chat stays ephemeral.** ChatSessions transfer to the user for continuity but keep
 *   their `expiresAt`, so chat is still deleted on expiry even though the Documents are
 *   now permanently saved.
 *
 * @module lib/auth/transfer
 */

import { prisma } from "@/lib/database/prisma";

/** Counts of records moved by {@link transferWorkspaceToUser}. */
export interface TransferResult {
  /** Number of ACTIVE Documents reassigned to the user. */
  documentCount: number;
  /** Number of ChatSessions reassigned to the user. */
  chatSessionCount: number;
}

/**
 * Moves every ACTIVE Document and every ChatSession owned by a temporary session to a
 * user account, in a single transaction.
 *
 * Idempotent: a temporary session with nothing left to transfer yields zero counts
 * without error, so retries and double-submits are safe.
 *
 * @param temporarySessionId - The source temporary session losing ownership.
 * @param userId - The destination saved-account user gaining ownership.
 * @returns A {@link TransferResult} with the number of Documents and ChatSessions moved.
 */
export async function transferWorkspaceToUser(
  temporarySessionId: string,
  userId: string
): Promise<TransferResult> {
  const [documents, chatSessions] = await prisma.$transaction([
    prisma.document.updateMany({
      where: { temporarySessionId, deletionState: "ACTIVE" },
      data: { userId, temporarySessionId: null, expiresAt: null },
    }),
    prisma.chatSession.updateMany({
      where: { temporarySessionId },
      // expiresAt intentionally left unchanged — chat stays ephemeral after the workspace is saved.
      data: { userId, temporarySessionId: null },
    }),
  ]);

  return {
    documentCount: documents.count,
    chatSessionCount: chatSessions.count,
  };
}
