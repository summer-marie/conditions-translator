import type { Document, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";

// Centralized Document ownership and authorization.
//
// Every Document has exactly one owner: a signed-in User XOR an anonymous TemporarySession
// (docs/04_Schema_Architecture.md, docs/05_Account_Creation_and_Temporary_Access.md). All
// Document access MUST go through these functions so that no query is ever scoped by Document
// ID alone — the owner is always part of the WHERE clause (Coding Risk Register R-002).

export type Owner =
  | { kind: "user"; userId: string }
  | { kind: "temporary"; temporarySessionId: string };

export function userOwner(userId: string): Owner {
  return { kind: "user", userId };
}

export function temporaryOwner(temporarySessionId: string): Owner {
  return { kind: "temporary", temporarySessionId };
}

// WHERE fragment that scopes a Document query to a single owner. Never query without it.
export function ownerWhere(owner: Owner): Prisma.DocumentWhereInput {
  return owner.kind === "user"
    ? { userId: owner.userId }
    : { temporarySessionId: owner.temporarySessionId };
}

// Creates a Document with exactly one owner.
// - Temporary (session-owned) Documents require an expiry.
// - Saved (user-owned) Documents never expire automatically, so expiresAt is forced to null.
// The database CHECK constraints (documents_single_owner_check, documents_owner_expiry_check)
// are the backstop that guarantees these rules even if a caller bypasses this function.
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

// Ownership-scoped lookup. Returns the Document only if it belongs to the given owner,
// otherwise null. Uses findFirst with id + owner — never findUnique by id alone.
export async function getOwnedDocument(
  owner: Owner,
  documentId: string
): Promise<Document | null> {
  return prisma.document.findFirst({
    where: { id: documentId, ...ownerWhere(owner) },
  });
}

// Lists all Documents belonging to the given owner, newest first.
export async function listOwnedDocuments(owner: Owner): Promise<Document[]> {
  return prisma.document.findMany({
    where: ownerWhere(owner),
    orderBy: { createdAt: "desc" },
  });
}

// Asserts ownership, returning the Document or throwing a 404 (not 403) so the response
// never reveals whether a Document with that id exists under a different owner.
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
