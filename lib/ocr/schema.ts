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

// A page's quality is "clearly bad" if the model flagged any of these — Accept must be blocked
// even when some text was still extracted (docs/03_OCR_Specifications.md §5, roadmap Phase 4).
export function hasBlockingQualityIssue(quality: OcrQuality): boolean {
  return quality.blurry || quality.cutOff || quality.sideways || quality.incomplete || quality.unreadable;
}
