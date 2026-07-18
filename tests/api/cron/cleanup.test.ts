// Tests for the Phase 9 cron cleanup route (docs/08 Phase 9). Covers: rejecting requests without
// the correct bearer token, rejecting when CLEANUP_JOB_SECRET is unset, and running the sweep
// (returning only counts, never document/chat content) when authorized.

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { GET } from "@/app/api/cron/cleanup/route";
import { runCleanupSweep } from "@/lib/cleanup/sweep";

vi.mock("@/lib/cleanup/sweep", () => ({
  runCleanupSweep: vi.fn(),
}));

const ORIGINAL_SECRET = process.env.CLEANUP_JOB_SECRET;

function requestWithAuth(header?: string): Request {
  const headers = new Headers();
  if (header) headers.set("authorization", header);
  return new Request("http://localhost/api/cron/cleanup", { headers });
}

describe("GET /api/cron/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLEANUP_JOB_SECRET = "test-secret";
  });

  afterEach(() => {
    process.env.CLEANUP_JOB_SECRET = ORIGINAL_SECRET;
  });

  it("rejects a request with no Authorization header", async () => {
    const response = await GET(requestWithAuth());
    expect(response.status).toBe(401);
    expect(runCleanupSweep).not.toHaveBeenCalled();
  });

  it("rejects a request with the wrong bearer token", async () => {
    const response = await GET(requestWithAuth("Bearer wrong-value"));
    expect(response.status).toBe(401);
    expect(runCleanupSweep).not.toHaveBeenCalled();
  });

  it("rejects every request when CLEANUP_JOB_SECRET is not configured", async () => {
    delete process.env.CLEANUP_JOB_SECRET;
    const response = await GET(requestWithAuth("Bearer test-secret"));
    expect(response.status).toBe(401);
  });

  it("runs the sweep and returns only counts when the bearer token matches", async () => {
    vi.mocked(runCleanupSweep).mockResolvedValue({
      expiredChatSessionsDeleted: 1,
      expiredTemporarySessionsScanned: 2,
      temporarySessionsDeleted: 1,
      documentsCleanedUp: 3,
      documentsPendingRetry: 0,
    });

    const response = await GET(requestWithAuth("Bearer test-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(runCleanupSweep).toHaveBeenCalledTimes(1);
    expect(body).toEqual({
      ok: true,
      expiredChatSessionsDeleted: 1,
      expiredTemporarySessionsScanned: 2,
      temporarySessionsDeleted: 1,
      documentsCleanedUp: 3,
      documentsPendingRetry: 0,
    });
  });

  it("returns 500 without leaking error detail if the sweep throws", async () => {
    vi.mocked(runCleanupSweep).mockRejectedValue(new Error("db unavailable"));

    const response = await GET(requestWithAuth("Bearer test-secret"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: "CLEANUP_SWEEP_FAILED" });
  });
});
