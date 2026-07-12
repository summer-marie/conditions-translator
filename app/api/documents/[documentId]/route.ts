// API route for document operations (fetch with sections, title update).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { cookies } from "next/headers";

const TMP_SESSION_COOKIE = "tmp_session";

/**
 * GET /api/documents/[documentId]
 * Fetches a single document (with its generated sections, if any) scoped to the caller's
 * temporary session. Used to refresh state after Finish Document / Retry.
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
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: { sources: { select: { pageId: true } } },
        },
      },
    });

    if (!document) {
      throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
    }

    return NextResponse.json({ document });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/[documentId]
 * Updates a document's title.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = params;

    // Get session token from cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get(TMP_SESSION_COOKIE)?.value;

    if (!sessionToken) {
      throw new AppError("No session found", 401, "NO_SESSION");
    }

    // Verify the session token
    const session = await prisma.temporarySession.findUnique({
      where: { token: sessionToken },
    });

    if (!session) {
      throw new AppError("Invalid session", 401, "INVALID_SESSION");
    }

    // Verify document ownership
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

    // Get request body
    const body = await request.json();
    const { title } = body;

    if (typeof title !== "string" || title.trim().length === 0) {
      throw new AppError("Title is required", 400, "TITLE_REQUIRED");
    }

    if (title.length > 200) {
      throw new AppError("Title too long", 400, "TITLE_TOO_LONG");
    }

    // Update document title
    const updatedDocument = await prisma.document.update({
      where: {
        id: documentId,
        temporarySessionId: session.id,
      },
      data: { title: title.trim() },
    });

    return NextResponse.json({ document: updatedDocument });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}