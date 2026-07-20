/**
 * Baseline error handling.
 *
 * {@link AppError} is the one error type whose message is considered safe to show a
 * client. Everything else is treated as unexpected and collapsed into a generic 500 by
 * {@link toSafeErrorResponse}, so stack traces and internal details never reach the wire.
 *
 * @module lib/errors
 */

/**
 * An application error whose `message` is safe to expose to clients.
 *
 * Throw this (rather than a bare `Error`) whenever the caller — including the end user —
 * should see a specific, non-sensitive explanation and a matching HTTP status.
 *
 * @example
 * ```ts
 * throw new AppError("Document not found", 404, "NOT_FOUND");
 * ```
 */
export class AppError extends Error {
  /** HTTP status code to return for this error. */
  readonly statusCode: number;
  /** Stable machine-readable error code (e.g. `"NOT_FOUND"`). */
  readonly code: string;

  /**
   * @param message - Client-safe description of what went wrong.
   * @param statusCode - HTTP status to associate with the error. Defaults to `500`.
   * @param code - Stable error code for programmatic handling. Defaults to `"INTERNAL_ERROR"`.
   */
  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Converts any thrown value into a client-safe HTTP response descriptor.
 *
 * A known {@link AppError} passes its status, code, and message through. Any other value
 * is deliberately flattened to a generic 500 so no internal detail leaks.
 *
 * @param error - The caught value (typed `unknown`, as caught errors are).
 * @returns An object with an HTTP `status` and a `body` of `{ error, message }` suitable
 *   for returning directly from an API route.
 */
export function toSafeErrorResponse(error: unknown): {
  status: number;
  body: { error: string; message: string };
} {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: { error: error.code, message: error.message },
    };
  }

  return {
    status: 500,
    body: { error: "INTERNAL_ERROR", message: "An unexpected error occurred." },
  };
}
