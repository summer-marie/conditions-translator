// Baseline error handling. AppError carries a client-safe message; unexpected errors
// are never forwarded to the client (no stack traces, no internal details).

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

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
