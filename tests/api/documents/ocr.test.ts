// Tests for the OCR route: ownership scoping, success/failure state transitions, and the
// safety requirements that raw extracted text and the OpenAI API key never leak
// (docs/03_OCR_Specifications.md, Phase 4 core invariants).
//
// `any` casts on mock Prisma/response objects below are deliberate: constructing the exact
// generated Prisma types for every partial fixture would add noise without catching real bugs.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/documents/[documentId]/pages/[pageId]/ocr/route";
import { prisma } from "@/lib/database/prisma";
import { readPageImage } from "@/lib/storage/blob";
import { runPageOcr } from "@/lib/ocr/client";
import { getCurrentOwner } from "@/lib/auth/session";

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    document: { findFirst: vi.fn() },
    page: { findFirst: vi.fn(), update: vi.fn() },
    ocrResult: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/storage/blob", () => ({
  readPageImage: vi.fn(),
}));

vi.mock("@/lib/ocr/client", () => ({
  runPageOcr: vi.fn(),
}));

// Mock owner resolution for the owner-aware route.
vi.mock("@/lib/auth/session", () => ({
  getCurrentOwner: vi.fn(),
}));

const mockDocument = {
  id: "doc-123",
  title: "Test Document",
  status: "IN_PROGRESS",
  userId: null,
  temporarySessionId: "session-123",
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletionState: "ACTIVE",
};

const mockPage = {
  id: "page-123",
  documentId: "doc-123",
  order: 0,
  status: "PENDING",
  ocrFailureReason: null,
  blobPath: "conditions-translator/documents/doc-123/pages/page-123.jpeg",
  createdAt: new Date(),
  updatedAt: new Date(),
};

async function authenticate() {
  vi.mocked(getCurrentOwner).mockResolvedValue({
    kind: "temporary",
    temporarySessionId: "session-123",
  });
}

describe("POST /api/documents/[documentId]/pages/[pageId]/ocr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 (never 403, to avoid revealing existence) when the document is not owned by the caller", async () => {
    await authenticate();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(null);

    const request = new Request("http://localhost/api/documents/doc-123/pages/page-123/ocr", {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ documentId: "doc-123", pageId: "page-123" }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.code).toBe("DOCUMENT_NOT_FOUND");
  });

  it("returns 401 when there is no active session or signed-in user", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue(null);

    const request = new Request("http://localhost/api/documents/doc-123/pages/page-123/ocr", {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ documentId: "doc-123", pageId: "page-123" }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.code).toBe("NO_ACTIVE_SESSION");
  });

  it("runs OCR on an IN_PROGRESS document owned by a signed-in user (resumed after ownership transfer)", async () => {
    vi.mocked(getCurrentOwner).mockResolvedValue({ kind: "user", userId: "user-123" });
    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      ...mockDocument,
      userId: "user-123",
      temporarySessionId: null,
    } as any);
    vi.mocked(prisma.page.findFirst).mockResolvedValue(mockPage as any);
    vi.mocked(readPageImage).mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    });
    vi.mocked(runPageOcr).mockResolvedValue({
      extractedText: "You must report to your officer monthly.",
      confidence: 0.94,
      quality: {
        blurry: false,
        cutOff: false,
        sideways: false,
        incomplete: false,
        unreadable: false,
      },
      retakeGuidance: null,
    });
    vi.mocked(prisma.ocrResult.upsert).mockResolvedValue({
      id: "ocr-1",
      pageId: "page-123",
      extractedText: "You must report to your officer monthly.",
      confidence: 0.94,
      warnings: {},
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.page.update).mockResolvedValue({ ...mockPage, status: "OCR_COMPLETE" } as any);

    const request = new Request("http://localhost/api/documents/doc-123/pages/page-123/ocr", {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ documentId: "doc-123", pageId: "page-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.page.status).toBe("OCR_COMPLETE");
    expect(prisma.document.findFirst).toHaveBeenCalledWith({
      where: {
        id: "doc-123",
        userId: "user-123",
        deletionState: "ACTIVE",
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
    });
  });

  it("stores an OcrResult and sets OCR_COMPLETE on success", async () => {
    await authenticate();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.findFirst).mockResolvedValue(mockPage as any);
    vi.mocked(readPageImage).mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    });
    vi.mocked(runPageOcr).mockResolvedValue({
      extractedText: "You must report to your officer monthly.",
      confidence: 0.94,
      quality: {
        blurry: false,
        cutOff: false,
        sideways: false,
        incomplete: false,
        unreadable: false,
      },
      retakeGuidance: null,
    });

    const mockOcrResult = {
      id: "ocr-1",
      pageId: "page-123",
      extractedText: "You must report to your officer monthly.",
      confidence: 0.94,
      warnings: {
        blurry: false,
        cutOff: false,
        sideways: false,
        incomplete: false,
        unreadable: false,
        retakeGuidance: null,
      },
      createdAt: new Date(),
    };
    vi.mocked(prisma.ocrResult.upsert).mockResolvedValue(mockOcrResult as any);
    vi.mocked(prisma.page.update).mockResolvedValue({ ...mockPage, status: "OCR_COMPLETE" } as any);

    const request = new Request("http://localhost/api/documents/doc-123/pages/page-123/ocr", {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ documentId: "doc-123", pageId: "page-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.page.status).toBe("OCR_COMPLETE");
    expect(data.ocr.extractedText).toBe("You must report to your officer monthly.");
    expect(prisma.ocrResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pageId: "page-123" },
        create: expect.objectContaining({ pageId: "page-123", extractedText: expect.any(String) }),
      })
    );
    expect(prisma.page.update).toHaveBeenCalledWith({
      where: { id: "page-123" },
      data: { status: "OCR_COMPLETE", ocrFailureReason: null },
    });
  });

  it("sets OCR_FAILED and records a retake reason when the model reports the page unreadable", async () => {
    await authenticate();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.findFirst).mockResolvedValue(mockPage as any);
    vi.mocked(readPageImage).mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    });
    vi.mocked(runPageOcr).mockResolvedValue({
      extractedText: "",
      confidence: 0,
      quality: {
        blurry: true,
        cutOff: false,
        sideways: false,
        incomplete: false,
        unreadable: true,
      },
      retakeGuidance: "Retake the photo in better lighting.",
    });
    vi.mocked(prisma.ocrResult.deleteMany).mockResolvedValue({ count: 0 } as any);
    vi.mocked(prisma.page.update).mockResolvedValue({
      ...mockPage,
      status: "OCR_FAILED",
      ocrFailureReason: "Retake the photo in better lighting.",
    } as any);

    const request = new Request("http://localhost/api/documents/doc-123/pages/page-123/ocr", {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ documentId: "doc-123", pageId: "page-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.page.status).toBe("OCR_FAILED");
    expect(data.ocr).toBeNull();
    expect(prisma.ocrResult.deleteMany).toHaveBeenCalledWith({ where: { pageId: "page-123" } });
    expect(prisma.page.update).toHaveBeenCalledWith({
      where: { id: "page-123" },
      data: { status: "OCR_FAILED", ocrFailureReason: "Retake the photo in better lighting." },
    });
  });

  it("never logs raw extracted text, even on failure", async () => {
    await authenticate();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.findFirst).mockResolvedValue(mockPage as any);
    vi.mocked(readPageImage).mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    });

    // Simulates an unsanitized error surfacing from a dependency (bypassing runPageOcr's own
    // try/catch, which normally converts provider errors into a generic AppError). Even in
    // this worst case, the route's outer catch-all must never echo the raw error content.
    const secretSourceText = "SSN: 000-00-0000 confidential supervision text";
    vi.mocked(runPageOcr).mockRejectedValue(new Error(secretSourceText));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = new Request("http://localhost/api/documents/doc-123/pages/page-123/ocr", {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ documentId: "doc-123", pageId: "page-123" }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(data)).not.toContain(secretSourceText);

    const loggedOutput = consoleSpy.mock.calls.flat().map(String).join(" ");
    expect(loggedOutput).not.toContain(secretSourceText);

    consoleSpy.mockRestore();
  });

  it("never exposes the OpenAI API key in the response body", async () => {
    process.env.OPENAI_API_KEY = "sk-test-should-never-leak";

    await authenticate();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.findFirst).mockResolvedValue(mockPage as any);
    vi.mocked(readPageImage).mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    });
    vi.mocked(runPageOcr).mockResolvedValue({
      extractedText: "Report weekly.",
      confidence: 0.9,
      quality: {
        blurry: false,
        cutOff: false,
        sideways: false,
        incomplete: false,
        unreadable: false,
      },
      retakeGuidance: null,
    });
    vi.mocked(prisma.ocrResult.upsert).mockResolvedValue({
      id: "ocr-1",
      pageId: "page-123",
      extractedText: "Report weekly.",
      confidence: 0.9,
      warnings: {},
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.page.update).mockResolvedValue({ ...mockPage, status: "OCR_COMPLETE" } as any);

    const request = new Request("http://localhost/api/documents/doc-123/pages/page-123/ocr", {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ documentId: "doc-123", pageId: "page-123" }) });
    const data = await response.json();

    expect(JSON.stringify(data)).not.toContain("sk-test-should-never-leak");
  });

  it("clears any prior correctedText when OCR is re-run on a page with an existing OcrResult", async () => {
    // Simulates a user having corrected this page's transcription, then re-running OCR (e.g. via
    // a fresh upload cycle) while the OcrResult row still exists for this pageId: the stale
    // correction — reviewed against the OLD extractedText — must not silently carry over onto
    // the new raw extraction.
    await authenticate();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.findFirst).mockResolvedValue({ ...mockPage, status: "OCR_COMPLETE" } as any);
    vi.mocked(readPageImage).mockResolvedValue({
      buffer: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    });
    vi.mocked(runPageOcr).mockResolvedValue({
      extractedText: "Fresh extraction after re-run.",
      confidence: 0.9,
      quality: {
        blurry: false,
        cutOff: false,
        sideways: false,
        incomplete: false,
        unreadable: false,
      },
      retakeGuidance: null,
    });
    vi.mocked(prisma.ocrResult.upsert).mockResolvedValue({
      id: "ocr-1",
      pageId: "page-123",
      extractedText: "Fresh extraction after re-run.",
      correctedText: null,
      confidence: 0.9,
      warnings: {},
      createdAt: new Date(),
    } as any);
    vi.mocked(prisma.page.update).mockResolvedValue({ ...mockPage, status: "OCR_COMPLETE" } as any);

    const request = new Request("http://localhost/api/documents/doc-123/pages/page-123/ocr", {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ documentId: "doc-123", pageId: "page-123" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ocr.correctedText).toBeNull();
    expect(prisma.ocrResult.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pageId: "page-123" },
        create: expect.objectContaining({ correctedText: null }),
        update: expect.objectContaining({ correctedText: null }),
      })
    );
  });

  it("blocks re-running OCR on an already-accepted page", async () => {
    await authenticate();
    vi.mocked(prisma.document.findFirst).mockResolvedValue(mockDocument as any);
    vi.mocked(prisma.page.findFirst).mockResolvedValue({ ...mockPage, status: "ACCEPTED" } as any);

    const request = new Request("http://localhost/api/documents/doc-123/pages/page-123/ocr", {
      method: "POST",
    });

    const response = await POST(request, { params: Promise.resolve({ documentId: "doc-123", pageId: "page-123" }) });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.code).toBe("PAGE_ALREADY_ACCEPTED");
    expect(runPageOcr).not.toHaveBeenCalled();
  });
});
