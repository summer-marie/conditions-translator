/**
 * Server-side environment validation.
 *
 * Confirms that every secret the server needs is present, and — critically — that no
 * secret has been mistakenly exposed under a `NEXT_PUBLIC_` name (which Next.js would
 * inline into the client bundle). The check only ever reports variable *names*; it
 * never returns or logs a secret value.
 *
 * @module lib/env
 */

/** Server secrets that must be present for the app to operate. */
const REQUIRED_SERVER_VARS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "OPENAI_API_KEY",
  "BLOB_STORE_ID",
  "CLEANUP_JOB_SECRET",
] as const;

/**
 * `NEXT_PUBLIC_`-prefixed names that would leak a server secret to the browser bundle.
 * Their presence is always a misconfiguration and fails validation.
 */
const FORBIDDEN_PUBLIC_VARS = [
  "NEXT_PUBLIC_DATABASE_URL",
  "NEXT_PUBLIC_DIRECT_URL",
  "NEXT_PUBLIC_AUTH_SECRET",
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_BLOB_STORE_ID",
  "NEXT_PUBLIC_CLEANUP_JOB_SECRET",
] as const;

/** Outcome of {@link validateServerEnv}. */
export interface ServerEnvCheck {
  /** `true` only when nothing is missing and nothing is exposed. */
  ok: boolean;
  /** Names of required server variables that are absent. */
  missing: string[];
  /** Names of server secrets wrongly exposed via a `NEXT_PUBLIC_` variable. */
  exposedAsPublic: string[];
}

/**
 * Validates the server environment for required secrets and accidental public exposure.
 *
 * @param env - Environment map to inspect; defaults to `process.env`. Injectable for tests.
 * @returns A {@link ServerEnvCheck} listing missing and exposed variable names. Values
 *   themselves are never included, so the result is safe to log.
 *
 * @example
 * ```ts
 * const check = validateServerEnv();
 * if (!check.ok) throw new Error(`Env misconfigured: ${check.missing.join(", ")}`);
 * ```
 */
export function validateServerEnv(
  env: Record<string, string | undefined> = process.env
): ServerEnvCheck {
  const missing = REQUIRED_SERVER_VARS.filter((key) => !env[key]);
  const exposedAsPublic = FORBIDDEN_PUBLIC_VARS.filter((key) => !!env[key]);

  return {
    ok: missing.length === 0 && exposedAsPublic.length === 0,
    missing,
    exposedAsPublic,
  };
}
