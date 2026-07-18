// GET /api/documents
//
// Lists the current owner's active, not-yet-expired documents. The owner is resolved from
// cookies (getCurrentOwner) — a signed-in user (Phase 7) sees their saved documents; otherwise
// the temporary session sees its documents. The query is always owner-scoped (never by document
// id alone), so this same route serves both temporary and saved workspaces after ownership
// transfer. This route needs a Document include (_count.pages, sections) that the shared
// listOwnedDocuments() helper doesn't support, so it applies the same notExpiredWhere() filter
// directly rather than calling that helper -- see lib/permissions/ownership.ts.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { getCurrentOwner } from "@/lib/auth/session";
import { ownerWhere, notExpiredWhere } from "@/lib/permissions/ownership";

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

    // Never log the raw error object verbatim — it may echo request/document content.
    console.error("Error listing documents:", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
