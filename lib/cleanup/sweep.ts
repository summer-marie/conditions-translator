// Phase 9 — scheduled cleanup for expired temporary data
// (docs/08_Conditions_Translator_Implementation_Roadmap.md Phase 9,
// docs/05_Account_Creation_and_Temporary_Access.md, docs/09_Coding_Risk_Register.md R-002).
//
// Two independent sweeps, both idempotent and safe to re-run on every invocation:
//
// 1. sweepExpiredChatSessions — deletes any ChatSession (temp- or user-owned) whose own
//    expiresAt has passed. Chat is always temporary regardless of Document ownership
//    (docs/01_MVP_PRD.md, docs/04_Schema_Architecture.md), so this runs independently of
//    TemporarySession expiry. A single deleteMany relies on the schema's ON DELETE CASCADE
//    (ChatMessage, ChatSessionDocument, ChatMessageSource all cascade from ChatSession) — no
//    Blob storage is involved in chat, so there is nothing to retry.
//
// 2. sweepExpiredTemporarySessions — for each expired TemporarySession, reuses the existing,
//    already-tested Phase 8 deletion pipeline (lib/documents/deletion.ts's deleteDocument) for
//    every ACTIVE Document it owns. That pipeline deletes each Page's Blob image BEFORE deleting
//    DB rows, so a Blob failure leaves the Document at DELETE_PENDING with its Page rows intact —
//    the next sweep run retries it automatically, with no new schema or retry-tracking needed.
//    Only once a session has zero ACTIVE/DELETE_PENDING Documents left (all fully DELETED, or it
//    never had any) is the TemporarySession row itself hard-deleted. That final delete cascades
//    the now-childless DELETED Document tombstones and any remaining ChatSession/ChatMessage rows
//    tied to the session — safe, because every Blob object was already confirmed removed before
//    this point.
//
// Keying cleanup off TemporarySession.expiresAt (not each Document's own expiresAt) also closes a
// previously-flagged latent gap (.agent-memory/OPEN_QUESTIONS.md): a Document's independently
// computed expiresAt could outlive its parent session's expiresAt, silently orphaning it once the
// session expired and was replaced. Under this sweep, once the parent session expires, all of its
// Documents are cleaned up regardless of their own expiresAt value.

import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logger";
import { deleteDocument } from "@/lib/documents/deletion";
import { temporaryOwner } from "@/lib/permissions/ownership";

export interface CleanupSweepResult {
  expiredChatSessionsDeleted: number;
  expiredTemporarySessionsScanned: number;
  temporarySessionsDeleted: number;
  documentsCleanedUp: number;
  documentsPendingRetry: number;
}

/** Deletes every ChatSession whose own expiresAt has passed, regardless of owner kind. */
export async function sweepExpiredChatSessions(): Promise<number> {
  const result = await prisma.chatSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

/**
 * For each expired TemporarySession, cleans up its ACTIVE Documents via the existing
 * owner-scoped deletion pipeline, then hard-deletes the session row once no ACTIVE/
 * DELETE_PENDING Document remains under it. Never logs a document title, page text, or chat
 * content — only ids and counts.
 */
export async function sweepExpiredTemporarySessions(): Promise<{
  scanned: number;
  sessionsDeleted: number;
  documentsCleanedUp: number;
  documentsPendingRetry: number;
}> {
  const expiredSessions = await prisma.temporarySession.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { id: true },
  });

  let sessionsDeleted = 0;
  let documentsCleanedUp = 0;
  let documentsPendingRetry = 0;

  for (const session of expiredSessions) {
    const owner = temporaryOwner(session.id);

    const documents = await prisma.document.findMany({
      where: { temporarySessionId: session.id, deletionState: { in: ["ACTIVE", "DELETE_PENDING"] } },
      select: { id: true },
    });

    let allCleaned = true;
    for (const doc of documents) {
      try {
        const result = await deleteDocument(owner, doc.id);
        if (result.cleanupComplete) {
          documentsCleanedUp += 1;
        } else {
          documentsPendingRetry += 1;
          allCleaned = false;
        }
      } catch (error) {
        allCleaned = false;
        logger.error("cleanup sweep: document cleanup failed", {
          temporarySessionId: session.id,
          documentId: doc.id,
          reason: error instanceof Error ? error.name : "unknown",
        });
      }
    }

    if (allCleaned) {
      // Cascades any remaining DELETED Document tombstones and ChatSession/ChatMessage rows.
      // Safe: every Blob object under this session was already confirmed deleted above.
      const deleted = await prisma.temporarySession.deleteMany({ where: { id: session.id } });
      sessionsDeleted += deleted.count;
    }
  }

  return {
    scanned: expiredSessions.length,
    sessionsDeleted,
    documentsCleanedUp,
    documentsPendingRetry,
  };
}

/** Runs both sweeps and returns a summary safe to log or return from the cron route. */
export async function runCleanupSweep(): Promise<CleanupSweepResult> {
  const expiredChatSessionsDeleted = await sweepExpiredChatSessions();
  const sessionSweep = await sweepExpiredTemporarySessions();

  const result: CleanupSweepResult = {
    expiredChatSessionsDeleted,
    expiredTemporarySessionsScanned: sessionSweep.scanned,
    temporarySessionsDeleted: sessionSweep.sessionsDeleted,
    documentsCleanedUp: sessionSweep.documentsCleanedUp,
    documentsPendingRetry: sessionSweep.documentsPendingRetry,
  };

  logger.info("cleanup sweep complete", { ...result });
  return result;
}
