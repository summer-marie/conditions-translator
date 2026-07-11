// API route for listing documents for the current session.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { cookies } from "next/headers";

const TMP_SESSION_COOKIE = "tmp_session";

/**
 * GET /api/documents?sessionId=<id>
 * Lists all documents for the given temporary session ID.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      throw new AppError("Session ID is required", 400, "SESSION_ID_REQUIRED");
    }

    // Get session ID from cookie for verification
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

    // Verify session ID matches
    if (session.id !== sessionId) {
      throw new AppError("Session ID mismatch", 403, "SESSION_MISMATCH");
    }

    // List documents for this session
    const documents = await prisma.document.findMany({
      where: {
        temporarySessionId: sessionId,
        deletionState: "ACTIVE",
      },
      include: {
        _count: {
          select: { pages: true },
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

    console.error("Error listing documents:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}