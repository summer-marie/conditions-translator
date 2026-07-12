// Server-side OpenAI call that turns accepted page text into plain-language sections
// (docs/03_OCR_Specifications.md §6, docs/04_Schema_Architecture.md).
//
// Model is always read from OPENAI_SECTION_MODEL — never hardcoded (docs/11_Model_Routing_and_
// Fallback.md). Runs only on the server; the API key never reaches the browser.

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AppError } from "@/lib/errors";
import { SectionGenerationResultSchema, type SectionGenerationResult } from "@/lib/sections/schema";

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
    // Never log the underlying error verbatim — it may echo back request content.
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
