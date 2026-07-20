/**
 * Server-side OpenAI call that turns accepted page text into plain-language sections
 * (`docs/03_OCR_Specifications.md` §6, `docs/04_Schema_Architecture.md`).
 *
 * The model is always read from `OPENAI_SECTION_MODEL` and never hardcoded
 * (`docs/11_Model_Routing_and_Fallback.md`). This module runs only on the server, so the
 * API key never reaches the browser, and provider errors are sanitized before leaving it.
 *
 * @module lib/sections/client
 */

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AppError } from "@/lib/errors";
import { SectionGenerationResultSchema, type SectionGenerationResult } from "@/lib/sections/schema";

/**
 * Instruction prompt for the sectioning model: reorganize confirmed source text into
 * short, plain-language, page-cited sections without adding, interpreting, or advising.
 */
const SYSTEM_PROMPT = `You reorganize the accepted, user-confirmed text of a legal supervision \
document (probation or parole conditions) into short, plain-language sections that help a reader \
navigate the document. You are given the document split into numbered pages, in order.

Rules:
- Use only the text you are given. Never add requirements, permissions, or explanations that are \
not present in the source text.
- Do not give legal advice and do not state whether anything is or is not a violation.
- Each section must have a short heading and a plain-language body that restates the relevant \
source content, not a legal interpretation of it.
- Every section must list the page numbers (from the numbering given to you) that it is based on.
- Prefer several focused sections over one long section. Cover the whole document; do not omit \
pages that contain requirements.`;

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
 * Generates plain-language sections from a document's ordered accepted page text.
 *
 * Pages are concatenated with `--- Page N ---` markers so the model can cite page numbers.
 * The response is parsed against {@link SectionGenerationResultSchema}; an empty section
 * list is treated as an invalid response. Provider failures are sanitized into an
 * {@link AppError}.
 *
 * @param params - Call inputs.
 * @param params.pages - Ordered accepted pages, each with its 1-based `pageNumber` and `text`.
 * @returns The parsed {@link SectionGenerationResult}.
 * @throws {AppError} `SECTION_MODEL_NOT_CONFIGURED` (500) when `OPENAI_SECTION_MODEL` is unset.
 * @throws {AppError} `SECTION_GENERATION_REQUEST_FAILED` (502) when the provider call fails.
 * @throws {AppError} `SECTION_GENERATION_INVALID_RESPONSE` (502) when the response is empty or malformed.
 */
export async function generateDocumentSections(params: {
  pages: { pageNumber: number; text: string }[];
}): Promise<SectionGenerationResult> {
  const model = process.env.OPENAI_SECTION_MODEL;
  if (!model) {
    throw new AppError(
      "Section generation model is not configured.",
      500,
      "SECTION_MODEL_NOT_CONFIGURED"
    );
  }

  const documentText = params.pages
    .map((page) => `--- Page ${page.pageNumber} ---\n${page.text}`)
    .join("\n\n");

  let response;
  try {
    response = await getClient().responses.parse({
      model,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Reorganize this document into plain-language sections:\n\n${documentText}`,
        },
      ],
      text: { format: zodTextFormat(SectionGenerationResultSchema, "document_sections") },
    });
  } catch {
    // Swallow the provider error deliberately: it can echo back document/source text and
    // must never be logged. Only the sanitized AppError leaves this module.
    throw new AppError(
      "The section generation request failed.",
      502,
      "SECTION_GENERATION_REQUEST_FAILED"
    );
  }

  const parsed = response.output_parsed;
  if (!parsed || parsed.sections.length === 0) {
    throw new AppError(
      "The section generation response did not match the expected format.",
      502,
      "SECTION_GENERATION_INVALID_RESPONSE"
    );
  }

  return parsed;
}
