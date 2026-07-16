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

// Saved-account auth session lifetime, in hours (docs/05_Account_Creation_and_Temporary_Access.md).
// Unlike a temporary session, a signed-in user's saved Documents never expire; this only bounds
// how long the login cookie stays valid before the user must sign in again.
export const AUTH_SESSION_TTL_HOURS = readNumber("AUTH_SESSION_TTL_HOURS", 24 * 30);

export const DOCUMENT_MAX_PAGES = readNumber("DOCUMENT_MAX_PAGES", 10);

export const CHAT_MAX_DOCUMENTS = readNumber("CHAT_MAX_DOCUMENTS", 3);

export const CHAT_MAX_CONFIRMED_CHARACTERS = readNumber(
  "CHAT_MAX_CONFIRMED_CHARACTERS",
  50000
);

export const CHAT_MAX_USER_MESSAGES = readNumber("CHAT_MAX_USER_MESSAGES", 20);

export const CHAT_MAX_TOTAL_MESSAGES = readNumber("CHAT_MAX_TOTAL_MESSAGES", 40);

// Number of user questions after which the UI shows a "start a fresh chat soon" warning
// (docs/07_Launch_Readiness_Checklist.md §5).
export const CHAT_WARNING_USER_MESSAGES = readNumber(
  "CHAT_WARNING_USER_MESSAGES",
  17
);

// Temporary AI chat session lifetime, in minutes (docs/05_Account_Creation_and_Temporary_Access.md).
export const CHAT_SESSION_TTL_MINUTES = readNumber(
  "CHAT_SESSION_TTL_MINUTES",
  120
);

export const MAX_PAGE_SIZE_BYTES = readNumber("OCR_MAX_FILE_MB", 10) * 1024 * 1024;

// docs/03_OCR_Specifications.md: MVP OCR accepts images only (no PDF/DOCX/HEIC).
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// App display name shown in metadata and nav branding (env.example: NEXT_PUBLIC_APP_NAME).
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Conditions Translator";

// Default label a temporary Document is created with before the user names it (Phase 3 intake).
// Centralized so the creation call and any "still unnamed?" check never drift apart.
export const DEFAULT_DOCUMENT_TITLE = "Untitled Document";

// True when a Document still has its unedited default title (trimmed, case-insensitive).
export function isDefaultDocumentTitle(title: string): boolean {
  return title.trim().toLowerCase() === DEFAULT_DOCUMENT_TITLE.toLowerCase();
}
