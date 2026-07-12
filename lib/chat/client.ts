// Server-side OpenAI chat call that answers a question grounded in the selected documents'
// accepted text (docs/06_AI_Safety_and_Persona.md).
//
// Model is always read from OPENAI_CHAT_MODEL — never hardcoded (docs/11_Model_Routing_and_
// Fallback.md). Runs only on the server; the API key never reaches the browser. Any provider
// error is sanitized before it leaves this module so request/response content can never leak.

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AppError } from "@/lib/errors";
import { ChatAnswerSchema, type ChatAnswer } from "@/lib/chat/schema";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat/prompt";

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

let cachedClient: OpenAI | null = null;

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
 * Generates a grounded chat answer.
 *
 * @param documentsBlock  Pre-assembled, numbered document/page source text (the full ACCEPTED
 *                        text of the selected READY documents). Never truncated by the caller.
 * @param history         Prior turns of THIS temporary chat, oldest first, for conversational
 *                        context only.
 * @param latestUserMessage  The new question to answer.
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

  // The selected documents are provided as a system message so the model treats them as
  // grounding context, and their content is never confused with the user's own instructions.
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
    // Never log the underlying error verbatim — it may echo back request content.
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
