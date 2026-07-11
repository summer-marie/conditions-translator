// Project-wide limits from docs/01_MVP_PRD.md and docs/08_Conditions_Translator_Implementation_Roadmap.md.
// Values are read from the environment (see env.example) so they can be tuned without a code change,
// falling back to the approved MVP defaults.

function readNumber(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const TEMP_SESSION_TTL_HOURS = readNumber("TEMP_SESSION_TTL_HOURS", 24);

export const DOCUMENT_MAX_PAGES = readNumber("DOCUMENT_MAX_PAGES", 10);

export const CHAT_MAX_DOCUMENTS = readNumber("CHAT_MAX_DOCUMENTS", 3);

export const CHAT_MAX_CONFIRMED_CHARACTERS = readNumber(
  "CHAT_MAX_CONFIRMED_CHARACTERS",
  50000
);

export const CHAT_MAX_TOTAL_MESSAGES = readNumber("CHAT_MAX_TOTAL_MESSAGES", 40);
