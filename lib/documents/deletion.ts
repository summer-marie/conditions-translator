/**
 * Document deletion lifecycle (`docs/08_..._Roadmap.md` Phase 8,
 * `docs/09_Coding_Risk_Register.md` R-002).
 *
 * Deletion is two-phase and idempotent:
 *
 * 1. **ACTIVE → DELETE_PENDING** (owner-scoped, conditional on the current state). This
 *    alone removes the Document from every read/list path — `getOwnedDocument`,
 *    `listOwnedDocuments`, and chat context all require `deletionState: "ACTIVE"` — so
 *    access is gone before any cleanup runs.
 * 2. **Cleanup**: delete each Page's Blob image FIRST, then delete the DB child rows, then
 *    mark DELETED. Blob-before-DB (the reverse of the roadmap's listed order) is deliberate:
 *    it makes a failed cleanup retryable with no schema change. Page rows (and their
 *    `blobPath`) survive until every Blob object is confirmed gone, so re-calling
 *    `deleteDocument` just re-reads the still-present paths and retries. Only once all Blob
 *    deletes succeed are the DB children removed and the Document marked DELETED.
 *
 * The Document row itself is never hard-deleted — it remains a DELETED tombstone — so
 * `deletionState` stays a coherent, queryable lifecycle rather than the row vanishing.
 *
 * @module lib/documents/deletion
 */

import type { Document } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  ownerWhere,
  ownerScopedDocumentWhere,
  type Owner,
  getDeletableDocument,
} from "@/lib/permissions/ownership";
import { deletePageImage } from "@/lib/storage/blob";

/** Outcome of a {@link deleteDocument} call. */
export interface DeletionResult {
  /** The Document in its resulting state (DELETE_PENDING on retry-needed, DELETED on success). */
  document: Document;
  /** `true` when all Blobs and DB children were removed and the Document is now DELETED. */
  cleanupComplete: boolean;
}

/**
 * Starts or retries deletion of an owned Document. Safe to call repeatedly.
 *
 * Behavior by current state:
 * - **ACTIVE** — flips to DELETE_PENDING (access removed immediately), then attempts cleanup.
 * - **DELETE_PENDING** — retries cleanup only (access was already removed by an earlier call).
 * - **DELETED / not owned / not found** — throws 404, matching every ownership-scoped lookup.
 *
 * @param owner - The owner that must match.
 * @param documentId - The Document to delete.
 * @returns A {@link DeletionResult}; `cleanupComplete: false` means a Blob delete failed and
 *   the caller should retry.
 * @throws {AppError} `DOCUMENT_NOT_FOUND` (404) when not owned or already DELETED.
 */
export async function deleteDocument(owner: Owner, documentId: string): Promise<DeletionResult> {
  const existing = await getDeletableDocument(owner, documentId);
  if (!existing) {
    throw new AppError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  }

  if (existing.deletionState === "ACTIVE") {
    // Guard the transition on the current state so a concurrent duplicate request can't
    // double-flip. A count of 0 just means another request already made the transition —
    // harmless, because the cleanup below is idempotent regardless.
    await prisma.document.updateMany({
      where: { id: documentId, ...ownerWhere(owner), deletionState: "ACTIVE" },
      data: { deletionState: "DELETE_PENDING" },
    });
  }

  return runCleanup(owner, documentId, existing);
}

/**
 * Performs the idempotent cleanup phase: delete Blobs first, then DB children, then mark DELETED.
 *
 * If any Blob delete fails, no DB rows are removed and the Document is reported as still
 * DELETE_PENDING so the caller retries. All DB child deletions and the final state change
 * happen in one transaction once every Blob is confirmed gone.
 *
 * @param owner - The owner that must match every scoped write.
 * @param documentId - The Document being cleaned up.
 * @param current - The Document as last read, used to shape the not-yet-complete result.
 * @returns A {@link DeletionResult} reflecting whether cleanup completed.
 */
async function runCleanup(
  owner: Owner,
  documentId: string,
  current: Document
): Promise<DeletionResult> {
  const pages = await prisma.page.findMany({
    where: { documentId, document: { ...ownerWhere(owner) } },
    select: { id: true, blobPath: true },
  });

  const blobFailureIds: string[] = [];
  for (const page of pages) {
    if (!page.blobPath) continue;
    try {
      await deletePageImage(page.blobPath);
    } catch {
      blobFailureIds.push(page.id);
    }
  }

  // Any Blob failure aborts before any DB row is touched, keeping the Page rows (and their
  // blobPaths) intact so the next call can retry the same paths.
  if (blobFailureIds.length > 0) {
    return { document: { ...current, deletionState: "DELETE_PENDING" }, cleanupComplete: false };
  }

  await prisma.$transaction([
    prisma.page.deleteMany({ where: { documentId, document: { ...ownerWhere(owner) } } }),
    prisma.section.deleteMany({ where: { documentId, document: { ...ownerWhere(owner) } } }),
    prisma.chatSessionDocument.deleteMany({
      where: { documentId, document: { ...ownerWhere(owner) } },
    }),
    prisma.chatMessageSource.deleteMany({
      where: { documentId, document: { ...ownerWhere(owner) } },
    }),
  ]);

  const document = await prisma.document.update({
    where: ownerScopedDocumentWhere(owner, documentId),
    data: { deletionState: "DELETED" },
  });

  return { document, cleanupComplete: true };
}
