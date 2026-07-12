// Server-side OpenAI Vision OCR call (docs/03_OCR_Specifications.md).
//
// Model is always read from OPENAI_OCR_MODEL — never hardcoded (Phase 4 core invariant).
// Runs only on the server; the API key never reaches the browser.

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AppError } from "@/lib/errors";
import { OcrResultSchema, type OcrStructuredResult } from "@/lib/ocr/schema";

const SYSTEM_PROMPT = `You perform OCR on a single photographed or scanned page of a legal \
supervision document (probation or parole conditions). Extract the visible text exactly as \
written, including printed text, handwriting, checkboxes (render as [x] or [ ]), and financial \
values, but only when you are reasonably confident. Do not infer, summarize, or invent text that \
is not visibly present.

Also assess image quality. Set "unreadable" to true only if no meaningful text can be extracted \
at all. Set "blurry", "cutOff", "sideways", and "incomplete" independently based on what you \
observe, even when some text was still extracted. When quality is poor, set "retakeGuidance" to \
one short, practical sentence (e.g. "Retake in better lighting" or "Include the full page in the \
frame"); otherwise set it to null.`;

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

export async function runPageOcr(params: {
  imageBuffer: Buffer;
  contentType: string;
}): Promise<OcrStructuredResult> {
  const model = process.env.OPENAI_OCR_MODEL;
  if (!model) {
    throw new AppError("OCR model is not configured.", 500, "OCR_MODEL_NOT_CONFIGURED");
  }

  const dataUrl = `data:${params.contentType};base64,${params.imageBuffer.toString("base64")}`;

  let response;
  try {
    response = await getClient().responses.parse({
      model,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "input_text", text: "Extract this page's text and assess its image quality." },
            { type: "input_image", image_url: dataUrl, detail: "high" },
          ],
        },
      ],
      text: { format: zodTextFormat(OcrResultSchema, "page_ocr_result") },
    });
  } catch {
    // Never log the underlying error verbatim — it may echo back request content.
    throw new AppError("The OCR request failed.", 502, "OCR_REQUEST_FAILED");
  }

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new AppError(
      "The OCR response did not match the expected format.",
      502,
      "OCR_INVALID_RESPONSE"
    );
  }

  return parsed;
}
