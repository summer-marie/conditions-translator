/**
 * Centralized Document ownership and authorization.
 *
 * Every Document has exactly one owner: a signed-in User XOR an anonymous
 * TemporarySession (`docs/04_Schema_Architecture.md`,
 * `docs/05_Account_Creation_and_Temporary_Access.md`). ALL Document access must go through
 * the helpers here so no query is ever scoped by Document id alone — the owner is always
 * part of the WHERE clause (Coding Risk Register R-002). Bypassing these helpers is how an
 * authorization hole gets introduced, so new access paths should reuse them.
 *
 * @module lib/permissions/ownership
 */

import type { Document, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";

/** A Document's owner: either a signed-in user or an anonymous temporary session. */
export type Owner =
  | { kind: "user"; userId: string }
  | { kind: "temporary"; temporarySessionId: string };

/**
 * Constructs a user {@link Owner}.
 *
 * @param userId - The signed-in user's id.
 * @returns A user-kind owner.
 */
export function userOwner(userId: string): Owner {
  return { kind: "user", userId };
}

/**
 * Constructs a temporary-session {@link Owner}.
 *
 * @param temporarySessionId - The anonymous temporary session's id.
 * @returns A temporary-kind owner.
 */
export function temporaryOwner(temporarySessionId: string): Owner {
  return { kind: "temporary", temporarySessionId };
}

/**
 * Builds the WHERE fragment that scopes a Document query to a single owner.
 *
 * Every Document read must spread this into its `where`; a query without it is an
 * authorization bug.
 *
 * @param owner - The owner to scope to.
 * @returns A Prisma `where` fragment matching only that owner's Documents.
 */
export function ownerWhere(owner: Owner): Prisma.DocumentWhereInput {
  return owner.kind === "user"
    ? { userId: owner.userId }
    : { temporarySessionId: owner.temporarySessionId };
}

/**
 * Builds the WHERE fragment that excludes expired temporary Documents.
 *
 * Saved (user-owned) Documents have `expiresAt: null` and always match. This is a
 * read-time visibility filter only: it hides an expired Document from normal access paths
 * but does NOT delete its row, Pages, or Blob images (cleanup is handled separately by the
 * Phase 9 sweep). It is deliberately NOT applied by {@link getDeletableDocument}, because
 * the cleanup sweep must still find expired-but-ACTIVE Documents in order to delete them.
 *
 * @returns A Prisma `where` fragment matching non-expired (or non-expiring) Documents.
 */
export function notExpiredWhere(): Prisma.DocumentWhereInput {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] };
}

/**
 * Builds an owner-scoped *unique* WHERE for `update()`/`delete()` calls.
 *
 * Targets one Document by id while still enforcing ownership in the same query, so a write
 * can never be `{ id: documentId }` alone.
 *
 * @param owner - The owner that must match.
 * @param documentId - The Document id being written.
 * @returns A Prisma unique `where` combining id and owner.
 */
export function ownerScopedDocumentWhere(
  owner: Owner,
  documentId: string
): Prisma.DocumentWhereUniqueInput {
  return owner.kind === "user"
    ? { id: documentId, userId: owner.userId }
    : { id: documentId, temporarySessionId: owner.temporarySessionId };
}

/**
 * Creates a Document with exactly one owner and the correct expiry policy.
 *
 * Temporary (session-owned) Documents require an explicit expiry; saved (user-owned)
 * Documents never expire automatically, so `expiresAt` is forced to `null`. The database
 * CHECK constraints (`documents_single_owner_check`, `documents_owner_expiry_check`) are
 * the backstop that guarantees these rules even if a caller bypasses this function.
 *
 * @param owner - The owner the new Document belongs to.
 * @param input - The Document's `title` and, for temporary owners, its `expiresAt`.
 * @returns The created {@link Document}.
 * @throws {AppError} `TEMPORARY_DOCUMENT_REQUIRES_EXPIRY` (400) when a temporary Document
 *   is created without an expiry.
 */
export async function createDocument(
  owner: Owner,
  input: { title: string; expiresAt?: Date }
): Promise<Document> {
  if (owner.kind === "temporary") {
    if (!input.expiresAt) {
      throw new AppError(
        "Temporary documents require an expiry.",
        400,
        "TEMPORARY_DOCUMENT_REQUIRES_EXPIRY"
      );
    }
    return prisma.document.create({
      data: {
        title: input.title,
        temporarySessionId: owner.temporarySessionId,
        expiresAt: input.expiresAt,
      },
    });
  }

  return prisma.document.create({
    data: {
      title: input.title,
      userId: owner.userId,
      expiresAt: null,
    },
  });
}

/**
 * Loads a single owned, ACTIVE, non-expired Document.
 *
 * Uses `findFirst` with id + owner (never `findUnique` by id alone).
 * DELETE_PENDING/DELETED Documents are excluded so no normal read path can resurface a
 * deleted Document (Phase 8: "Deleted Documents cannot be selected").
 *
 * @param owner - The owner that must match.
 * @param documentId - The Document id to load.
 * @returns The {@link Document} when owned/ACTIVE/live, otherwise `null`.
 */
export async function getOwnedDocument(
  owner: Owner,
  documentId: string
): Promise<Document | null> {
  return prisma.document.findFirst({
    where: { id: documentId, ...ownerWhere(owner), deletionState: "ACTIVE", ...notExpiredWhere() },
  });
}

/**
 * Lists all ACTIVE, non-expired Documents belonging to an owner, newest first.
 *
 * @param owner - The owner whose Documents to list.
 * @returns The owner's visible Documents ordered by `createdAt` descending.
 */
export async function listOwnedDocuments(owner: Owner): Promise<Document[]> {
  return prisma.document.findMany({
    where: { ...ownerWhere(owner), deletionState: "ACTIVE", ...notExpiredWhere() },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Loads a Document for the deletion flow, tolerating an in-progress deletion.
 *
 * Unlike {@link getOwnedDocument}, this also matches a DELETE_PENDING Document so a failed
 * cleanup attempt can be retried. A fully DELETED Document (cleanup already finished)
 * still returns `null`. Deliberately omits {@link notExpiredWhere} so expired-but-ACTIVE
 * Documents remain deletable by the cleanup sweep.
 *
 * @param owner - The owner that must match.
 * @param documentId - The Document id to load.
 * @returns The {@link Document} when owned and ACTIVE/DELETE_PENDING, otherwise `null`.
 */
export async function getDeletableDocument(
  owner: Owner,
  documentId: string
): Promise<Document | null> {
  return prisma.document.findFirst({
    where: {
      id: documentId,
      ...ownerWhere(owner),
      deletionState: { in: ["ACTIVE", "DELETE_PENDING"] },
    },
  });
}

/**
 * Asserts that a Document is owned and visible, or throws.
 *
 * Throws a 404 (not a 403) on failure so the response never reveals whether a Document
 * with that id exists under a different owner.
 *
 * @param owner - The owner that must match.
 * @param documentId - The Document id to assert.
 * @returns The owned {@link Document}.
 * @throws {AppError} `DOCUMENT_NOT_FOUND` (404) when not owned/visible.
 */
export async function assertOwnedDocument(
  owner: Owner,
  documentId: string
): Promise<Document> {
  const document = await getOwnedDocument(owner, documentId);
  if (!document) {
    throw new AppError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  }
  return document;
}
