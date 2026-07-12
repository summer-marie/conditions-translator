// GET /api/documents/[documentId]/pages/[pageId]/image
//
// Streams a page's original image from private Blob storage after verifying ownership.
// Never proxies bytes without an auth check (docs/03_OCR_Specifications.md §4.3 preview).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { readPageImage } from "@/lib/storage/blob";

const TMP_SESSION_COOKIE = "tmp_session";

export async function GET(
  request: Request,
  { params }: { params: { documentId: string; pageId: string } }
) {
  try {
    const { documentId, pageId } = params;

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
