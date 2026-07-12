// Orchestrates section generation for a Document (docs/08_..._Roadmap.md Phase 5,
// docs/09_Coding_Risk_Register.md R-003 — lifecycle is a strict state machine).
//
// Called by both finishDocument and retryDocumentProcessing. Never throws on a generation
// failure — that is an expected outcome (PROCESSING_FAILED, retryable), not an application
// error. Only pre-conditions checked by the caller (ownership, status) may throw.

import type { Document } from "@/generated/prisma/client";
import { prisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logger";
import { type Owner, ownerScopedDocumentWhere } from "@/lib/permissions/ownership";
import { generateDocumentSections } from "@/lib/sections/client";

export async function generateSectionsForDocument(
  owner: Owner,
  documentId: string
): Promise<Document> {
  await prisma.document.update({
    where: ownerScopedDocumentWhere(owner, documentId),
    data: { status: "PROCESSING" },
  });

  try {
    // Only ACCEPTED pages are source text; page order is preserved. `ocr: { isNot: null }` is a
    // belt-and-suspenders guard — acceptPage() already requires OCR to have completed.
    const pages = await prisma.page.findMany({
      where: { documentId, status: "ACCEPTED", ocr: { isNot: null } },
      orderBy: { order: "asc" },
      include: { ocr: true },
    });

    if (pages.length === 0) {
      throw new Error("No accepted pages available for section generation.");
    }

    const numberedPages = pages.map((page, index) => ({
      pageNumber: index + 1,
      pageId: page.id,
      text: page.ocr!.extractedText,
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
    // Never log the underlying error verbatim — it may echo back document/source text.
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
