// Unit tests for the OpenAI Vision OCR client: model comes from env only, and any
// underlying provider error is sanitized before it ever reaches a caller/log
// (docs/03_OCR_Specifications.md core invariants).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { runPageOcr } from "@/lib/ocr/client";

const parseMock = vi.fn();

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = { parse: parseMock };
  },
}));

vi.mock("openai/helpers/zod", () => ({
  zodTextFormat: vi.fn((schema: unknown, name: string) => ({ schema, name })),
}));

describe("runPageOcr", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_OCR_MODEL: "gpt-vision-test" };
  });

  it("throws a configuration error when OPENAI_OCR_MODEL is not set", async () => {
    delete process.env.OPENAI_OCR_MODEL;

    await expect(
      runPageOcr({ imageBuffer: Buffer.from([0xff, 0xd8, 0xff]), contentType: "image/jpeg" })
    ).rejects.toMatchObject({ code: "OCR_MODEL_NOT_CONFIGURED" });
  });

  it("returns the parsed structured result on success", async () => {
    parseMock.mockResolvedValue({
      output_parsed: {
        extractedText: "Report monthly.",
        confidence: 0.9,
        quality: {
          blurry: false,
          cutOff: false,
          sideways: false,
          incomplete: false,
          unreadable: false,
        },
        retakeGuidance: null,
      },
    });

    const result = await runPageOcr({
      imageBuffer: Buffer.from([0xff, 0xd8, 0xff]),
      contentType: "image/jpeg",
    });

    expect(result.extractedText).toBe("Report monthly.");
    expect(parseMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-vision-test" })
    );
  });

  it("sanitizes a provider error into a generic AppError, never surfacing the original message", async () => {
    const sensitiveMessage = "leaked request body: SSN 000-00-0000";
    parseMock.mockRejectedValue(new Error(sensitiveMessage));

    let caught: unknown;
    try {
      await runPageOcr({ imageBuffer: Buffer.from([0xff, 0xd8, 0xff]), contentType: "image/jpeg" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe("OCR_REQUEST_FAILED");
    expect((caught as AppError).message).not.toContain(sensitiveMessage);
  });

  it("throws when the model returns no structured output", async () => {
    parseMock.mockResolvedValue({ output_parsed: null });

    await expect(
      runPageOcr({ imageBuffer: Buffer.from([0xff, 0xd8, 0xff]), contentType: "image/jpeg" })
    ).rejects.toMatchObject({ code: "OCR_INVALID_RESPONSE" });
  });
});
