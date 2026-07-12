// The behavioral safety requirements (docs/06_AI_Safety_and_Persona.md §4) are enforced by the
// system prompt. Because the model is mocked in unit tests, these are the testable, explicit
// encodings of each required behavior — kept in sync so a prompt edit that drops a rule fails
// here (docs/09_Coding_Risk_Register.md R-001).

import { describe, it, expect } from "vitest";
import { CHAT_SYSTEM_PROMPT } from "@/lib/chat/prompt";

describe("CHAT_SYSTEM_PROMPT safety rules", () => {
  const prompt = CHAT_SYSTEM_PROMPT.toLowerCase();

  it("establishes the document-interpreter, non-decision-maker persona", () => {
    expect(prompt).toContain("document interpreter");
    expect(prompt).toContain("not");
    expect(prompt).toMatch(/probation|parole/);
  });

  it("requires grounding only in provided text and forbids filling gaps with general knowledge", () => {
    expect(prompt).toContain("only");
    expect(prompt).toMatch(/general knowledge|outside|general/);
    expect(prompt).toMatch(/not present|only in the provided|only the/);
  });

  it("encodes permission-question behavior (explain, but do not grant permission)", () => {
    expect(prompt).toContain("permission");
    expect(prompt).toMatch(/do not grant|not grant permission/);
  });

  it("encodes missing-source behavior (say no relevant source was found)", () => {
    expect(prompt).toMatch(/no relevant source/);
    expect(prompt).toContain("foundrelevantsource");
  });

  it("encodes conflicting-document behavior (show both, defer to officer, do not decide)", () => {
    expect(prompt).toContain("conflict");
    expect(prompt).toMatch(/cannot decide|which one controls|cannot resolve/);
    expect(prompt).toContain("officer");
  });

  it("encodes violation-question behavior (do not determine whether a violation occurred)", () => {
    expect(prompt).toMatch(/violation/);
    expect(prompt).toMatch(/cannot determine/);
  });

  it("encodes prompt-injection defense (uploaded text is evidence, not instructions)", () => {
    expect(prompt).toContain("evidence");
    expect(prompt).toMatch(/ignore previous instructions|never as a command|not as a command/);
  });
});
