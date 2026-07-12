// Assembles the grounded AI request context from the selected READY documents
// (docs/06_AI_Safety_and_Persona.md §5, docs/07_Launch_Readiness_Checklist.md §6,
// docs/09_Coding_Risk_Register.md R-004).
//
// Guarantees enforced here:
//   - Only the caller's own documents are read (ownership-scoped — never by id alone).
//   - Only READY, ACTIVE documents are eligible; anything else is rejected server-side even if
//     the UI allowed it.
//   - Only ACCEPTED page text enters the context, in page order.
//   - The combined confirmed-text character limit is enforced by FAILING CLEARLY. Source text is
//     never silently truncated (R-004).

import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { ownerWhere, type Owner } from "@/lib/permissions/ownership";
import {
  CHAT_MAX_CONFIRMED_CHARACTERS,
  CHAT_MAX_DOCUMENTS,
} from "@/lib/constants";

export interface AssembledPage {
  pageNumber: number; // 1-based position among this document's accepted pages
  pageId: string;
  text: string;
}

export interface AssembledDocument {
  documentNumber: number; // 1-based position in the selection
  documentId: string;
  title: string;
  pages: AssembledPage[];
}

export interface AssembledContext {
  documents: AssembledDocument[];
  documentsBlock: string;
  totalCharacters: number;
}

/**
 * Loads and validates the selected documents, then builds the numbered source-text block sent to
 * the model. Throws (never truncates) when the selection is invalid or exceeds a limit.
 */
export async function assembleChatContext(
  owner: Owner,
  documentIds: string[]
): Promise<AssembledContext> {
  if (documentIds.length === 0) {
    throw new AppError(
      "Select at least one document to start a chat.",
      400,
      "NO_DOCUMENTS_SELECTED"
    );
  }

  // De-duplicate while preserving selection order.
  const uniqueIds = [...new Set(documentIds)];

  if (uniqueIds.length > CHAT_MAX_DOCUMENTS) {
    throw new AppError(
      `You can select up to ${CHAT_MAX_DOCUMENTS} documents for a chat.`,
      400,
      "TOO_MANY_DOCUMENTS"
    );
  }

  const documents: AssembledDocument[] = [];
  let totalCharacters = 0;

  for (let i = 0; i < uniqueIds.length; i++) {
    const documentId = uniqueIds[i];

    // Ownership-scoped read: id + owner, plus the eligibility guards. A non-READY or deleted
    // document is indistinguishable from "not found" so the response never reveals its state.
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        ...ownerWhere(owner),
        status: "READY",
        deletionState: "ACTIVE",
      },
      include: {
        pages: {
          where: { status: "ACCEPTED", ocr: { isNot: null } },
          orderBy: { order: "asc" },
          include: { ocr: true },
        },
      },
    });

    if (!document) {
      throw new AppError(
        "One or more selected documents are unavailable for chat.",
        400,
        "DOCUMENT_NOT_AVAILABLE"
      );
    }

    const pages: AssembledPage[] = document.pages.map((page, index) => ({
      pageNumber: index + 1,
      pageId: page.id,
      text: page.ocr!.extractedText,
    }));

    for (const page of pages) {
      totalCharacters += page.text.length;
    }

    documents.push({
      documentNumber: i + 1,
      documentId: document.id,
      title: document.title,
      pages,
    });
  }

  // Fail clearly rather than degrade silently (R-004): the user is told to remove a document or
  // start a fresh chat; selected source text is never trimmed to fit.
  if (totalCharacters > CHAT_MAX_CONFIRMED_CHARACTERS) {
    throw new AppError(
      "The selected documents contain too much text for one chat. Remove a document or start a new chat.",
      400,
      "CONFIRMED_TEXT_LIMIT_EXCEEDED"
    );
  }

  const documentsBlock = documents
    .map((document) => {
      const header = `=== Document ${document.documentNumber}: "${document.title}" ===`;
      const body = document.pages
        .map(
          (page) =>
            `--- Document ${document.documentNumber}, Page ${page.pageNumber} ---\n${page.text}`
        )
        .join("\n\n");
      return `${header}\n${body}`;
    })
    .join("\n\n");

  return { documents, documentsBlock, totalCharacters };
}
