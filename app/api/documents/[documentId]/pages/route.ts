/**
 * Pages collection API route: list and upload a document's pages.
 *
 * Enforces the per-document page limit and performs real image validation (magic bytes +
 * size) with private Blob storage (`docs/03_OCR_Specifications.md`, Phase 4). Owner-aware
 * throughout.
 *
 * @module app/api/documents/[documentId]/pages/route
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { DOCUMENT_MAX_PAGES } from "@/lib/constants";
import { validateImageUpload } from "@/lib/validation/image";
import { uploadPageImage } from "@/lib/storage/blob";
import { BlobError } from "@vercel/blob";
import { getCurrentOwner } from "@/lib/auth/session";
import { getOwnedDocument } from "@/lib/permissions/ownership";

/**
 * GET /api/documents/[documentId]/pages — lists a document's pages in order.
 *
 * Owner-aware, so it works for both saved and temporary Documents. Each page includes its
 * OCR result when present.
 *
 * @param request - The incoming request (unused).
 * @param context - Route context; `params` resolves to `{ documentId }`.
 * @returns A JSON {@link NextResponse} with `{ pages }`; 401 unauthenticated, 404 not found,
 *   500 on unexpected failure.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

    const owner = await getCurrentOwner();
    if (!owner) {
      throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
    }

    const document = await getOwnedDocument(owner, documentId);
    if (!document) {
      throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
    }

    const pages = await prisma.page.findMany({
      where: { documentId },
      orderBy: { order: "asc" },
      include: { ocr: true },
    });

    return NextResponse.json({ pages });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    // Log only the error name — never the raw error, which can echo request/document content.
    console.error("Error listing pages:", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/[documentId]/pages — uploads a new page image to a document.
 *
 * Enforces the {@link DOCUMENT_MAX_PAGES} limit and validates the image (magic bytes + size)
 * before storing it in the private Blob store. The Page row is created first so its id can
 * key a stable Blob pathname; if storage fails, the row is rolled back. OCR is NOT run here —
 * the client triggers it separately via `POST .../pages/[pageId]/ocr`.
 *
 * Request body: multipart form data with a `file` field.
 *
 * @param request - The incoming request; its form data supplies the `file`.
 * @param context - Route context; `params` resolves to `{ documentId }`.
 * @returns A JSON {@link NextResponse} with `{ page }` (201); 400 no file / bad status, 401
 *   unauthenticated, 404 not found, 422 page-limit reached, 500 on unexpected failure.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  let createdPageId: string | null = null;

  try {
    const { documentId } = await params;

    const owner = await getCurrentOwner();
    if (!owner) {
      throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
    }

    const document = await getOwnedDocument(owner, documentId);
    if (!document) {
      throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
    }

    if (document.status !== "IN_PROGRESS") {
      throw new AppError(
        "Pages can only be added while the document is in progress.",
        400,
        "INVALID_DOCUMENT_STATUS"
      );
    }

    const currentPageCount = await prisma.page.count({
      where: { documentId },
    });

    if (currentPageCount >= DOCUMENT_MAX_PAGES) {
      throw new AppError(
        `Maximum of ${DOCUMENT_MAX_PAGES} pages per document`,
        422,
        "MAX_PAGES_EXCEEDED"
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new AppError("No file provided", 400, "NO_FILE");
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { mimeType } = validateImageUpload(buffer, file.type);

    // Create the Page row first so its id keys a stable Blob pathname; a later re-upload then
    // overwrites the same object instead of accumulating orphaned blobs.
    const page = await prisma.page.create({
      data: {
        documentId,
        order: currentPageCount,
      },
    });
    createdPageId = page.id;

    const prefix = process.env.BLOB_PATH_PREFIX || "conditions-translator";
    const extension = mimeType.split("/")[1];
    const pathname = `${prefix}/documents/${documentId}/pages/${page.id}.${extension}`;

    const blob = await uploadPageImage(pathname, buffer, mimeType);

    const updatedPage = await prisma.page.update({
      where: { id: page.id },
      data: { blobPath: blob.pathname },
    });

    return NextResponse.json({ page: updatedPage }, { status: 201 });
  } catch (error) {
    // Roll back the just-created Page row if the image never made it to storage, so no
    // blob-less page is left behind.
    if (createdPageId) {
      await prisma.page.delete({ where: { id: createdPageId } }).catch(() => {});
    }

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    // BlobError messages are storage/config diagnostics (auth/environment/content-type) that
    // never contain page or document content, so they're safe to log in full. Any other
    // unexpected error could echo request/document content, so only its name is logged.
    console.error(
      "Error uploading page",
      error instanceof BlobError
        ? `${error.name}: ${error.message}`
        : error instanceof Error
          ? error.name
          : "unknown error"
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
