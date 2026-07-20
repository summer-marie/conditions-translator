/**
 * Server-side OpenAI chat call that answers a question grounded in the selected
 * documents' accepted text (`docs/06_AI_Safety_and_Persona.md`).
 *
 * The model is always read from `OPENAI_CHAT_MODEL` and never hardcoded
 * (`docs/11_Model_Routing_and_Fallback.md`). This module runs only on the server, so the
 * API key never reaches the browser, and every provider error is sanitized before it
 * leaves the module — request/response content can never leak into logs or client errors.
 *
 * @module lib/chat/client
 */

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AppError } from "@/lib/errors";
import { ChatAnswerSchema, type ChatAnswer } from "@/lib/chat/schema";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat/prompt";

/** A single prior turn of the current temporary chat, used only for conversational context. */
export interface ChatHistoryMessage {
  /** Who produced the turn. */
  role: "user" | "assistant";
  /** The turn's text. */
  content: string;
}

/** Lazily-created singleton client; reused across requests within a warm server instance. */
let cachedClient: OpenAI | null = null;

/**
 * Returns the shared OpenAI client, constructing it on first use.
 *
 * Timeout and retry counts come from `OPENAI_REQUEST_TIMEOUT_MS` / `OPENAI_MAX_RETRIES`,
 * defaulting to 60s and 2 retries.
 *
 * @returns The memoized {@link OpenAI} client.
 */
function getClient(): OpenAI {
  if (!cachedClient) {
    cachedClient = new OpenAI({
      timeout: Number(process.env.OPENAI_REQUEST_TIMEOUT_MS) || 60000,
      maxRetries: Number(process.env.OPENAI_MAX_RETRIES) || 2,
    });
  }
  return cachedClient;
}

/**
 * Generates a grounded chat answer from the selected documents' accepted text.
 *
 * The document block is passed as a dedicated system message so the model treats it as
 * grounding context and never confuses it with the user's own instructions (prompt-
 * injection resistance). Provider failures and schema mismatches are converted into
 * sanitized {@link AppError}s so no request content escapes.
 *
 * @param params - Call inputs.
 * @param params.documentsBlock - Pre-assembled, numbered document/page source text (the
 *   full ACCEPTED text of the selected READY documents). Never truncated by the caller.
 * @param params.history - Prior turns of *this* temporary chat, oldest first, for
 *   conversational context only.
 * @param params.latestUserMessage - The new question to answer.
 * @returns The parsed, schema-validated {@link ChatAnswer}.
 * @throws {AppError} `CHAT_MODEL_NOT_CONFIGURED` (500) when `OPENAI_CHAT_MODEL` is unset.
 * @throws {AppError} `CHAT_REQUEST_FAILED` (502) when the provider call fails.
 * @throws {AppError} `CHAT_INVALID_RESPONSE` (502) when the response does not match the schema.
 */
export async function generateChatAnswer(params: {
  documentsBlock: string;
  history: ChatHistoryMessage[];
  latestUserMessage: string;
}): Promise<ChatAnswer> {
  const model = process.env.OPENAI_CHAT_MODEL;
  if (!model) {
    throw new AppError("Chat model is not configured.", 500, "CHAT_MODEL_NOT_CONFIGURED");
  }

  // Documents go in a system message (not the user turn) so the model treats them as
  // authoritative grounding rather than as user-supplied instructions.
  const input = [
    { role: "system" as const, content: CHAT_SYSTEM_PROMPT },
    {
      role: "system" as const,
      content: `Selected documents (the only source of truth):\n\n${params.documentsBlock}`,
    },
    ...params.history.map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: "user" as const, content: params.latestUserMessage },
  ];

  let response;
  try {
    response = await getClient().responses.parse({
      model,
      input,
      text: { format: zodTextFormat(ChatAnswerSchema, "chat_answer") },
    });
  } catch {
    // Swallow the provider error deliberately: it can echo back request content, so it
    // must never be logged or surfaced. Only the sanitized AppError leaves this module.
    throw new AppError("The chat request failed.", 502, "CHAT_REQUEST_FAILED");
  }

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new AppError(
      "The chat response did not match the expected format.",
      502,
      "CHAT_INVALID_RESPONSE"
    );
  }

  return parsed;
}
