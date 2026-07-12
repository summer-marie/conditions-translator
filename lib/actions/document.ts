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
import { validateImageUpload } from "@/lib/validation/image";
import { uploadPageImage, deletePageImage } from "@/lib/storage/blob";
import { hasBlockingQualityIssue } from "@/lib/ocr/schema";
import { generateSectionsForDocument } from "@/lib/sections/generate";

// Resolves the current owner (temporary session only for now; Phase 7 adds user accounts) and
// asserts the Document exists, belongs to that owner, and is still IN_PROGRESS.
async function requireInProgressOwnedDocument(documentId: string) {
  const session = await getTemporarySession();
  if (!session) {
    throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
  }

  const owner: Owner = temporaryOwner(session.id);
  const document = await getOwnedDocument(owner, documentId);
  if (!document) {
    throw new AppError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
  }

  if (document.status !== "IN_PROGRESS") {
    throw new AppError(
      "Pages can only be changed while the document is in progress.",
      400,
      "INVALID_DOCUMENT_STATUS"
    );
  }

  return { owner, document };
}

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
 * Finishes a document: closes intake and starts section generation.
 * Only the owner can finish their document.
 * Requires at least one ACCEPTED page. Transitions IN_PROGRESS -> COMPLETED -> PROCESSING,
 * then -> READY on generation success or PROCESSING_FAILED on failure (never thrown for a
 * generation failure — that is a normal, retryable outcome the caller renders in the UI).
 */
export async function finishDocument(documentId: string) {
  const session = await getTemporarySession();
  if (!session) {
    throw new AppError(
      "No active session found.",
      401,
      "NO_ACTIVE_SESSION"
    );
  }

  const owner: Owner = temporaryOwner(session.id);

  const document = await getOwnedDocument(owner, documentId);
  if (!document) {
    throw new AppError(
      "Document not found.",
      404,
      "DOCUMENT_NOT_FOUND"
    );
  }

  if (document.status !== "IN_PROGRESS") {
    throw new AppError(
      "Document is not in IN_PROGRESS status.",
      400,
      "INVALID_DOCUMENT_STATUS"
    );
  }

  const acceptedPageCount = await prisma.page.count({
    where: { documentId, status: "ACCEPTED" },
  });

  if (acceptedPageCount === 0) {
    throw new AppError(
      "Document must have at least one accepted page before finishing.",
      400,
      "NO_ACCEPTED_PAGES"
    );
  }

  const whereClause = owner.kind === "user"
    ? { id: documentId, userId: owner.userId }
    : { id: documentId, temporarySessionId: owner.temporarySessionId };

  await prisma.document.update({
    where: whereClause,
    data: { status: "COMPLETED" },
  });

  const updatedDocument = await generateSectionsForDocument(owner, documentId);

  revalidatePath("/app/workspace");

  return updatedDocument;
}

/**
 * Retries section generation for a document stuck in PROCESSING_FAILED.
 * Only the owner can retry their document. Re-enters PROCESSING, then -> READY on success
 * or back to PROCESSING_FAILED on another failure.
 */
export async function retryDocumentProcessing(documentId: string) {
  const session = await getTemporarySession();
  if (!session) {
    throw new AppError(
      "No active session found.",
      401,
      "NO_ACTIVE_SESSION"
    );
  }

  const owner: Owner = temporaryOwner(session.id);

  const document = await getOwnedDocument(owner, documentId);
  if (!document) {
    throw new AppError(
      "Document not found.",
      404,
      "DOCUMENT_NOT_FOUND"
    );
  }

  if (document.status !== "PROCESSING_FAILED") {
    throw new AppError(
      "Document is not in a failed processing state.",
      400,
      "INVALID_DOCUMENT_STATUS"
    );
  }

  const updatedDocument = await generateSectionsForDocument(owner, documentId);

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

/**
 * Accepts a page: its current OcrResult.extractedText becomes the immutable, authoritative
 * source text for that page (docs/03_OCR_Specifications.md §5). Blocked when OCR hasn't
 * completed successfully, or when the model flagged a clearly bad-quality scan.
 */
export async function acceptPage(documentId: string, pageId: string) {
  await requireInProgressOwnedDocument(documentId);

  const page = await prisma.page.findFirst({
    where: { id: pageId, documentId },
    include: { ocr: true },
  });

  if (!page) {
    throw new AppError("Page not found.", 404, "PAGE_NOT_FOUND");
  }

  if (page.status !== "OCR_COMPLETE" || !page.ocr) {
    throw new AppError(
      "This page must complete OCR successfully before it can be accepted.",
      400,
      "PAGE_NOT_READY"
    );
  }

  const warnings = page.ocr.warnings as
    | { blurry: boolean; cutOff: boolean; sideways: boolean; incomplete: boolean; unreadable: boolean }
    | null;

  if (warnings && hasBlockingQualityIssue(warnings)) {
    throw new AppError(
      "This page's image quality is too low to accept. Please retake it.",
      422,
      "PAGE_QUALITY_BLOCKED"
    );
  }

  const updatedPage = await prisma.page.update({
    where: { id: pageId },
    data: { status: "ACCEPTED" },
  });

  revalidatePath("/app/workspace");

  return updatedPage;
}

/**
 * Replaces a page's image: clears its prior OCR result and resets it to PENDING so the
 * caller can trigger OCR again. Not allowed once the page has been accepted.
 */
export async function reuploadPage(documentId: string, pageId: string, formData: FormData) {
  await requireInProgressOwnedDocument(documentId);

  const page = await prisma.page.findFirst({ where: { id: pageId, documentId } });
  if (!page) {
    throw new AppError("Page not found.", 404, "PAGE_NOT_FOUND");
  }

  if (page.status === "ACCEPTED") {
    throw new AppError(
      "This page has already been accepted and cannot be re-uploaded.",
      400,
      "PAGE_ALREADY_ACCEPTED"
    );
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    throw new AppError("No file provided.", 400, "NO_FILE");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const { mimeType } = validateImageUpload(buffer, file.type);

  const prefix = process.env.BLOB_PATH_PREFIX || "conditions-translator";
  const extension = mimeType.split("/")[1];
  const pathname = `${prefix}/documents/${documentId}/pages/${page.id}.${extension}`;

  const blob = await uploadPageImage(pathname, buffer, mimeType);

  if (page.blobPath && page.blobPath !== blob.pathname) {
    await deletePageImage(page.blobPath);
  }

  await prisma.ocrResult.deleteMany({ where: { pageId } });

  const updatedPage = await prisma.page.update({
    where: { id: pageId },
    data: { status: "PENDING", ocrFailureReason: null, blobPath: blob.pathname },
  });

  revalidatePath("/app/workspace");

  return updatedPage;
}

/**
 * Deletes a page (and its stored image + OCR result) and compacts the remaining pages' order
 * so it stays contiguous starting at 0 — later uploads rely on that invariant.
 */
export async function deletePage(documentId: string, pageId: string) {
  await requireInProgressOwnedDocument(documentId);

  const page = await prisma.page.findFirst({ where: { id: pageId, documentId } });
  if (!page) {
    throw new AppError("Page not found.", 404, "PAGE_NOT_FOUND");
  }

  if (page.blobPath) {
    await deletePageImage(page.blobPath);
  }

  await prisma.page.delete({ where: { id: pageId } });

  const remainingPages = await prisma.page.findMany({
    where: { documentId },
    orderBy: { order: "asc" },
  });

  const reorderOps = remainingPages
    .map((p, index) => ({ id: p.id, currentOrder: p.order, targetOrder: index }))
    .filter((p) => p.currentOrder !== p.targetOrder)
    .map((p) =>
      prisma.page.update({ where: { id: p.id }, data: { order: p.targetOrder } })
    );

  if (reorderOps.length > 0) {
    await prisma.$transaction(reorderOps);
  }

  revalidatePath("/app/workspace");

  return { deleted: true };
}