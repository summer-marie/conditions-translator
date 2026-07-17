// Regression test for the accepted-text source selection used by the Document Inspector preview
// (docs/OCR_Master_Implementation_Plan.md §7-8): must match lib/chat/context.ts and
// lib/sections/generate.ts exactly, so inspector previews and citation text never disagree with
// what the AI actually saw.
//
// No component-rendering harness exists in this repo (vitest runs in the "node" environment —
// see vitest.config.ts — with no jsdom/React Testing Library), so this exercises the exported
// pure selector directly rather than rendering the component.

import { describe, it, expect } from "vitest";
import { acceptedPageText } from "@/components/chat/DocumentInspector";

describe("acceptedPageText", () => {
  it("uses correctedText when a correction exists", () => {
    expect(
      acceptedPageText({ extractedText: "Raw OCR mistke text.", correctedText: "Corrected text." })
    ).toBe("Corrected text.");
  });

  it("falls back to extractedText for a legacy accepted page with correctedText = null", () => {
    expect(
      acceptedPageText({ extractedText: "Legacy accepted text.", correctedText: null })
    ).toBe("Legacy accepted text.");
  });
});
