// Server Actions for document operations.
//
// These actions enforce ownership and document lifecycle rules.
// All document operations go through these functions to ensure consistency.

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  temporaryOwner,
  type Owner,
  getOwnedDocument,
  createDocument as createOwnedDocument,
} from "@/lib/permissions/ownership";
import { TEMP_SESSION_TTL_HOURS } from "@/lib/constants";
import {
  getTemporarySession,
  isPrivacyAccepted,
} from "@/lib/session/temporary";

/**
 * Creates a new IN_PROGRESS document for the current user.
 * If the user is authenticated, uses their userId.
 * If not authenticated, uses the temporary session ID.
 */
export async function createTemporaryDocument(
  title: string = "Untitled Document"
) {
  // Check if privacy notice has been accepted
  const privacyAccepted = await isPrivacyAccepted();
  if (!privacyAccepted) {
    throw new AppError(
      "Privacy notice must be accepted before creating a document.",
      403,
      "PRIVACY_NOT_ACCEPTED"
    );
  }

  // Get owner information
  const session = await getTemporarySession();
  if (!session) {
    throw new AppError(
      "No active session found.",
      401,
      "NO_ACTIVE_SESSION"
    );
  }

  const owner: Owner = temporaryOwner(session.id);
  const expiresAt = new Date(
    Date.now() + TEMP_SESSION_TTL_HOURS * 60 * 60 * 1000
  );

  // Create the document
  const document = await createOwnedDocument(owner, { title, expiresAt });

  return document;
}

/**
 * Finishes a document, transitioning it from IN_PROGRESS to READY status.
 * Only the owner can finish their document.
 * Requires at least one page to be uploaded.
 */
export async function finishDocument(documentId: string) {
  // Get owner information
  const session = await getTemporarySession();
  if (!session) {
    throw new AppError(
      "No active session found.",
      401,
      "NO_ACTIVE_SESSION"
    );
  }

  const owner: Owner = temporaryOwner(session.id);

  // Verify ownership and get document
  const document = await getOwnedDocument(owner, documentId);
  if (!document) {
    throw new AppError(
      "Document not found.",
      404,
      "DOCUMENT_NOT_FOUND"
    );
  }

  // Check if document is in IN_PROGRESS status
  if (document.status !== "IN_PROGRESS") {
    throw new AppError(
      "Document is not in IN_PROGRESS status.",
      400,
      "INVALID_DOCUMENT_STATUS"
    );
  }

  // Check if document has at least one page
  const pageCount = await prisma.page.count({
    where: { documentId },
  });

  if (pageCount === 0) {
    throw new AppError(
      "Document must have at least one page before finishing.",
      400,
      "NO_PAGES_UPLOADED"
    );
  }

  // Build update data based on owner type
  const whereClause = owner.kind === "user"
    ? { id: documentId, userId: owner.userId }
    : { id: documentId, temporarySessionId: owner.temporarySessionId };

  // Transition to READY status
  const updatedDocument = await prisma.document.update({
    where: whereClause,
    data: {
      status: "READY",
    },
  });

  // Revalidate workspace path
  revalidatePath("/app/workspace");

  return updatedDocument;
}

/**
 * Updates a document's title.
 * Only the owner can update their document.
 */
export async function updateDocumentTitle(
  documentId: string,
  title: string
) {
  // Get owner information
  const session = await getTemporarySession();
  if (!session) {
    throw new AppError(
      "No active session found.",
      401,
      "NO_ACTIVE_SESSION"
    );
  }

  const owner: Owner = temporaryOwner(session.id);

  // Verify ownership and get document
  const document = await getOwnedDocument(owner, documentId);
  if (!document) {
    throw new AppError(
      "Document not found.",
      404,
      "DOCUMENT_NOT_FOUND"
    );
  }

  // Build update data based on owner type
  const whereClause = owner.kind === "user"
    ? { id: documentId, userId: owner.userId }
    : { id: documentId, temporarySessionId: owner.temporarySessionId };

  // Update title
  const updatedDocument = await prisma.document.update({
    where: whereClause,
    data: {
      title,
    },
  });

  // Revalidate workspace path
  revalidatePath("/app/workspace");

  return updatedDocument;
}