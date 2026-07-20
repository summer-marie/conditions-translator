/**
 * Documents collection API route.
 *
 * @module app/api/documents/route
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getCurrentOwner } from "@/lib/auth/session";
import { ownerWhere, notExpiredWhere } from "@/lib/permissions/ownership";

/**
 * GET /api/documents — lists the current owner's active, non-expired documents.
 *
 * The owner is resolved from cookies (`getCurrentOwner`) — a signed-in user sees their saved
 * documents, otherwise the temporary session sees its own. The query is always owner-scoped
 * (never by id alone), so this same route serves temporary and saved workspaces alike after
 * ownership transfer. It applies `notExpiredWhere()` directly rather than via
 * `listOwnedDocuments()` because it needs extra includes (`_count.pages`, `sections`) the
 * helper doesn't provide.
 *
 * Response body: `{ documents }`, each with a page count and its ordered sections (newest
 * document first). Returns 401 when there is no owner, 500 on unexpected failure.
 *
 * @returns A JSON {@link NextResponse} with the owner's documents.
 */
export async function GET() {
  try {
    const owner = await getCurrentOwner();
    if (!owner) {
      throw new AppError("No active session found.", 401, "NO_ACTIVE_SESSION");
    }

    const documents = await prisma.document.findMany({
      where: {
        ...ownerWhere(owner),
        deletionState: "ACTIVE",
        ...notExpiredWhere(),
      },
      include: {
        _count: {
          select: { pages: true },
        },
        sections: {
          orderBy: { order: "asc" },
          include: { sources: { select: { pageId: true } } },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    // Log only the error name — never the raw error, which can echo request/document content.
    console.error("Error listing documents:", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
