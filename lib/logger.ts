/**
 * Baseline structured (JSON-line) logger.
 *
 * Emits one JSON object per log call so entries are machine-parseable in production.
 *
 * SECURITY: callers must never pass raw document, OCR, or chat text as a message or in
 * `meta` — only identifiers and non-sensitive metadata are permitted (see `AGENTS.md`
 * and `docs/09_Coding_Risk_Register.md`).
 *
 * @module lib/logger
 */

/** Severity levels in ascending order of importance. */
type LogLevel = "debug" | "info" | "warn" | "error";

/** Numeric weight per level, used to decide whether an entry clears the configured threshold. */
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Resolves the active minimum log level from `LOG_LEVEL`, defaulting to `"info"`.
 *
 * @returns The configured {@link LogLevel}, or `"info"` when unset or unrecognized.
 */
function configuredLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

/**
 * Serializes and writes a single log entry when its level meets the configured threshold.
 *
 * Routes `error` to `console.error`, `warn` to `console.warn`, and everything else to
 * `console.log`, so severity is preserved for log collectors.
 *
 * @param level - Severity of this entry.
 * @param message - Human-readable message. Must contain no sensitive text.
 * @param meta - Optional non-sensitive structured fields merged into the JSON entry.
 */
function write(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[configuredLevel()]) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...meta,
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/**
 * Structured logger with one method per {@link LogLevel}.
 *
 * Each method emits a JSON line when the level clears the `LOG_LEVEL` threshold.
 *
 * @example
 * ```ts
 * logger.info("document.created", { documentId, pageCount });
 * ```
 */
export const logger = {
  /** Log at `debug` severity (suppressed unless `LOG_LEVEL=debug`). */
  debug: (message: string, meta?: Record<string, unknown>) => write("debug", message, meta),
  /** Log at `info` severity (the default threshold). */
  info: (message: string, meta?: Record<string, unknown>) => write("info", message, meta),
  /** Log at `warn` severity. */
  warn: (message: string, meta?: Record<string, unknown>) => write("warn", message, meta),
  /** Log at `error` severity. */
  error: (message: string, meta?: Record<string, unknown>) => write("error", message, meta),
};
