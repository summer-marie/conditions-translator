// Unit tests for the OpenAI section-generation client: model comes from env only, and any
// underlying provider error is sanitized before it ever reaches a caller/log
// (docs/11_Model_Routing_and_Fallback.md, docs/09_Coding_Risk_Register.md).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { generateDocumentSections } from "@/lib/sections/client";

const parseMock = vi.fn();

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = { parse: parseMock };
  },
}));

vi.mock("openai/helpers/zod", () => ({
  zodTextFormat: vi.fn((schema: unknown, name: string) => ({ schema, name })),
}));

describe("generateDocumentSections", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_SECTION_MODEL: "gpt-section-test" };
  });

  it("throws a configuration error when OPENAI_SECTION_MODEL is not set", async () => {
    delete process.env.OPENAI_SECTION_MODEL;

    await expect(
      generateDocumentSections({ pages: [{ pageNumber: 1, text: "Report monthly." }] })
    ).rejects.toMatchObject({ code: "SECTION_MODEL_NOT_CONFIGURED" });
  });

  it("returns the parsed structured result on success", async () => {
    parseMock.mockResolvedValue({
      output_parsed: {
        sections: [
          { heading: "Reporting", body: "Report to your officer monthly.", sourcePageNumbers: [1] },
        ],
      },
    });

    const result = await generateDocumentSections({
      pages: [{ pageNumber: 1, text: "Report monthly." }],
    });

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].heading).toBe("Reporting");
    expect(parseMock).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-section-test" })
    );
  });

  it("sanitizes a provider error into a generic AppError, never surfacing the original message", async () => {
    const sensitiveMessage = "leaked request body: SSN 000-00-0000";
    parseMock.mockRejectedValue(new Error(sensitiveMessage));

    let caught: unknown;
    try {
      await generateDocumentSections({ pages: [{ pageNumber: 1, text: "Report monthly." }] });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe("SECTION_GENERATION_REQUEST_FAILED");
    expect((caught as AppError).message).not.toContain(sensitiveMessage);
  });

  it("throws when the model returns no structured output", async () => {
    parseMock.mockResolvedValue({ output_parsed: null });

    await expect(
      generateDocumentSections({ pages: [{ pageNumber: 1, text: "Report monthly." }] })
    ).rejects.toMatchObject({ code: "SECTION_GENERATION_INVALID_RESPONSE" });
  });

  it("throws when the model returns zero sections", async () => {
    parseMock.mockResolvedValue({ output_parsed: { sections: [] } });

    await expect(
      generateDocumentSections({ pages: [{ pageNumber: 1, text: "Report monthly." }] })
    ).rejects.toMatchObject({ code: "SECTION_GENERATION_INVALID_RESPONSE" });
  });
});
