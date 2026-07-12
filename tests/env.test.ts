import { describe, expect, it } from "vitest";
import { validateServerEnv } from "@/lib/env";

const BASE_VALID_ENV = {
  DATABASE_URL: "postgresql://user:pass@host/db",
  DIRECT_URL: "postgresql://user:pass@host/db",
  AUTH_SECRET: "test-secret",
  OPENAI_API_KEY: "test-key",
  BLOB_STORE_ID: "store_test123",
  CLEANUP_JOB_SECRET: "test-secret",
};

describe("validateServerEnv", () => {
  it("passes when all required server-side variables are present", () => {
    const result = validateServerEnv({ ...BASE_VALID_ENV });
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.exposedAsPublic).toEqual([]);
  });

  it("reports each missing required variable", () => {
    const { DATABASE_URL, ...rest } = BASE_VALID_ENV;
    void DATABASE_URL;
    const result = validateServerEnv({ ...rest });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("DATABASE_URL");
  });

  it("fails if a secret is ever exposed via a NEXT_PUBLIC_ variable", () => {
    const result = validateServerEnv({
      ...BASE_VALID_ENV,
      NEXT_PUBLIC_OPENAI_API_KEY: "leaked",
    });
    expect(result.ok).toBe(false);
    expect(result.exposedAsPublic).toContain("NEXT_PUBLIC_OPENAI_API_KEY");
  });
});
