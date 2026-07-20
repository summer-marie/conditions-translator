/**
 * Project-wide tunable limits and shared constants.
 *
 * Every limit is sourced from the approved MVP specifications
 * (`docs/01_MVP_PRD.md` and `docs/08_Conditions_Translator_Implementation_Roadmap.md`)
 * and read from the environment (see `env.example`) so operators can tune values
 * per-deployment without a code change. When an override is absent or unparseable,
 * the approved MVP default is used instead.
 *
 * @module lib/constants
 */

/**
 * Reads a numeric environment variable, falling back to a default when unset or invalid.
 *
 * @param envVar - Name of the environment variable to read.
 * @param fallback - Value to use when the variable is missing or not a finite number.
 * @returns The parsed number, or `fallback` when parsing fails.
 */
function readNumber(envVar: string, fallback: number): number {
  const raw = process.env[envVar];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Lifetime of an anonymous temporary session, in hours, before its Documents expire. */
export const TEMP_SESSION_TTL_HOURS = readNumber("TEMP_SESSION_TTL_HOURS", 24);

/**
 * Lifetime of a signed-in user's auth (login) cookie, in hours.
 *
 * Unlike a temporary session, a saved account's Documents never expire — this only
 * bounds how long a login stays valid before re-authentication is required
 * (`docs/05_Account_Creation_and_Temporary_Access.md`). Defaults to 30 days.
 */
export const AUTH_SESSION_TTL_HOURS = readNumber("AUTH_SESSION_TTL_HOURS", 24 * 30);

/** Maximum number of pages a single Document may contain. */
export const DOCUMENT_MAX_PAGES = readNumber("DOCUMENT_MAX_PAGES", 10);

/** Maximum number of READY Documents that may be selected into one chat context. */
export const CHAT_MAX_DOCUMENTS = readNumber("CHAT_MAX_DOCUMENTS", 3);

/** Upper bound on total accepted-text characters fed into a single chat context. */
export const CHAT_MAX_CONFIRMED_CHARACTERS = readNumber(
  "CHAT_MAX_CONFIRMED_CHARACTERS",
  50000
);

/** Maximum number of user questions allowed in one temporary chat session. */
export const CHAT_MAX_USER_MESSAGES = readNumber("CHAT_MAX_USER_MESSAGES", 20);

/** Maximum total messages (user + assistant) retained in one temporary chat session. */
export const CHAT_MAX_TOTAL_MESSAGES = readNumber("CHAT_MAX_TOTAL_MESSAGES", 40);

/**
 * User-question count at which the UI surfaces a "start a fresh chat soon" warning,
 * ahead of the hard {@link CHAT_MAX_USER_MESSAGES} cap
 * (`docs/07_Launch_Readiness_Checklist.md` §5).
 */
export const CHAT_WARNING_USER_MESSAGES = readNumber(
  "CHAT_WARNING_USER_MESSAGES",
  17
);

/**
 * Lifetime of a temporary AI chat session, in minutes, before it expires
 * (`docs/05_Account_Creation_and_Temporary_Access.md`).
 */
export const CHAT_SESSION_TTL_MINUTES = readNumber(
  "CHAT_SESSION_TTL_MINUTES",
  120
);

/** Maximum accepted size of a single uploaded page image, in bytes (default 10 MB). */
export const MAX_PAGE_SIZE_BYTES = readNumber("OCR_MAX_FILE_MB", 10) * 1024 * 1024;

/**
 * Maximum length of a user-submitted OCR transcription correction
 * (`OcrResult.correctedText`).
 *
 * Sized so that even a fully-corrected {@link DOCUMENT_MAX_PAGES}-page document
 * (`OCR_MAX_CORRECTION_CHARACTERS * DOCUMENT_MAX_PAGES`) cannot exceed the
 * single-document chat budget {@link CHAT_MAX_CONFIRMED_CHARACTERS} on its own.
 */
export const OCR_MAX_CORRECTION_CHARACTERS = readNumber(
  "OCR_MAX_CORRECTION_CHARACTERS",
  5_000
);

/**
 * MIME types accepted for page uploads. The MVP OCR pipeline handles images only —
 * no PDF, DOCX, or HEIC (`docs/03_OCR_Specifications.md`).
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

/** Public app display name used in page metadata and nav branding (`NEXT_PUBLIC_APP_NAME`). */
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Verity";

/**
 * Placeholder title assigned to a temporary Document at creation, before the user
 * renames it (Phase 3 intake). Centralized so the creation call and any
 * "still unnamed?" check stay in sync.
 */
export const DEFAULT_DOCUMENT_TITLE = "Untitled Document";

/**
 * Reports whether a Document still carries its unedited default title.
 *
 * @param title - The Document title to test.
 * @returns `true` when `title` equals {@link DEFAULT_DOCUMENT_TITLE}, compared
 *   case-insensitively and ignoring surrounding whitespace.
 */
export function isDefaultDocumentTitle(title: string): boolean {
  return title.trim().toLowerCase() === DEFAULT_DOCUMENT_TITLE.toLowerCase();
}

/**
 * Name of the `window` `CustomEvent` the workspace page dispatches immediately after
 * a "Finish Document" action succeeds.
 *
 * The shared sidenav in `components/layout/AppNav.tsx` listens for this to refresh its
 * finished-document list right away. Without it, that list only refetches on route
 * (pathname) changes, so a document finishing while the user stays on `/app/workspace`
 * would not appear until an unrelated navigation happened to trigger a refetch. This
 * single signal is the only shared state the two components need.
 */
export const DOCUMENTS_CHANGED_EVENT = "workspace:documents-changed";
