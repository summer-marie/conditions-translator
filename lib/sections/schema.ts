/**
 * Structured section-generation output contract (`docs/03_OCR_Specifications.md` §6,
 * `docs/04_Schema_Architecture.md`).
 *
 * `sourcePageNumbers` refers to a page's 1-based position within the ordered list of
 * ACCEPTED pages sent to the model for this generation run — not a database order or id.
 * The caller maps these numbers back to real Page ids after the response is parsed.
 *
 * @module lib/sections/schema
 */

import { z } from "zod";

/** One generated section: a heading, a plain-language body, and its source page numbers. */
export const GeneratedSectionSchema = z.object({
  heading: z.string(),
  body: z.string(),
  sourcePageNumbers: z.array(z.number().int().positive()),
});

/** The full section-generation result: at least one {@link GeneratedSectionSchema}. */
export const SectionGenerationResultSchema = z.object({
  sections: z.array(GeneratedSectionSchema).min(1),
});

/** A single generated section, inferred from {@link GeneratedSectionSchema}. */
export type GeneratedSection = z.infer<typeof GeneratedSectionSchema>;
/** The validated generation result, inferred from {@link SectionGenerationResultSchema}. */
export type SectionGenerationResult = z.infer<typeof SectionGenerationResultSchema>;
