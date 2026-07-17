// Tests for chat context assembly (docs/06_AI_Safety_and_Persona.md §5,
// docs/07_Launch_Readiness_Checklist.md §6, docs/09_Coding_Risk_Register.md R-002/R-004).
//
// Verifies: ownership + READY scoping is in the query (never by id alone), only ACCEPTED page
// text is requested, the numbered block is built in order, the 3-document max is enforced, and
// the confirmed-text limit fails clearly WITHOUT truncating source text.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { assembleChatContext } from "@/lib/chat/context";
import { prisma } from "@/lib/database/prisma";
import {
  CHAT_MAX_CONFIRMED_CHARACTERS,
  CHAT_MAX_DOCUMENTS,
} from "@/lib/constants";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    document: {
      findFirst: vi.fn(),
    },
  },
}));

const owner = { kind: "temporary" as const, temporarySessionId: "session-123" };

function readyDoc(
  id: string,
  title: string,
  pages: { id: string; text: string; correctedText?: string | null }[]
) {
  return {
    id,
    title,
    pages: pages.map((p) => ({
      id: p.id,
      ocr: { extractedText: p.text, correctedText: p.correctedText ?? null },
    })),
  };
}

describe("assembleChatContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an empty selection", async () => {
    await expect(assembleChatContext(owner, [])).rejects.toMatchObject({
      code: "NO_DOCUMENTS_SELECTED",
    });
  });

  it("rejects selecting more than the allowed number of documents", async () => {
    const tooMany = Array.from({ length: CHAT_MAX_DOCUMENTS + 1 }, (_, i) => `doc-${i}`);

    await expect(assembleChatContext(owner, tooMany)).rejects.toMatchObject({
      code: "TOO_MANY_DOCUMENTS",
    });
    expect(prisma.document.findFirst).not.toHaveBeenCalled();
  });

  it("scopes the query to owner + READY + ACTIVE and requests only ACCEPTED page text", async () => {
    vi.mocked(prisma.document.findFirst).mockResolvedValue(
      readyDoc("doc-1", "Conditions", [{ id: "page-1", text: "Report monthly." }]) as any
    );

    await assembleChatContext(owner, ["doc-1"]);

    const call = vi.mocked(prisma.document.findFirst).mock.calls[0][0] as any;
    expect(call.where).toMatchObject({
      id: "doc-1",
      temporarySessionId: "session-123", // ownership is in the WHERE (never id alone)
      status: "READY",
      deletionState: "ACTIVE",
    });
    expect(call.include.pages.where).toMatchObject({ status: "ACCEPTED", ocr: { isNot: null } });
    expect(call.include.pages.orderBy).toEqual({ order: "asc" });
  });

  it("builds a numbered block with the full accepted text of a single READY document", async () => {
    vi.mocked(prisma.document.findFirst).mockResolvedValue(
      readyDoc("doc-1", "Conditions", [
        { id: "page-1", text: "Report monthly." },
        { id: "page-2", text: "Curfew at 9pm." },
      ]) as any
    );

    const context = await assembleChatContext(owner, ["doc-1"]);

    expect(context.documents).toHaveLength(1);
    expect(context.documents[0].pages).toEqual([
      { pageNumber: 1, pageId: "page-1", text: "Report monthly." },
      { pageNumber: 2, pageId: "page-2", text: "Curfew at 9pm." },
    ]);
    expect(context.documentsBlock).toContain('=== Document 1: "Conditions" ===');
    expect(context.documentsBlock).toContain("--- Document 1, Page 1 ---\nReport monthly.");
    expect(context.documentsBlock).toContain("--- Document 1, Page 2 ---\nCurfew at 9pm.");
    expect(context.totalCharacters).toBe("Report monthly.".length + "Curfew at 9pm.".length);
  });

  it("numbers multiple documents in selection order", async () => {
    vi.mocked(prisma.document.findFirst)
      .mockResolvedValueOnce(readyDoc("doc-a", "First", [{ id: "pa", text: "AAA" }]) as any)
      .mockResolvedValueOnce(readyDoc("doc-b", "Second", [{ id: "pb", text: "BBB" }]) as any);

    const context = await assembleChatContext(owner, ["doc-a", "doc-b"]);

    expect(context.documents[0]).toMatchObject({ documentNumber: 1, documentId: "doc-a" });
    expect(context.documents[1]).toMatchObject({ documentNumber: 2, documentId: "doc-b" });
  });

  it("uses correctedText over extractedText when a correction exists, and the raw text never appears in the assembled context", async () => {
    const rawText = "Raw OCR mistke text with an error.";
    const correctedText = "Corrected, accurate text.";
    vi.mocked(prisma.document.findFirst).mockResolvedValue(
      readyDoc("doc-1", "Conditions", [{ id: "page-1", text: rawText, correctedText }]) as any
    );

    const context = await assembleChatContext(owner, ["doc-1"]);

    expect(context.documents[0].pages).toEqual([
      { pageNumber: 1, pageId: "page-1", text: correctedText },
    ]);
    expect(context.documentsBlock).toContain(correctedText);
    expect(context.documentsBlock).not.toContain(rawText);
  });

  it("falls back to extractedText for a legacy accepted page with correctedText = null", async () => {
    vi.mocked(prisma.document.findFirst).mockResolvedValue(
      readyDoc("doc-1", "Conditions", [
        { id: "page-1", text: "Legacy accepted text.", correctedText: null },
      ]) as any
    );

    const context = await assembleChatContext(owner, ["doc-1"]);

    expect(context.documents[0].pages).toEqual([
      { pageNumber: 1, pageId: "page-1", text: "Legacy accepted text." },
    ]);
  });

  it("rejects a document that is not owned / not READY (findFirst returns null)", async () => {
    // A non-owner, non-READY, or deleted document all fall through the scoped WHERE and return
    // null — indistinguishable, so the caller learns nothing about another owner's documents.
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    await expect(assembleChatContext(owner, ["doc-x"])).rejects.toMatchObject({
      code: "DOCUMENT_NOT_AVAILABLE",
    });
  });

  it("fails clearly when combined confirmed text exceeds the limit, and does NOT truncate", async () => {
    const oversized = "x".repeat(CHAT_MAX_CONFIRMED_CHARACTERS + 1);
    vi.mocked(prisma.document.findFirst).mockResolvedValue(
      readyDoc("doc-1", "Big", [{ id: "page-1", text: oversized }]) as any
    );

    let caught: any;
    try {
      await assembleChatContext(owner, ["doc-1"]);
    } catch (error) {
      caught = error;
    }

    expect(caught.code).toBe("CONFIRMED_TEXT_LIMIT_EXCEEDED");
    // The oversized text is never returned in a partial/trimmed form — the call throws instead.
    expect(caught.message).not.toContain(oversized);
  });
});
