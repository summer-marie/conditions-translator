/**
 * Server Actions for document and page operations.
 *
 * Every action resolves the current {@link Owner} and enforces the document lifecycle state
 * machine before mutating anything, so ownership and status rules are applied consistently
 * across intake, correction, acceptance, finishing, and deletion. Client components call
 * these directly instead of hitting an API route.
 *
 * @module lib/actions/document
 */

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import {
  temporaryOwner,
  type Owner,
  getOwnedDocument,
  createDocument as createOwnedDocument,
  ownerWhere,
} from "@/lib/permissions/ownership";
import {
  TEMP_SESSION_TTL_HOURS,
  DEFAULT_DOCUMENT_TITLE,
  OCR_MAX_CORRECTION_CHARACTERS,
} from "@/lib/constants";
import {
  getTemporarySession,
  isPrivacyAccepted,
} from "@/lib/session/temporary";
import { getCurrentOwner } from "@/lib/auth/session";
import { validateImageUpload } from "@/lib/validation/image";
import { uploadPageImage, deletePageImage } from "@/lib/storage/blob";
import { hasBlockingQualityIssue } from "@/lib/ocr/schema";
import { generateSectionsForDocument } from "@/lib/sections/generate";

/**
 * Resolves the current owner and asserts an IN_PROGRESS Document it owns.
 *
 * A signed-in user takes precedence over a temporary session, matching every owner-aware
 * API route (`docs/05_Account_Creation_and_Temporary_Access.md`). Used by every page-editing
 * action, since pages can only change while intake is open.
 *
 * @param documentId - The Document being edited.
 * @returns The resolved `owner` and the loaded `document`.
 * @throws {AppError} `NO_ACTIVE_SESSION` (401) when there is no owner.
 * @throws {AppError} `DOCUMENT_NOT_FOUND` (404) when not owned or not found.
 * @throws {AppError} `INVALID_DOCUMENT_STATUS` (400) when the Document is not IN_PROGRESS.
 */
async function requireInProgressOwnedDocument(documentId: string) {
  const owner = await getCurrentOwner();
  if (!owner) {
    throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
  }

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
 * Creates a new IN_PROGRESS Document owned by the current temporary session.
 *
 * Requires the privacy notice to have been accepted first. The new Document is given a
 * temporary-session expiry derived from {@link TEMP_SESSION_TTL_HOURS}.
 *
 * @param title - Initial title; defaults to {@link DEFAULT_DOCUMENT_TITLE}.
 * @returns The created Document.
 * @throws {AppError} `PRIVACY_NOT_ACCEPTED` (403) when the notice hasn't been accepted.
 * @throws {AppError} `NO_ACTIVE_SESSION` (401) when there is no temporary session.
 */
export async function createTemporaryDocument(
  title: string = DEFAULT_DOCUMENT_TITLE
) {
  // Gate document creation on privacy acceptance — nothing is stored before consent.
  const privacyAccepted = await isPrivacyAccepted();
  if (!privacyAccepted) {
    throw new AppError(
      "Privacy notice must be accepted before creating a document.",
      403,
      "PRIVACY_NOT_ACCEPTED"
    );
  }

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

  const document = await createOwnedDocument(owner, { title, expiresAt });

  return document;
}

/**
 * Finishes a Document: closes intake and runs section generation.
 *
 * Requires at least one ACCEPTED page. Transitions IN_PROGRESS → COMPLETED → PROCESSING,
 * then → READY on generation success or → PROCESSING_FAILED on failure. A generation
 * failure is a normal, retryable outcome (rendered in the UI), so it is never thrown.
 *
 * @param documentId - The Document to finish.
 * @returns The updated Document in its resulting state.
 * @throws {AppError} `NO_ACTIVE_SESSION` (401) when there is no owner.
 * @throws {AppError} `DOCUMENT_NOT_FOUND` (404) when not owned or not found.
 * @throws {AppError} `INVALID_DOCUMENT_STATUS` (400) when the Document is not IN_PROGRESS.
 * @throws {AppError} `NO_ACCEPTED_PAGES` (400) when no page has been accepted.
 */
export async function finishDocument(documentId: string) {
  const owner = await getCurrentOwner();
  if (!owner) {
    throw new AppError(
      "No active session found.",
      401,
      "NO_ACTIVE_SESSION"
    );
  }

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

  // Owner-scoped update so the status change can never touch another owner's Document.
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
 * Retries section generation for a Document stuck in PROCESSING_FAILED.
 *
 * Re-enters PROCESSING, then → READY on success or back to PROCESSING_FAILED on another
 * failure (again never thrown for a generation failure).
 *
 * @param documentId - The failed Document to retry.
 * @returns The updated Document in its resulting state.
 * @throws {AppError} `NO_ACTIVE_SESSION` (401) when there is no owner.
 * @throws {AppError} `DOCUMENT_NOT_FOUND` (404) when not owned or not found.
 * @throws {AppError} `INVALID_DOCUMENT_STATUS` (400) when the Document is not PROCESSING_FAILED.
 */
export async function retryDocumentProcessing(documentId: string) {
  const owner = await getCurrentOwner();
  if (!owner) {
    throw new AppError(
      "No active session found.",
      401,
      "NO_ACTIVE_SESSION"
    );
  }

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
 * Updates a Document's title.
 *
 * @param documentId - The Document to rename.
 * @param title - The new title.
 * @returns The updated Document.
 * @throws {AppError} `NO_ACTIVE_SESSION` (401) when there is no owner.
 * @throws {AppError} `DOCUMENT_NOT_FOUND` (404) when not owned or not found.
 */
export async function updateDocumentTitle(
  documentId: string,
  title: string
) {
  const owner = await getCurrentOwner();
  if (!owner) {
    throw new AppError(
      "No active session found.",
      401,
      "NO_ACTIVE_SESSION"
    );
  }

  const document = await getOwnedDocument(owner, documentId);
  if (!document) {
    throw new AppError(
      "Document not found.",
      404,
      "DOCUMENT_NOT_FOUND"
    );
  }

  // Owner-scoped update so a title change can never touch another owner's Document.
  const whereClause = owner.kind === "user"
    ? { id: documentId, userId: owner.userId }
    : { id: documentId, temporarySessionId: owner.temporarySessionId };

  const updatedDocument = await prisma.document.update({
    where: whereClause,
    data: {
      title,
    },
  });

  revalidatePath("/app/workspace");

  return updatedDocument;
}

/**
 * Accepts a page, making its transcription the authoritative source text.
 *
 * From acceptance on, the page's accepted text (`correctedText` if edited, else
 * `extractedText`) is the immutable source of truth for that page
 * (`docs/03_OCR_Specifications.md` §5). Acceptance is blocked until OCR has completed
 * successfully, and rejected outright when the model flagged a clearly unreadable scan
 * (see {@link hasBlockingQualityIssue}).
 *
 * @param documentId - The owning Document (must be IN_PROGRESS).
 * @param pageId - The page to accept.
 * @returns The updated page.
 * @throws {AppError} `PAGE_NOT_FOUND` (404) when the page isn't in this Document.
 * @throws {AppError} `PAGE_NOT_READY` (400) when OCR hasn't completed.
 * @throws {AppError} `PAGE_QUALITY_BLOCKED` (422) when the scan is too low-quality to accept.
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

  if (warnings && hasBlockingQualityIssue(warnings, page.ocr.extractedText)) {
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
 * Saves a user correction to a page's proposed OCR transcription.
 *
 * Writes only `OcrResult.correctedText`; the raw `extractedText`, the page image, and its
 * `blobPath` are never touched (`docs/OCR_Master_Implementation_Plan.md` §7–8,
 * `docs/Decision_Log.md` ADR-001). It neither changes page/document status nor accepts the
 * page, and is only permitted while OCR has completed and the page is not yet accepted (an
 * ACCEPTED page is never OCR_COMPLETE, so it is rejected here too).
 *
 * The upfront reads exist only to return specific error messages; they hold no lock, so a
 * concurrent accept/reupload/finish could change state between validation and this write.
 * The actual write is therefore a conditional `updateMany` (the same
 * updateMany-then-check-count pattern as `lib/documents/deletion.ts`) whose `where`
 * re-proves every eligibility rule atomically. If state changed, it matches nothing and the
 * `count === 0` branch reports a conflict instead of corrupting an already-changed page.
 *
 * @param documentId - The owning Document (must be IN_PROGRESS).
 * @param pageId - The page whose transcription is being corrected.
 * @param text - The corrected transcription text.
 * @returns The updated OcrResult.
 * @throws {AppError} `PAGE_NOT_FOUND` (404) when the page isn't in this Document.
 * @throws {AppError} `PAGE_NOT_READY` (400) when OCR hasn't completed.
 * @throws {AppError} `CORRECTION_EMPTY` (400) when the trimmed text is empty.
 * @throws {AppError} `CORRECTION_TOO_LONG` (400) when it exceeds {@link OCR_MAX_CORRECTION_CHARACTERS}.
 * @throws {AppError} `PAGE_STATE_CHANGED` (409) when the page changed state concurrently.
 */
export async function correctPageOcr(documentId: string, pageId: string, text: string) {
  const { owner } = await requireInProgressOwnedDocument(documentId);

  const page = await prisma.page.findFirst({
    where: { id: pageId, documentId },
    include: { ocr: true },
  });

  if (!page) {
    throw new AppError("Page not found.", 404, "PAGE_NOT_FOUND");
  }

  if (page.status !== "OCR_COMPLETE" || !page.ocr) {
    throw new AppError(
      "This page must complete OCR successfully before its transcription can be corrected.",
      400,
      "PAGE_NOT_READY"
    );
  }

  const trimmed = text.trim();

  if (trimmed.length === 0) {
    throw new AppError(
      "Correction text cannot be empty.",
      400,
      "CORRECTION_EMPTY"
    );
  }

  if (trimmed.length > OCR_MAX_CORRECTION_CHARACTERS) {
    throw new AppError(
      `Correction text cannot exceed ${OCR_MAX_CORRECTION_CHARACTERS} characters.`,
      400,
      "CORRECTION_TOO_LONG"
    );
  }

  const { count } = await prisma.ocrResult.updateMany({
    where: {
      pageId,
      page: {
        documentId,
        status: "OCR_COMPLETE",
        document: { status: "IN_PROGRESS", ...ownerWhere(owner) },
      },
    },
    data: { correctedText: trimmed },
  });

  if (count === 0) {
    throw new AppError(
      "This page can no longer be corrected. It may have been accepted, re-uploaded, or the document may have changed.",
      409,
      "PAGE_STATE_CHANGED"
    );
  }

  const updatedOcr = await prisma.ocrResult.findUniqueOrThrow({ where: { pageId } });

  revalidatePath("/app/workspace");

  return updatedOcr;
}

/**
 * Replaces a page's image and resets it for re-OCR.
 *
 * Validates and stores the new image, deletes the old Blob (when its path changed), clears
 * the prior OcrResult, and resets the page to PENDING so the caller can trigger OCR again.
 * Not allowed once the page has been accepted.
 *
 * @param documentId - The owning Document (must be IN_PROGRESS).
 * @param pageId - The page whose image is being replaced.
 * @param formData - Multipart form data containing the new `file`.
 * @returns The updated page (status PENDING).
 * @throws {AppError} `PAGE_NOT_FOUND` (404) when the page isn't in this Document.
 * @throws {AppError} `PAGE_ALREADY_ACCEPTED` (400) when the page is already accepted.
 * @throws {AppError} `NO_FILE` (400) when no file was provided.
 * @throws {AppError} Propagated from {@link validateImageUpload} for an invalid image.
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
 * Deletes a page and compacts the remaining pages' order.
 *
 * Removes the page's stored image and (via cascade) its OCR result, then renumbers the
 * remaining pages so `order` stays contiguous from 0 — later uploads rely on that
 * invariant to compute the next page's position.
 *
 * @param documentId - The owning Document (must be IN_PROGRESS).
 * @param pageId - The page to delete.
 * @returns `{ deleted: true }` on success.
 * @throws {AppError} `PAGE_NOT_FOUND` (404) when the page isn't in this Document.
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