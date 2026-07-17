// Tests for section-generation orchestration: only ACCEPTED pages are assembled, page order is
// preserved, success persists sections/sources and sets READY, and any failure (bad model
// response, provider error, or no accepted pages) sets PROCESSING_FAILED without throwing
// (docs/08_..._Roadmap.md Phase 5, docs/09_Coding_Risk_Register.md R-003).
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateSectionsForDocument } from "@/lib/sections/generate";
import { prisma } from "@/lib/database/prisma";
import { generateDocumentSections } from "@/lib/sections/client";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    document: {
      update: vi.fn(),
    },
    page: {
      findMany: vi.fn(),
    },
    section: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}));

vi.mock("@/lib/sections/client", () => ({
  generateDocumentSections: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const owner = { kind: "temporary" as const, temporarySessionId: "session-123" };

describe("generateSectionsForDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.document.update).mockResolvedValue({ id: "doc-123", status: "PROCESSING" } as any);
    vi.mocked(prisma.section.deleteMany).mockResolvedValue({ count: 0 } as any);
  });

  it("assembles only ACCEPTED pages in page order and maps source page numbers back to page ids", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValue([
      { id: "page-1", order: 0, status: "ACCEPTED", ocr: { extractedText: "Page one text." } },
      { id: "page-2", order: 1, status: "ACCEPTED", ocr: { extractedText: "Page two text." } },
    ] as any);

    vi.mocked(generateDocumentSections).mockResolvedValue({
      sections: [
        { heading: "Reporting", body: "Report monthly.", sourcePageNumbers: [1] },
        { heading: "Curfew", body: "Stay home after 9pm.", sourcePageNumbers: [2, 1] },
      ],
    });

    vi.mocked(prisma.section.create).mockImplementation(((args: any) =>
      Promise.resolve({ id: `section-${args.data.order}`, ...args.data })) as any);

    await generateSectionsForDocument(owner, "doc-123");

    expect(prisma.page.findMany).toHaveBeenCalledWith({
      where: { documentId: "doc-123", status: "ACCEPTED", ocr: { isNot: null } },
      orderBy: { order: "asc" },
      include: { ocr: true },
    });

    expect(generateDocumentSections).toHaveBeenCalledWith({
      pages: [
        { pageNumber: 1, text: "Page one text." },
        { pageNumber: 2, text: "Page two text." },
      ],
    });

    const firstSectionCall = vi.mocked(prisma.section.create).mock.calls[0][0] as any;
    expect(firstSectionCall.data.sources.create).toEqual([{ pageId: "page-1" }]);

    const secondSectionCall = vi.mocked(prisma.section.create).mock.calls[1][0] as any;
    expect(secondSectionCall.data.sources.create).toEqual([{ pageId: "page-2" }, { pageId: "page-1" }]);
  });

  it("sets PROCESSING then READY on success, and clears any prior sections first", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValue([
      { id: "page-1", order: 0, status: "ACCEPTED", ocr: { extractedText: "Report monthly." } },
    ] as any);
    vi.mocked(generateDocumentSections).mockResolvedValue({
      sections: [{ heading: "Reporting", body: "Report monthly.", sourcePageNumbers: [1] }],
    });
    vi.mocked(prisma.section.create).mockResolvedValue({ id: "section-1" } as any);
    vi.mocked(prisma.document.update)
      .mockResolvedValueOnce({ id: "doc-123", status: "PROCESSING" } as any) // initial transition
      .mockResolvedValueOnce({ id: "doc-123", status: "READY" } as any); // final transition (inside $transaction)

    const result = await generateSectionsForDocument(owner, "doc-123");

    expect(prisma.document.update).toHaveBeenNthCalledWith(1, {
      where: { id: "doc-123", temporarySessionId: "session-123" },
      data: { status: "PROCESSING" },
    });
    expect(prisma.section.deleteMany).toHaveBeenCalledWith({ where: { documentId: "doc-123" } });
    expect(result.status).toBe("READY");
  });

  it("sets PROCESSING_FAILED without throwing when the model call fails", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValue([
      { id: "page-1", order: 0, status: "ACCEPTED", ocr: { extractedText: "Report monthly." } },
    ] as any);
    vi.mocked(generateDocumentSections).mockRejectedValue(new Error("provider error"));
    vi.mocked(prisma.document.update)
      .mockResolvedValueOnce({ id: "doc-123", status: "PROCESSING" } as any)
      .mockResolvedValueOnce({ id: "doc-123", status: "PROCESSING_FAILED" } as any);

    const result = await generateSectionsForDocument(owner, "doc-123");

    expect(result.status).toBe("PROCESSING_FAILED");
    expect(prisma.document.update).toHaveBeenLastCalledWith({
      where: { id: "doc-123", temporarySessionId: "session-123" },
      data: { status: "PROCESSING_FAILED" },
    });
  });

  it("uses correctedText over extractedText for a corrected accepted page, and never sends the raw text", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValue([
      {
        id: "page-1",
        order: 0,
        status: "ACCEPTED",
        ocr: { extractedText: "Raw OCR mistke text.", correctedText: "Corrected, accurate text." },
      },
    ] as any);
    vi.mocked(generateDocumentSections).mockResolvedValue({
      sections: [{ heading: "Reporting", body: "Report monthly.", sourcePageNumbers: [1] }],
    });
    vi.mocked(prisma.section.create).mockResolvedValue({ id: "section-1" } as any);

    await generateSectionsForDocument(owner, "doc-123");

    expect(generateDocumentSections).toHaveBeenCalledWith({
      pages: [{ pageNumber: 1, text: "Corrected, accurate text." }],
    });
    const sentPayload = JSON.stringify(vi.mocked(generateDocumentSections).mock.calls[0][0]);
    expect(sentPayload).not.toContain("Raw OCR mistke text.");
  });

  it("falls back to extractedText for a legacy accepted page with correctedText = null", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValue([
      {
        id: "page-1",
        order: 0,
        status: "ACCEPTED",
        ocr: { extractedText: "Legacy accepted text.", correctedText: null },
      },
    ] as any);
    vi.mocked(generateDocumentSections).mockResolvedValue({
      sections: [{ heading: "Reporting", body: "Report monthly.", sourcePageNumbers: [1] }],
    });
    vi.mocked(prisma.section.create).mockResolvedValue({ id: "section-1" } as any);

    await generateSectionsForDocument(owner, "doc-123");

    expect(generateDocumentSections).toHaveBeenCalledWith({
      pages: [{ pageNumber: 1, text: "Legacy accepted text." }],
    });
  });

  it("sets PROCESSING_FAILED without throwing when there are no accepted pages", async () => {
    vi.mocked(prisma.page.findMany).mockResolvedValue([]);
    vi.mocked(prisma.document.update)
      .mockResolvedValueOnce({ id: "doc-123", status: "PROCESSING" } as any)
      .mockResolvedValueOnce({ id: "doc-123", status: "PROCESSING_FAILED" } as any);

    const result = await generateSectionsForDocument(owner, "doc-123");

    expect(result.status).toBe("PROCESSING_FAILED");
    expect(generateDocumentSections).not.toHaveBeenCalled();
  });
});
