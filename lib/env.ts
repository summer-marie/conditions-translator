// Server-side environment validation. Reports which required variables are missing
// and guards against secrets ever being exposed via NEXT_PUBLIC_. Never returns values.

const REQUIRED_SERVER_VARS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "OPENAI_API_KEY",
  "BLOB_STORE_ID",
  "CLEANUP_JOB_SECRET",
] as const;

const FORBIDDEN_PUBLIC_VARS = [
  "NEXT_PUBLIC_DATABASE_URL",
  "NEXT_PUBLIC_DIRECT_URL",
  "NEXT_PUBLIC_AUTH_SECRET",
  "NEXT_PUBLIC_OPENAI_API_KEY",
  "NEXT_PUBLIC_BLOB_STORE_ID",
  "NEXT_PUBLIC_CLEANUP_JOB_SECRET",
] as const;

export interface ServerEnvCheck {
  ok: boolean;
  missing: string[];
  exposedAsPublic: string[];
}

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
