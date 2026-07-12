// API route for document operations (fetch with sections, title update, deletion).
//
// Owner-aware: resolves the current owner (signed-in user takes precedence over a temporary
// session, docs/05_Account_Creation_and_Temporary_Access.md) so this route serves both saved and
// temporary Documents. Never queries by document id alone (docs/09 R-002).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getCurrentOwner } from "@/lib/auth/session";
import { getOwnedDocument, ownerWhere } from "@/lib/permissions/ownership";
import { deleteDocument } from "@/lib/documents/deletion";

/**
 * GET /api/documents/[documentId]
 * Fetches a single owned, ACTIVE document (with its generated sections, if any). Used to refresh
 * state after Finish Document / Retry, and by the dashboard.
 */
export async function GET(
  request: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = params;

    const owner = await getCurrentOwner();
    if (!owner) {
      throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
    }

    const document = await prisma.document.findFirst({
      where: { id: documentId, ...ownerWhere(owner), deletionState: "ACTIVE" },
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

    const owner = await getCurrentOwner();
    if (!owner) {
      throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
    }

    const document = await getOwnedDocument(owner, documentId);
    if (!document) {
      throw new AppError("Document not found", 404, "DOCUMENT_NOT_FOUND");
    }

    const body = await request.json();
    const { title } = body;

    if (typeof title !== "string" || title.trim().length === 0) {
      throw new AppError("Title is required", 400, "TITLE_REQUIRED");
    }

    if (title.length > 200) {
      throw new AppError("Title too long", 400, "TITLE_TOO_LONG");
    }

    const whereClause =
      owner.kind === "user"
        ? { id: documentId, userId: owner.userId }
        : { id: documentId, temporarySessionId: owner.temporarySessionId };

    const updatedDocument = await prisma.document.update({
      where: whereClause,
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

/**
 * DELETE /api/documents/[documentId]
 * Starts (or retries) deletion. See lib/documents/deletion.ts for the full lifecycle. Idempotent:
 * safe to call again if a prior call's storage cleanup failed partway.
 */
export async function DELETE(
  request: Request,
  { params }: { params: { documentId: string } }
) {
  try {
    const { documentId } = params;

    const owner = await getCurrentOwner();
    if (!owner) {
      throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
    }

    const result = await deleteDocument(owner, documentId);

    return NextResponse.json({
      deletionState: result.document.deletionState,
      cleanupComplete: result.cleanupComplete,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Error deleting document:", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
