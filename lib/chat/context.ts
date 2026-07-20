/**
 * Assembles the grounded AI request context from the selected READY documents
 * (`docs/06_AI_Safety_and_Persona.md` §5, `docs/07_Launch_Readiness_Checklist.md` §6,
 * `docs/09_Coding_Risk_Register.md` R-004).
 *
 * Every safety guarantee for what the model may see is enforced here, server-side, even
 * if the UI would have allowed otherwise:
 *
 * - **Ownership-scoped reads.** Documents are matched by id *and* owner, never by id alone.
 * - **Eligibility.** Only READY, ACTIVE documents qualify; anything else is treated as
 *   "not found" so the response never reveals a document's state.
 * - **Accepted text only.** Only ACCEPTED page text enters the context, in page order.
 * - **Fail loud, never truncate.** Exceeding the confirmed-text character budget throws
 *   a clear error; source text is never silently trimmed to fit (R-004).
 *
 * @module lib/chat/context
 */

import { prisma } from "@/lib/database/prisma";
import { AppError } from "@/lib/errors";
import { ownerWhere, type Owner } from "@/lib/permissions/ownership";
import {
  CHAT_MAX_CONFIRMED_CHARACTERS,
  CHAT_MAX_DOCUMENTS,
} from "@/lib/constants";

/** One accepted page within an assembled document. */
export interface AssembledPage {
  /** 1-based position among this document's accepted pages. */
  pageNumber: number;
  /** The page's database id. */
  pageId: string;
  /** The accepted transcription text for this page. */
  text: string;
}

/** One selected document with its ordered accepted pages. */
export interface AssembledDocument {
  /** 1-based position of this document within the selection. */
  documentNumber: number;
  /** The document's database id. */
  documentId: string;
  /** The document's title, shown to the model as a section header. */
  title: string;
  /** The document's accepted pages, in page order. */
  pages: AssembledPage[];
}

/** The fully-assembled grounding context returned to the caller. */
export interface AssembledContext {
  /** Structured per-document/page breakdown (used for citation mapping). */
  documents: AssembledDocument[];
  /** The flat, numbered source-text block passed to the model. */
  documentsBlock: string;
  /** Total character count across all included page text. */
  totalCharacters: number;
}

/**
 * Loads and validates the selected documents, then builds the numbered source-text block
 * sent to the model.
 *
 * De-duplicates ids while preserving selection order, enforces the document-count and
 * confirmed-character limits, and — per R-004 — throws rather than truncating when a
 * limit is exceeded so the user is told to adjust their selection instead of receiving a
 * silently degraded answer.
 *
 * @param owner - The current request's owner; scopes every document read.
 * @param documentIds - The selected document ids, in the user's chosen order.
 * @returns The {@link AssembledContext} containing both the structured breakdown and the
 *   flat `documentsBlock` for the model.
 * @throws {AppError} `NO_DOCUMENTS_SELECTED` (400) when the selection is empty.
 * @throws {AppError} `TOO_MANY_DOCUMENTS` (400) when more than {@link CHAT_MAX_DOCUMENTS} are selected.
 * @throws {AppError} `DOCUMENT_NOT_AVAILABLE` (400) when a selected document is missing,
 *   unowned, not READY, or deleted.
 * @throws {AppError} `CONFIRMED_TEXT_LIMIT_EXCEEDED` (400) when combined text exceeds the budget.
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

  // Set preserves first-seen order, so the selection order the user chose survives de-duplication.
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

    // Ownership-scoped read: match on id + owner + eligibility guards together. Collapsing
    // "not owned", "not READY", and "deleted" into the same not-found path prevents the
    // response from revealing a document's existence or state to a non-owner.
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

    // The user-reviewed transcription is the source of truth: prefer correctedText (the
    // user's edit) and fall back to extractedText only when the page was accepted without
    // correction. When a correction exists the raw extraction is never sent to the model.
    const pages: AssembledPage[] = document.pages.map((page, index) => ({
      pageNumber: index + 1,
      pageId: page.id,
      text: page.ocr!.correctedText ?? page.ocr!.extractedText,
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

  // R-004: fail clearly rather than degrade silently. The user is asked to remove a
  // document or start a fresh chat; selected source text is never trimmed to fit a budget.
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
