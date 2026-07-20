/**
 * Page-image streaming API route.
 *
 * @module app/api/documents/[documentId]/pages/[pageId]/image/route
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { readPageImage } from "@/lib/storage/blob";
import { getCurrentOwner } from "@/lib/auth/session";
import { getOwnedDocument } from "@/lib/permissions/ownership";

/**
 * GET /api/documents/[documentId]/pages/[pageId]/image — streams a page's original image.
 *
 * Verifies document ownership before proxying any bytes from private Blob storage — the image
 * is never served without an auth check (`docs/03_OCR_Specifications.md` §4.3). Owner-aware,
 * so it works for both saved and temporary Documents. Responds with the raw image bytes and
 * `no-cache`/`nosniff` headers.
 *
 * @param request - The incoming request (unused).
 * @param context - Route context; `params` resolves to `{ documentId, pageId }`.
 * @returns The image bytes as a {@link NextResponse}; on error, a JSON body with 401
 *   unauthenticated, 404 not found, or 500 on unexpected failure.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string; pageId: string }> }
) {
  try {
    const { documentId, pageId } = await params;

    const owner = await getCurrentOwner();
    if (!owner) {
      throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
    }

    const document = await getOwnedDocument(owner, documentId);
    if (!document) {
      throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
    }

    const page = await prisma.page.findFirst({
      where: { id: pageId, documentId },
    });

    if (!page || !page.blobPath) {
      throw new AppError("Page image not found", 404, "PAGE_NOT_FOUND");
    }

    const { buffer, contentType } = await readPageImage(page.blobPath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Error streaming page image", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
