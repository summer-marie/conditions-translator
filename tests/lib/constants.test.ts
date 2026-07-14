// Tests for the default-document-title helpers used by the document-labeling flow
// (app/app/workspace/page.tsx's naming nudge, lib/actions/document.ts's createTemporaryDocument).

import { describe, it, expect } from "vitest";
import { DEFAULT_DOCUMENT_TITLE, isDefaultDocumentTitle } from "@/lib/constants";

describe("isDefaultDocumentTitle", () => {
  it("is true for the exact default title", () => {
    expect(isDefaultDocumentTitle(DEFAULT_DOCUMENT_TITLE)).toBe(true);
  });

  it("is true regardless of case or surrounding whitespace", () => {
    expect(isDefaultDocumentTitle("  untitled document  ")).toBe(true);
    expect(isDefaultDocumentTitle("UNTITLED DOCUMENT")).toBe(true);
  });

  it("is false once the document has been given a real label", () => {
    expect(isDefaultDocumentTitle("Probation Conditions")).toBe(false);
  });

  it("is false for a title that merely contains the word 'untitled'", () => {
    expect(isDefaultDocumentTitle("Untitled Document (draft)")).toBe(false);
  });
});
