// API route for page upload with 10-page limit enforcement.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { cookies } from "next/headers";
import { DOCUMENT_MAX_PAGES } from "@/lib/constants";

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

    // List pages for this document
    const pages = await prisma.page.findMany({
      where: { documentId },
      orderBy: { order: "asc" },
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
 */
export async function POST(
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

    // Check page count
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

    // Get file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      throw new AppError("No file provided", 400, "NO_FILE");
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      throw new AppError(
        "Invalid file type. Only JPEG, PNG, and PDF files are allowed",
        400,
        "INVALID_FILE_TYPE"
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new AppError(
        "File too large. Maximum size is 10MB",
        400,
        "FILE_TOO_LARGE"
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate a unique blob path
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const blobPath = `documents/${documentId}/${timestamp}-${randomString}-${file.name}`;

    // In a real implementation, you would upload to Vercel Blob here
    // For now, we'll store a placeholder path
    // TODO: Integrate Vercel Blob storage in Phase 4

    // Create page record
    const page = await prisma.page.create({
      data: {
        documentId,
        order: currentPageCount,
        blobPath: blobPath,
      },
    });

    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    console.error("Error uploading page:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}