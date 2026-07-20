/**
 * Orchestrates section generation for a Document (`docs/08_..._Roadmap.md` Phase 5,
 * `docs/09_Coding_Risk_Register.md` R-003 — the document lifecycle is a strict state machine).
 *
 * Called by both `finishDocument` and `retryDocumentProcessing`. A generation failure is an
 * expected outcome (transition to the retryable `PROCESSING_FAILED` state), not an
 * application error, so this function never throws on failure — it records the failed state
 * and returns. Only caller-checked pre-conditions (ownership, status) may surface as throws.
 *
 * @module lib/sections/generate
 */

import type { Document } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logger";
import { type Owner, ownerScopedDocumentWhere } from "@/lib/permissions/ownership";
import { generateDocumentSections } from "@/lib/sections/client";

/**
 * Runs the full generate-and-persist lifecycle transition for one owned Document.
 *
 * Moves the document to `PROCESSING`, gathers its ordered accepted page text, calls the
 * model, and — on success — replaces the document's sections and marks it `READY`, all in
 * one transaction. On any failure the document is moved to `PROCESSING_FAILED` (retryable)
 * and returned rather than throwing.
 *
 * @param owner - The owner; scopes every document/section write.
 * @param documentId - The document to (re)generate sections for.
 * @returns The updated {@link Document} in its resulting state (`READY` or `PROCESSING_FAILED`).
 */
export async function generateSectionsForDocument(
  owner: Owner,
  documentId: string
): Promise<Document> {
  await prisma.document.update({
    where: ownerScopedDocumentWhere(owner, documentId),
    data: { status: "PROCESSING" },
  });

  try {
    // Source text is the ACCEPTED pages only, in page order. The `ocr: { isNot: null }`
    // filter is a redundant safety guard — acceptPage() already requires completed OCR.
    const pages = await prisma.page.findMany({
      where: { documentId, status: "ACCEPTED", ocr: { isNot: null } },
      orderBy: { order: "asc" },
      include: { ocr: true },
    });

    if (pages.length === 0) {
      throw new Error("No accepted pages available for section generation.");
    }

    // The user-reviewed transcription is the source of truth: prefer correctedText (the
    // user's edit) and fall back to extractedText only when the page was accepted without
    // correction. When a correction exists the raw extraction is never sent to the model.
    const numberedPages = pages.map((page, index) => ({
      pageNumber: index + 1,
      pageId: page.id,
      text: page.ocr!.correctedText ?? page.ocr!.extractedText,
    }));

    const result = await generateDocumentSections({
      pages: numberedPages.map(({ pageNumber, text }) => ({ pageNumber, text })),
    });

    const pageIdByNumber = new Map(numberedPages.map((p) => [p.pageNumber, p.pageId]));

    const ops = [
      prisma.section.deleteMany({ where: { documentId } }),
      ...result.sections.map((section, index) =>
        prisma.section.create({
          data: {
            documentId,
            heading: section.heading,
            body: section.body,
            order: index,
            sources: {
              create: Array.from(new Set(section.sourcePageNumbers))
                .map((pageNumber) => pageIdByNumber.get(pageNumber))
                .filter((pageId): pageId is string => !!pageId)
                .map((pageId) => ({ pageId })),
            },
          },
        })
      ),
      prisma.document.update({
        where: ownerScopedDocumentWhere(owner, documentId),
        data: { status: "READY" },
      }),
    ];

    const results = await prisma.$transaction(ops);
    return results[results.length - 1] as Document;
  } catch (error) {
    // Log only the error's name — never the error itself, which can echo back
    // document/source text. The document is moved to the retryable failed state below.
    logger.error("Section generation failed", {
      documentId,
      errorName: error instanceof Error ? error.name : "unknown",
    });

    return prisma.document.update({
      where: ownerScopedDocumentWhere(owner, documentId),
      data: { status: "PROCESSING_FAILED" },
    });
  }
}
