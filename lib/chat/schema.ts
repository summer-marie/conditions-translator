// Structured chat-answer output contract (docs/06_AI_Safety_and_Persona.md,
// docs/07_Launch_Readiness_Checklist.md §6).
//
// The model never sees database ids. Each selected document is given a 1-based `documentNumber`
// (its position in the selection), and each ACCEPTED page within that document a 1-based
// `pageNumber` (its position among that document's accepted pages, in order). The model cites
// sources using those numbers; the caller maps them back to real Document/Page ids before
// persisting ChatMessageSource rows.
//
// Grounding flags:
//   - foundRelevantSource: false means the selected documents contained nothing relevant. When
//     false, NO source citations are stored (a missing-source answer never carries a citation).
//   - conflictDetected: true means the selected documents appear to disagree; the answer surfaces
//     both sides and defers to the supervising officer rather than choosing one.

import { z } from "zod";

export const ChatSourceReferenceSchema = z.object({
  documentNumber: z.number().int().positive(),
  pageNumbers: z.array(z.number().int().positive()),
});

export const ChatAnswerSchema = z.object({
  // Plain-language, source-grounded answer shown to the user.
  answer: z.string(),
  // True only when the selected documents actually contain relevant source text.
  foundRelevantSource: z.boolean(),
  // True when the selected documents appear to conflict on the asked-about point.
  conflictDetected: z.boolean(),
  // Supporting documents/pages. Should be empty when foundRelevantSource is false.
  sources: z.array(ChatSourceReferenceSchema),
});

export type ChatSourceReference = z.infer<typeof ChatSourceReferenceSchema>;
export type ChatAnswer = z.infer<typeof ChatAnswerSchema>;
