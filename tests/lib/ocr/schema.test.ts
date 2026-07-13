// Tests for the OCR page-acceptance gate (docs/03_OCR_Specifications.md §5).
//
// Acceptance should block only on genuinely unusable pages (unreadable, or next to no text
// extracted) — not on framing imperfections (blurry/cutOff/sideways/incomplete), since real
// phone photos are rarely perfectly framed but can still be fully readable.

import { describe, it, expect } from "vitest";
import { hasBlockingQualityIssue, MIN_USABLE_EXTRACTED_TEXT_LENGTH } from "@/lib/ocr/schema";

const noWarnings = {
  blurry: false,
  cutOff: false,
  sideways: false,
  incomplete: false,
  unreadable: false,
};

const READABLE_TEXT =
  "ARIZONA CODE OF JUDICIAL ADMINISTRATION Part 6: Probation Chapter 2: Adult";

describe("hasBlockingQualityIssue", () => {
  it("blocks when the model reports the page unreadable, regardless of extracted text", () => {
    expect(hasBlockingQualityIssue({ ...noWarnings, unreadable: true }, READABLE_TEXT)).toBe(true);
  });

  it("blocks when extracted text is empty", () => {
    expect(hasBlockingQualityIssue(noWarnings, "")).toBe(true);
  });

  it("blocks when extracted text is shorter than the usable-text threshold", () => {
    const shortText = "a".repeat(MIN_USABLE_EXTRACTED_TEXT_LENGTH - 1);
    expect(hasBlockingQualityIssue(noWarnings, shortText)).toBe(true);
  });

  it("does not block at exactly the usable-text threshold", () => {
    const exactText = "a".repeat(MIN_USABLE_EXTRACTED_TEXT_LENGTH);
    expect(hasBlockingQualityIssue(noWarnings, exactText)).toBe(false);
  });

  it("does not block on blurry alone when the text is readable", () => {
    expect(hasBlockingQualityIssue({ ...noWarnings, blurry: true }, READABLE_TEXT)).toBe(false);
  });

  it("does not block on cutOff alone when the text is readable", () => {
    expect(hasBlockingQualityIssue({ ...noWarnings, cutOff: true }, READABLE_TEXT)).toBe(false);
  });

  it("does not block on sideways alone when the text is readable", () => {
    expect(hasBlockingQualityIssue({ ...noWarnings, sideways: true }, READABLE_TEXT)).toBe(false);
  });

  it("does not block on incomplete alone when the text is readable", () => {
    expect(hasBlockingQualityIssue({ ...noWarnings, incomplete: true }, READABLE_TEXT)).toBe(
      false
    );
  });

  it("does not block when every framing flag is set but the text is readable", () => {
    expect(
      hasBlockingQualityIssue(
        { blurry: true, cutOff: true, sideways: true, incomplete: true, unreadable: false },
        READABLE_TEXT
      )
    ).toBe(false);
  });

  it("still blocks combined framing flags if the text is also too short", () => {
    expect(
      hasBlockingQualityIssue(
        { blurry: true, cutOff: true, sideways: true, incomplete: true, unreadable: false },
        "hi"
      )
    ).toBe(true);
  });
});
