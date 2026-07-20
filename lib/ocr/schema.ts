/**
 * Structured OCR output contract (`docs/03_OCR_Specifications.md` §4–5).
 *
 * The model must return exactly this shape (enforced by OpenAI Structured Outputs), so
 * the server never has to guess at loosely-formatted free text.
 *
 * @module lib/ocr/schema
 */

import { z } from "zod";

/** Per-page image-quality signals the model reports alongside the extracted text. */
export const OcrQualitySchema = z.object({
  /** Text is present but out of focus. */
  blurry: z.boolean(),
  /** Part of the page is outside the frame. */
  cutOff: z.boolean(),
  /** The page is rotated relative to upright. */
  sideways: z.boolean(),
  /** The capture appears to be missing content. */
  incomplete: z.boolean(),
  /** True only when no meaningful text could be extracted at all. */
  unreadable: z.boolean(),
});

/** The complete structured result returned for a single OCR'd page. */
export const OcrResultSchema = z.object({
  /** The verbatim extracted page text. */
  extractedText: z.string(),
  /** Model's confidence that `extractedText` is accurate, in the range 0–1. */
  confidence: z.number().min(0).max(1),
  /** Independent image-quality assessment. */
  quality: OcrQualitySchema,
  /** Practical retake guidance shown when quality is poor; `null` when the page is fine. */
  retakeGuidance: z.string().nullable(),
});

/** Image-quality signals, inferred from {@link OcrQualitySchema}. */
export type OcrQuality = z.infer<typeof OcrQualitySchema>;
/** Full structured OCR result, inferred from {@link OcrResultSchema}. */
export type OcrStructuredResult = z.infer<typeof OcrResultSchema>;

/**
 * Minimum extracted-text length treated as "usable" for acceptance. Below this a page is
 * effectively a mostly-missing scan even if the model did not flag it `unreadable`.
 */
export const MIN_USABLE_EXTRACTED_TEXT_LENGTH = 10;

/**
 * Reports whether a page has a quality issue severe enough to block acceptance.
 *
 * Only genuine unreadability blocks: the model explicitly reported `unreadable`, or
 * extraction produced essentially no text. The framing signals
 * (blurry/cutOff/sideways/incomplete) are surfaced to the user as advisory warnings but
 * do NOT block Accept on their own — real phone photos are rarely perfectly framed, and
 * the extracted text can still be complete and accurate enough to use. Acceptance means
 * "complete and accurate enough", not "perfectly framed" (`docs/03_OCR_Specifications.md` §5).
 *
 * @param quality - The model's quality assessment for the page.
 * @param extractedText - The text extracted from the page.
 * @returns `true` when acceptance should be blocked, otherwise `false`.
 */
export function hasBlockingQualityIssue(quality: OcrQuality, extractedText: string): boolean {
  if (quality.unreadable) return true;
  return extractedText.trim().length < MIN_USABLE_EXTRACTED_TEXT_LENGTH;
}
