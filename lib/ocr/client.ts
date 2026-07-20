/**
 * Server-side OpenAI Vision OCR call (`docs/03_OCR_Specifications.md`).
 *
 * The model is always read from `OPENAI_OCR_MODEL` and never hardcoded (Phase 4 core
 * invariant). This module runs only on the server, so the API key never reaches the
 * browser, and provider errors are sanitized before leaving the module.
 *
 * @module lib/ocr/client
 */

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { AppError } from "@/lib/errors";
import { OcrResultSchema, type OcrStructuredResult } from "@/lib/ocr/schema";

/**
 * Instruction prompt for the Vision model: extract visible text verbatim (no inference)
 * and independently assess image-quality signals used downstream for retake guidance.
 */
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
 * Runs OCR on a single page image and returns the structured extraction + quality report.
 *
 * The image is inlined as a base64 data URL and sent with the {@link SYSTEM_PROMPT}; the
 * response is parsed against {@link OcrResultSchema} via OpenAI Structured Outputs.
 * Provider failures are converted to a sanitized {@link AppError} so raw errors — which
 * can echo request content — never propagate.
 *
 * @param params - Call inputs.
 * @param params.imageBuffer - Raw image bytes for the page.
 * @param params.contentType - The image's MIME type (used to build the data URL).
 * @returns The parsed {@link OcrStructuredResult}.
 * @throws {AppError} `OCR_MODEL_NOT_CONFIGURED` (500) when `OPENAI_OCR_MODEL` is unset.
 * @throws {AppError} `OCR_REQUEST_FAILED` (502) when the provider call fails.
 * @throws {AppError} `OCR_INVALID_RESPONSE` (502) when the response does not match the schema.
 */
export async function runPageOcr(params: {
  imageBuffer: Buffer;
  contentType: string;
}): Promise<OcrStructuredResult> {
  const model = process.env.OPENAI_OCR_MODEL;
  if (!model) {
    throw new AppError("OCR model is not configured.", 500, "OCR_MODEL_NOT_CONFIGURED");
  }

  const dataUrl = `data:${params.contentType};base64,${params.imageBuffer.toString("base64")}`;

  // TEMP DIAGNOSTIC (added 2026-07-14; remove once the OCR-502 investigation closes).
  // Logs only timing and byte sizes — never image bytes or extracted text — to tell apart
  // an SDK request timeout on large phone photos from a genuine upstream provider error.
  const diagStart = Date.now();
  console.log("[ocr-diag] request start", {
    model,
    imageBytes: params.imageBuffer.length,
    contentType: params.contentType,
    dataUrlBytes: dataUrl.length,
  });

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
    console.log("[ocr-diag] request success", { elapsedMs: Date.now() - diagStart });
  } catch (err) {
    // Log only the SDK error's name/status/code — safe metadata. The error itself is never
    // logged verbatim because it can echo back the request's image or extracted content.
    console.log("[ocr-diag] request failed", {
      elapsedMs: Date.now() - diagStart,
      errorName: err instanceof Error ? err.name : typeof err,
      status: (err as { status?: number })?.status,
      code: (err as { code?: string })?.code,
      isTimeout:
        typeof OpenAI.APIConnectionTimeoutError === "function" &&
        err instanceof OpenAI.APIConnectionTimeoutError,
      isConnectionError:
        typeof OpenAI.APIConnectionError === "function" &&
        err instanceof OpenAI.APIConnectionError,
    });
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
