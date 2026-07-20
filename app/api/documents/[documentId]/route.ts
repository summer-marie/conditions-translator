/**
 * Single-document API route: fetch with sections, title update, and deletion.
 *
 * Every handler is owner-aware — a signed-in user takes precedence over a temporary session
 * (`docs/05_Account_Creation_and_Temporary_Access.md`) — so the route serves both saved and
 * temporary Documents and never queries by document id alone (`docs/09` R-002).
 *
 * @module app/api/documents/[documentId]/route
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getCurrentOwner } from "@/lib/auth/session";
import { getOwnedDocument, ownerWhere, notExpiredWhere } from "@/lib/permissions/ownership";
import { deleteDocument } from "@/lib/documents/deletion";

/**
 * GET /api/documents/[documentId] — fetches one owned, ACTIVE, non-expired document.
 *
 * Includes the document's generated sections (with their source page ids). Used to refresh
 * state after Finish Document / Retry, and by the dashboard.
 *
 * @param request - The incoming request (unused).
 * @param context - Route context; `params` resolves to `{ documentId }`.
 * @returns A JSON {@link NextResponse} with `{ document }`; 401 unauthenticated, 404 not found,
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

    const document = await prisma.document.findFirst({
      where: { id: documentId, ...ownerWhere(owner), deletionState: "ACTIVE", ...notExpiredWhere() },
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

    // Log only the error name — never the raw error, which can echo request/document content.
    console.error("Error fetching document:", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/documents/[documentId] — updates a document's title.
 *
 * Request body: `{ title: string }` (trimmed; must be non-empty and ≤ 200 chars). The update
 * is owner-scoped so it can never rename another owner's document.
 *
 * @param request - The incoming request; its JSON body supplies the new `title`.
 * @param context - Route context; `params` resolves to `{ documentId }`.
 * @returns A JSON {@link NextResponse} with `{ document }`; 400 invalid title, 401
 *   unauthenticated, 404 not found, 500 on unexpected failure.
 */
export async function PATCH(
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

    // Log only the error name — never the raw error, which can echo request/document content.
    console.error("Error updating document:", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/[documentId] — starts or retries document deletion.
 *
 * Delegates to {@link deleteDocument} for the two-phase, idempotent lifecycle, so it's safe
 * to call again when a prior call's storage cleanup failed partway.
 *
 * @param request - The incoming request (unused).
 * @param context - Route context; `params` resolves to `{ documentId }`.
 * @returns A JSON {@link NextResponse} with `{ deletionState, cleanupComplete }`; 401
 *   unauthenticated, 404 not found, 500 on unexpected failure.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;

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
