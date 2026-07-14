// Structured OCR output contract (docs/03_OCR_Specifications.md §4-5).
//
// The model must return exactly this shape (enforced by OpenAI Structured Outputs), so the
// server never has to guess at loosely-formatted text.

import { z } from "zod";

export const OcrQualitySchema = z.object({
  blurry: z.boolean(),
  cutOff: z.boolean(),
  sideways: z.boolean(),
  incomplete: z.boolean(),
  // True only when no meaningful text could be extracted at all.
  unreadable: z.boolean(),
});

export const OcrResultSchema = z.object({
  extractedText: z.string(),
  // Model's confidence that extractedText is accurate, 0-1.
  confidence: z.number().min(0).max(1),
  quality: OcrQualitySchema,
  // Practical retake guidance shown to the user when quality is poor; null when the page is fine.
  retakeGuidance: z.string().nullable(),
});

export type OcrQuality = z.infer<typeof OcrQualitySchema>;
export type OcrStructuredResult = z.infer<typeof OcrResultSchema>;

// Minimum extracted-text length treated as "usable" for acceptance purposes. Below this, a page
// is effectively a "mostly missing" scan even if the model didn't set `unreadable`.
export const MIN_USABLE_EXTRACTED_TEXT_LENGTH = 10;

// A page's quality is "clearly bad" — blocking acceptance — only when there is no meaningfully
// readable/usable text: the model explicitly reported the page unreadable, or extraction yielded
// next to nothing. Framing signals (blurry/cutOff/sideways/incomplete) are shown to the user as
// advisory warnings (see the workspace UI) but no longer block Accept by themselves: real phone
// photos are rarely perfectly framed, and the extracted text can still be complete and accurate
// enough to use despite imperfect geometry (docs/03_OCR_Specifications.md §5 — acceptance means
// "complete and accurate enough", not perfectly framed).
export function hasBlockingQualityIssue(quality: OcrQuality, extractedText: string): boolean {
  if (quality.unreadable) return true;
  return extractedText.trim().length < MIN_USABLE_EXTRACTED_TEXT_LENGTH;
}
