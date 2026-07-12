// API route for page listing and upload, with 10-page limit enforcement and real
// image validation + private Blob storage (docs/03_OCR_Specifications.md, Phase 4).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { cookies } from "next/headers";
import { DOCUMENT_MAX_PAGES } from "@/lib/constants";
import { validateImageUpload } from "@/lib/validation/image";
import { uploadPageImage } from "@/lib/storage/blob";

const TMP_SESSION_COOKIE = "tmp_session";

/**
 * GET /api/documents/[documentId]/pages
 * Lists all pages for a document.
 */
export async function GET(
  request: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = params;

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(TMP_SESSION_COOKIE)?.value;

    if (!sessionToken) {
      throw new AppError("No session found", 401, "NO_SESSION");
    }

    const session = await prisma.temporarySession.findUnique({
      where: { token: sessionToken },
    });

    if (!session) {
      throw new AppError("Invalid session", 401, "INVALID_SESSION");
    }

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        temporarySessionId: session.id,
        deletionState: "ACTIVE",
      },
    });

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

    console.error("Error listing pages:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/documents/[documentId]/pages
 * Uploads a page to a document with 10-page limit enforcement.
 * Validates the image (magic bytes + size) and stores it in the private Blob store.
 * Does not run OCR — the client triggers OCR separately via
 * POST /api/documents/[documentId]/pages/[pageId]/ocr.
 */
export async function POST(
  request: Request,
  { params }: { params: { documentId: string } }
) {
  let createdPageId: string | null = null;

  try {
    const { documentId } = params;

    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(TMP_SESSION_COOKIE)?.value;

    if (!sessionToken) {
      throw new AppError("No session found", 401, "NO_SESSION");
    }

    const session = await prisma.temporarySession.findUnique({
      where: { token: sessionToken },
    });

    if (!session) {
      throw new AppError("Invalid session", 401, "INVALID_SESSION");
    }

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        temporarySessionId: session.id,
        deletionState: "ACTIVE",
      },
    });

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

    // Create the Page row first so its id can key a stable Blob pathname (re-upload later
    // overwrites the same object rather than accumulating orphans).
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
    // Roll back the Page row if the image never made it to storage.
    if (createdPageId) {
      await prisma.page.delete({ where: { id: createdPageId } }).catch(() => {});
    }

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Error uploading page", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
