// POST /api/documents/[documentId]/pages/[pageId]/ocr
//
// Runs OpenAI Vision OCR on an already-uploaded page image (docs/03_OCR_Specifications.md,
// Phase 4 §4.2). Server-side only; never logs raw extracted text.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { readPageImage } from "@/lib/storage/blob";
import { runPageOcr } from "@/lib/ocr/client";
import { hasBlockingQualityIssue } from "@/lib/ocr/schema";

const TMP_SESSION_COOKIE = "tmp_session";
const DEFAULT_RETAKE_GUIDANCE =
  "The image quality was too low to extract text. Please retake the photo in good lighting with the full page visible.";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ documentId: string; pageId: string }> }
) {
  try {
    const { documentId, pageId } = await params;

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
        "OCR can only run while the document is in progress.",
        400,
        "INVALID_DOCUMENT_STATUS"
      );
    }

    // Ownership is scoped through the parent Document — never look up a Page by id alone.
    const page = await prisma.page.findFirst({
      where: { id: pageId, documentId },
    });

    if (!page) {
      throw new AppError("Page not found", 404, "PAGE_NOT_FOUND");
    }

    if (page.status === "ACCEPTED") {
      throw new AppError(
        "This page has already been accepted; its text is final.",
        400,
        "PAGE_ALREADY_ACCEPTED"
      );
    }

    if (!page.blobPath) {
      throw new AppError("This page has no stored image.", 400, "PAGE_MISSING_IMAGE");
    }

    const { buffer, contentType } = await readPageImage(page.blobPath);
    const result = await runPageOcr({ imageBuffer: buffer, contentType });

    const failed = result.quality.unreadable || result.extractedText.trim().length === 0;

    if (failed) {
      await prisma.ocrResult.deleteMany({ where: { pageId } });
      const updatedPage = await prisma.page.update({
        where: { id: pageId },
        data: {
          status: "OCR_FAILED",
          ocrFailureReason: result.retakeGuidance ?? DEFAULT_RETAKE_GUIDANCE,
        },
      });

      return NextResponse.json({
        page: updatedPage,
        ocr: null,
        blockingQualityIssue: true,
      });
    }

    const ocrResult = await prisma.ocrResult.upsert({
      where: { pageId },
      create: {
        pageId,
        extractedText: result.extractedText,
        confidence: result.confidence,
        warnings: { ...result.quality, retakeGuidance: result.retakeGuidance },
      },
      update: {
        extractedText: result.extractedText,
        confidence: result.confidence,
        warnings: { ...result.quality, retakeGuidance: result.retakeGuidance },
      },
    });

    const updatedPage = await prisma.page.update({
      where: { id: pageId },
      data: { status: "OCR_COMPLETE", ocrFailureReason: null },
    });

    return NextResponse.json({
      page: updatedPage,
      ocr: ocrResult,
      blockingQualityIssue: hasBlockingQualityIssue(result.quality),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    // Never interpolate the raw error (its message could echo request/document content) —
    // only its name is safe to log.
    console.error("Error running OCR", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
