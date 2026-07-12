// Document deletion lifecycle (docs/08_Conditions_Translator_Implementation_Roadmap.md Phase 8,
// docs/09_Coding_Risk_Register.md R-002).
//
// Deletion is two-phase and idempotent:
//   1. ACTIVE -> DELETE_PENDING (owner-scoped, conditional on current state). This alone removes
//      the Document from every read/list path (getOwnedDocument/listOwnedDocuments/chat context
//      all require deletionState: "ACTIVE"), so access is gone before any cleanup runs.
//   2. Cleanup: delete each Page's stored Blob image FIRST, then delete the DB child rows, then
//      mark DELETED. Blob deletes happen before DB deletes — the reverse of the roadmap's listed
//      order — specifically so a failed cleanup is retryable without a schema change: Page rows
//      (and their blobPath) stay intact until every Blob object for this Document is confirmed
//      deleted, so calling deleteDocument again just re-reads the still-present blobPaths and
//      retries them. Only once all Blob deletes succeed are the DB children removed and the
//      Document marked DELETED.
//
// The Document row itself is never hard-deleted (it remains a DELETED tombstone) so deletionState
// stays a coherent, queryable lifecycle instead of the row simply vanishing.

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

export interface DeletionResult {
  document: Document;
  cleanupComplete: boolean;
}

/**
 * Starts or retries deletion of an owned Document. Safe to call repeatedly:
 * - ACTIVE -> flips to DELETE_PENDING (access removed immediately) and attempts cleanup.
 * - DELETE_PENDING -> retries cleanup only (access was already removed by an earlier call).
 * - DELETED / not owned / not found -> throws 404, matching every other ownership-scoped lookup.
 */
export async function deleteDocument(owner: Owner, documentId: string): Promise<DeletionResult> {
  const existing = await getDeletableDocument(owner, documentId);
  if (!existing) {
    throw new AppError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  }

  if (existing.deletionState === "ACTIVE") {
    // Conditional on the current state so a concurrent duplicate request can't double-flip.
    // count === 0 just means another request already made this transition — harmless, since
    // the cleanup below is idempotent either way.
    await prisma.document.updateMany({
      where: { id: documentId, ...ownerWhere(owner), deletionState: "ACTIVE" },
      data: { deletionState: "DELETE_PENDING" },
    });
  }

  return runCleanup(owner, documentId, existing);
}

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
