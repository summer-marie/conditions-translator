// Regression tests for the workspace page's pure logic and constants: the OCR transcription
// correction UI (docs/03_OCR_Specifications.md §5, docs/OCR_Master_Implementation_Plan.md §7-8)
// -- the initial textarea value and the client-side validation mirror of correctPageOcr's
// server-side rules -- and the shared camera-capture file-input props used by both the initial
// upload and re-upload inputs.
//
// No component-rendering harness exists in this repo (vitest runs in the "node" environment —
// see vitest.config.ts — with no jsdom/React Testing Library), so this exercises the exported
// pure helpers/constants directly rather than rendering the page, matching the approach already
// used in tests/components/chat/DocumentInspector.test.ts.

import { describe, it, expect } from "vitest";
import {
  initialCorrectionValue,
  validateCorrectionText,
  PAGE_IMAGE_FILE_INPUT_PROPS,
  buildWorkspacePanelUrl,
} from "@/app/app/workspace/page";
import { OCR_MAX_CORRECTION_CHARACTERS } from "@/lib/constants";

// Covers the Sections/Pages tab toggle added for the finished-document overflow-actions pass
// (components/layout/AppNav.tsx's "Review pages" action navigates to a ?panel=pages URL built
// by this same function).
describe("buildWorkspacePanelUrl", () => {
  it("omits the panel param for the default Sections tab", () => {
    expect(buildWorkspacePanelUrl("documentId=doc-1", "sections")).toBe(
      "/app/workspace?documentId=doc-1"
    );
  });

  it("adds panel=pages for the Pages tab", () => {
    expect(buildWorkspacePanelUrl("documentId=doc-1", "pages")).toBe(
      "/app/workspace?documentId=doc-1&panel=pages"
    );
  });

  it("preserves documentId and drops only the panel param when switching back to Sections", () => {
    expect(buildWorkspacePanelUrl("documentId=doc-1&panel=pages", "sections")).toBe(
      "/app/workspace?documentId=doc-1"
    );
  });

  it("produces a bare path when there is no other query param left", () => {
    expect(buildWorkspacePanelUrl("", "sections")).toBe("/app/workspace");
  });
});

// Both the initial upload input and the re-upload input spread this same object (see
// app/app/workspace/page.tsx), so asserting on it covers both call sites at once without a
// component-rendering harness (see the file header comment above for why one doesn't exist here).
describe("PAGE_IMAGE_FILE_INPUT_PROPS", () => {
  it("accepts any image type so the browser's camera/gallery picker isn't narrowed", () => {
    expect(PAGE_IMAGE_FILE_INPUT_PROPS.accept).toBe("image/*");
  });

  it("hints the rear-facing camera via the standard capture attribute", () => {
    expect(PAGE_IMAGE_FILE_INPUT_PROPS.capture).toBe("environment");
  });

  it("does not set any attribute that would restrict desktop to camera-only capture", () => {
    // Desktop browsers ignore `capture` entirely and fall back to the normal file picker; this
    // object must never grow a `multiple: false` or similar restriction that could interfere.
    expect(Object.keys(PAGE_IMAGE_FILE_INPUT_PROPS).sort()).toEqual(["accept", "capture"]);
  });
});

describe("initialCorrectionValue", () => {
  it("initializes from correctedText when a correction already exists", () => {
    expect(
      initialCorrectionValue({
        extractedText: "Raw OCR mistke text.",
        correctedText: "Corrected text.",
        confidence: null,
        warnings: null,
      })
    ).toBe("Corrected text.");
  });

  it("falls back to extractedText when correctedText is null", () => {
    expect(
      initialCorrectionValue({
        extractedText: "Legacy accepted text.",
        correctedText: null,
        confidence: null,
        warnings: null,
      })
    ).toBe("Legacy accepted text.");
  });

  it("returns an empty string when there is no OCR result yet", () => {
    expect(initialCorrectionValue(null)).toBe("");
    expect(initialCorrectionValue(undefined)).toBe("");
  });
});

describe("validateCorrectionText", () => {
  it("rejects an empty string", () => {
    const { error } = validateCorrectionText("");
    expect(error).toBe("Correction cannot be empty.");
  });

  it("rejects whitespace-only text", () => {
    const { error } = validateCorrectionText("   \n\t  ");
    expect(error).toBe("Correction cannot be empty.");
  });

  it("trims outer whitespace before validating", () => {
    const { trimmed, error } = validateCorrectionText("   Report to your officer monthly.   ");
    expect(trimmed).toBe("Report to your officer monthly.");
    expect(error).toBeNull();
  });

  it("preserves internal spaces and line breaks", () => {
    const multilineText = "Line one.\nLine  two with double space.\n\nLine three.";
    const { trimmed, error } = validateCorrectionText(`  ${multilineText}  `);
    expect(trimmed).toBe(multilineText);
    expect(error).toBeNull();
  });

  it("accepts text at exactly the maximum correction length", () => {
    const exactlyMax = "a".repeat(OCR_MAX_CORRECTION_CHARACTERS);
    const { error } = validateCorrectionText(exactlyMax);
    expect(error).toBeNull();
  });

  it("rejects text over the maximum correction length", () => {
    const tooLong = "a".repeat(OCR_MAX_CORRECTION_CHARACTERS + 1);
    const { error } = validateCorrectionText(tooLong);
    expect(error).toBe(
      `Correction cannot exceed ${OCR_MAX_CORRECTION_CHARACTERS} characters.`
    );
  });
});
