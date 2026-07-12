// Atomic ownership transfer: temporary session -> saved user account
// (docs/05_Account_Creation_and_Temporary_Access.md, docs/08 roadmap Phase 7).
//
// Invariants preserved (see prisma/schema.prisma CHECK constraints):
//   - Every Document keeps exactly one owner. Each Document row is switched from
//     temporarySessionId to userId and its expiresAt is cleared in the SAME update, so it never
//     transiently violates documents_single_owner_check or documents_owner_expiry_check.
//   - No Document is ever created here — ownership moves in place, so the flow cannot produce a
//     duplicate Document, and running it twice is a harmless no-op (the second pass matches nothing
//     because the temporary owner is already gone).
//   - Child records (Pages, OcrResult, Sections, SectionSource, and chat messages/sources/docs)
//     reference their parent Document/ChatSession by id, not the owner, so they move automatically.
//   - ChatSessions transfer to the user too (chat continuity) but KEEP their expiresAt: chat stays
//     temporary and is still deleted on expiry even though the Documents are now saved.

import { prisma } from "@/lib/database/prisma";

export interface TransferResult {
  documentCount: number;
  chatSessionCount: number;
}

/**
 * Moves every ACTIVE Document and every ChatSession owned by `temporarySessionId` to `userId` in a
 * single transaction. Idempotent: a temporary session with nothing left to transfer yields zero
 * counts without error.
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
      // expiresAt intentionally left unchanged — chat remains ephemeral after the workspace is saved.
      data: { userId, temporarySessionId: null },
    }),
  ]);

  return {
    documentCount: documents.count,
    chatSessionCount: chatSessions.count,
  };
}
