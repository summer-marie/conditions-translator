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

vi.mock("@/lib/database/prisma", () => ({
  prisma: {
    temporarySession: { findUnique: vi.fn() },
    document: { findFirst: vi.fn() },
    page: { findFirst: vi.fn(), update: vi.fn() },
    ocrResult: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/storage/blob", () => ({
  readPageImage: vi.fn(),
}));

vi.mock("@/lib/ocr/client", () => ({
  runPageOcr: vi.fn(),
}));

const mockSession = {
  id: "session-123",
  token: "token-abc",
  noticeAcceptedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
};

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
  const { cookies } = await import("next/headers");
  vi.mocked(cookies).mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "token-abc" }),
  } as any);
  vi.mocked(prisma.temporarySession.findUnique).mockResolvedValue(mockSession as any);
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
