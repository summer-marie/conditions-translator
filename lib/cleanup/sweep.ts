/**
 * Phase 9 — scheduled cleanup for expired temporary data
 * (`docs/08_Conditions_Translator_Implementation_Roadmap.md` Phase 9,
 * `docs/05_Account_Creation_and_Temporary_Access.md`, `docs/09_Coding_Risk_Register.md` R-002).
 *
 * Two independent sweeps, both idempotent and safe to re-run on every invocation:
 *
 * 1. **Chat sessions** ({@link sweepExpiredChatSessions}) — deletes any expired ChatSession,
 *    temp- or user-owned. Chat is always temporary regardless of Document ownership, so this
 *    runs independently of TemporarySession expiry. A single `deleteMany` relies on the
 *    schema's ON DELETE CASCADE (ChatMessage, ChatSessionDocument, ChatMessageSource) — no
 *    Blob storage is involved in chat, so there is nothing to retry.
 *
 * 2. **Temporary sessions** ({@link sweepExpiredTemporarySessions}) — for each expired
 *    TemporarySession, reuses the Phase 8 deletion pipeline (`deleteDocument`) for every
 *    ACTIVE Document it owns. That pipeline deletes each Page's Blob image BEFORE deleting DB
 *    rows, so a Blob failure leaves the Document at DELETE_PENDING with its rows intact and
 *    the next sweep retries it — no new schema or retry-tracking needed. The session row is
 *    hard-deleted only once it has zero ACTIVE/DELETE_PENDING Documents left; that final
 *    delete cascades the childless DELETED tombstones and any remaining chat rows, which is
 *    safe because every Blob object was already confirmed removed.
 *
 * Keying cleanup off `TemporarySession.expiresAt` (not each Document's own `expiresAt`) also
 * closes a latent gap: a Document's independently computed expiry could outlive its parent
 * session's, silently orphaning it once the session expired and was replaced. Here, once the
 * parent session expires, all of its Documents are cleaned up regardless of their own expiry.
 *
 * @module lib/cleanup/sweep
 */

import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logger";
import { deleteDocument } from "@/lib/documents/deletion";
import { temporaryOwner } from "@/lib/permissions/ownership";

/** Aggregate counts returned by a full {@link runCleanupSweep}. */
export interface CleanupSweepResult {
  /** Expired chat sessions removed. */
  expiredChatSessionsDeleted: number;
  /** Expired temporary sessions examined. */
  expiredTemporarySessionsScanned: number;
  /** Temporary session rows fully deleted this run. */
  temporarySessionsDeleted: number;
  /** Documents whose Blob + DB cleanup completed this run. */
  documentsCleanedUp: number;
  /** Documents left at DELETE_PENDING for a later retry (Blob delete failed). */
  documentsPendingRetry: number;
}

/**
 * Deletes every ChatSession whose own `expiresAt` has passed, regardless of owner kind.
 *
 * @returns The number of chat sessions deleted (children cascade automatically).
 */
export async function sweepExpiredChatSessions(): Promise<number> {
  const result = await prisma.chatSession.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

/**
 * Cleans up every expired temporary session and the Documents it owns.
 *
 * For each expired session, runs the owner-scoped deletion pipeline over its ACTIVE
 * Documents, then hard-deletes the session row once no ACTIVE/DELETE_PENDING Document
 * remains. A per-document Blob failure is caught and logged (by name only) and leaves that
 * session for the next run rather than aborting the whole sweep. Never logs a document
 * title, page text, or chat content — only ids and counts.
 *
 * @returns Counts of sessions `scanned`/`sessionsDeleted` and documents
 *   `documentsCleanedUp`/`documentsPendingRetry`.
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
      // Deleting the session cascades any remaining DELETED Document tombstones and
      // ChatSession/ChatMessage rows. Safe because every Blob object under this session
      // was already confirmed deleted in the loop above.
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

/**
 * Runs both sweeps in sequence and returns an id/count-only summary.
 *
 * The result is safe to log or return from the cron route (contains no user content).
 *
 * @returns The combined {@link CleanupSweepResult}.
 */
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
