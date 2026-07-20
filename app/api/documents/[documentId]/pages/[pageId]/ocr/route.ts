/**
 * Page OCR API route.
 *
 * @module app/api/documents/[documentId]/pages/[pageId]/ocr/route
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { readPageImage } from "@/lib/storage/blob";
import { runPageOcr } from "@/lib/ocr/client";
import { hasBlockingQualityIssue } from "@/lib/ocr/schema";
import { getCurrentOwner } from "@/lib/auth/session";
import { getOwnedDocument } from "@/lib/permissions/ownership";

/** Fallback retake message used when the model returns no specific guidance. */
const DEFAULT_RETAKE_GUIDANCE =
  "The image quality was too low to extract text. Please retake the photo in good lighting with the full page visible.";

/**
 * POST /api/documents/[documentId]/pages/[pageId]/ocr — runs OCR on a stored page image.
 *
 * Runs OpenAI Vision OCR (server-side only; never logs raw text) on an already-uploaded page
 * image (`docs/03_OCR_Specifications.md`, Phase 4 §4.2). On an unreadable/empty result the
 * page moves to OCR_FAILED with retake guidance; otherwise the extraction is upserted (always
 * clearing any stale `correctedText`) and the page moves to OCR_COMPLETE.
 *
 * Response body: `{ page, ocr, blockingQualityIssue }` — `ocr` is `null` on failure.
 *
 * @param request - The incoming request (unused).
 * @param context - Route context; `params` resolves to `{ documentId, pageId }`.
 * @returns A JSON {@link NextResponse}; 400 bad status / accepted / missing image, 401
 *   unauthenticated, 404 not found, 500 on unexpected failure.
 */
export async function POST(
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

    if (document.status !== "IN_PROGRESS") {
      throw new AppError(
        "OCR can only run while the document is in progress.",
        400,
        "INVALID_DOCUMENT_STATUS"
      );
    }

    // Scope the page lookup through its already-verified parent Document — never fetch a Page
    // by id alone, which would bypass the ownership check.
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
    // TEMP DIAGNOSTIC (added 2026-07-14; remove once the OCR-502 investigation closes).
    // Logs only ids and byte size — never image content or extracted text.
    console.log("[ocr-diag] route invoking OCR", {
      documentId,
      pageId,
      imageBytes: buffer.length,
      contentType,
    });
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

    // A fresh extraction always resets correctedText to null: the prior correction was
    // reviewed against the previous extractedText that this run replaces, so it must not carry
    // over onto new raw output. Both upsert branches set it explicitly (create has no prior row
    // to carry from, but stays consistent).
    const ocrResult = await prisma.ocrResult.upsert({
      where: { pageId },
      create: {
        pageId,
        extractedText: result.extractedText,
        correctedText: null,
        confidence: result.confidence,
        warnings: { ...result.quality, retakeGuidance: result.retakeGuidance },
      },
      update: {
        extractedText: result.extractedText,
        correctedText: null,
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
      blockingQualityIssue: hasBlockingQualityIssue(result.quality, result.extractedText),
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }

    // Log only the error name — the raw message could echo request/document content.
    console.error("Error running OCR", error instanceof Error ? error.name : "unknown error");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
