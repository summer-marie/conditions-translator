// Unit tests for the OpenAI chat client: the model always comes from OPENAI_CHAT_MODEL (never
// hardcoded), the system prompt and selected-document text are passed as system context, and any
// provider error is sanitized before it can reach a caller or log
// (docs/06_AI_Safety_and_Persona.md, docs/11_Model_Routing_and_Fallback.md,
// docs/09_Coding_Risk_Register.md).

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { generateChatAnswer } from "@/lib/chat/client";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat/prompt";

const parseMock = vi.fn();

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = { parse: parseMock };
  },
}));

vi.mock("openai/helpers/zod", () => ({
  zodTextFormat: vi.fn((schema: unknown, name: string) => ({ schema, name })),
}));

const validAnswer = {
  output_parsed: {
    answer: "You must report monthly.",
    foundRelevantSource: true,
    conflictDetected: false,
    sources: [{ documentNumber: 1, pageNumbers: [1] }],
  },
};

describe("generateChatAnswer", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_CHAT_MODEL: "gpt-chat-test" };
  });

  it("throws a configuration error when OPENAI_CHAT_MODEL is not set (never hardcodes a model)", async () => {
    delete process.env.OPENAI_CHAT_MODEL;

    await expect(
      generateChatAnswer({ documentsBlock: "doc text", history: [], latestUserMessage: "hi" })
    ).rejects.toMatchObject({ code: "CHAT_MODEL_NOT_CONFIGURED" });

    expect(parseMock).not.toHaveBeenCalled();
  });

  it("reads the model from OPENAI_CHAT_MODEL and sends the safety prompt + documents as system context", async () => {
    parseMock.mockResolvedValue(validAnswer);

    await generateChatAnswer({
      documentsBlock: "=== Document 1 ===\nReport monthly.",
      history: [{ role: "user", content: "earlier question" }],
      latestUserMessage: "Do I report monthly?",
    });

    expect(parseMock).toHaveBeenCalledTimes(1);
    const callArg = parseMock.mock.calls[0][0];
    expect(callArg.model).toBe("gpt-chat-test");

    const systemMessages = callArg.input.filter((m: { role: string }) => m.role === "system");
    expect(systemMessages[0].content).toBe(CHAT_SYSTEM_PROMPT);
    expect(systemMessages[1].content).toContain("Report monthly.");

    // History and the latest user message are included, latest last.
    const lastMessage = callArg.input[callArg.input.length - 1];
    expect(lastMessage).toEqual({ role: "user", content: "Do I report monthly?" });
  });

  it("returns the parsed structured answer on success", async () => {
    parseMock.mockResolvedValue(validAnswer);

    const result = await generateChatAnswer({
      documentsBlock: "doc",
      history: [],
      latestUserMessage: "q",
    });

    expect(result.answer).toBe("You must report monthly.");
    expect(result.foundRelevantSource).toBe(true);
    expect(result.sources).toEqual([{ documentNumber: 1, pageNumbers: [1] }]);
  });

  it("sanitizes a provider error into a generic AppError, never surfacing the original message", async () => {
    const sensitive = "leaked request body: SSN 000-00-0000";
    parseMock.mockRejectedValue(new Error(sensitive));

    let caught: unknown;
    try {
      await generateChatAnswer({ documentsBlock: "doc", history: [], latestUserMessage: "q" });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppError);
    expect((caught as AppError).code).toBe("CHAT_REQUEST_FAILED");
    expect((caught as AppError).message).not.toContain(sensitive);
  });

  it("throws when the model returns no structured output", async () => {
    parseMock.mockResolvedValue({ output_parsed: null });

    await expect(
      generateChatAnswer({ documentsBlock: "doc", history: [], latestUserMessage: "q" })
    ).rejects.toMatchObject({ code: "CHAT_INVALID_RESPONSE" });
  });
});
