// Structured section-generation output contract (docs/03_OCR_Specifications.md §6,
// docs/04_Schema_Architecture.md).
//
// sourcePageNumbers refers to the 1-based position of a page within the ordered list of
// ACCEPTED pages sent to the model for this generation run (not a database order/id) — the
// caller maps these back to real Page ids after the response is parsed.

import { z } from "zod";

export const GeneratedSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
  sourcePageNumbers: z.array(z.number().int().positive()),
});

export const SectionGenerationResultSchema = z.object({
  sections: z.array(GeneratedSectionSchema).min(1),
});

export type GeneratedSection = z.infer<typeof GeneratedSectionSchema>;
export type SectionGenerationResult = z.infer<typeof SectionGenerationResultSchema>;
