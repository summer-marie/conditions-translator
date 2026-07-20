/**
 * Phase 9 scheduled cleanup API route (`docs/08_..._Roadmap.md` Phase 9).
 *
 * Invoked by Vercel Cron (see `vercel.json`) on a fixed schedule, and safe to call manually
 * for local/retry runs with the same bearer token.
 *
 * Auth: requires `Authorization: Bearer <CLEANUP_JOB_SECRET>`. Vercel's Cron auto-attaches a
 * bearer token only for an env var literally named `CRON_SECRET`, so on Vercel set
 * `CRON_SECRET` to the same value as `CLEANUP_JOB_SECRET` (see `docs/Deployment_Vercel.md`).
 * This route only ever reads `CLEANUP_JOB_SECRET`, keeping one canonical secret in app code.
 *
 * Schedule: `vercel.json` triggers this once daily (the Hobby plan's max cron frequency).
 * Never returns or logs document/page/chat content — only counts (see `lib/cleanup/sweep.ts`).
 *
 * @module app/api/cron/cleanup/route
 */

import { NextResponse } from "next/server";
import { runCleanupSweep } from "@/lib/cleanup/sweep";
import { logger } from "@/lib/logger";

/**
 * Verifies the request carries the cleanup bearer token.
 *
 * @param request - The incoming request.
 * @returns `true` when the `Authorization` header matches `Bearer <CLEANUP_JOB_SECRET>` and
 *   the secret is configured; otherwise `false`.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CLEANUP_JOB_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

/**
 * GET /api/cron/cleanup — runs the full expired-data cleanup sweep.
 *
 * Requires the cleanup bearer token (see {@link isAuthorized}). On success returns
 * `{ ok: true, ...counts }` from {@link runCleanupSweep}; on unexpected failure logs the
 * error name and returns `{ ok: false, error: "CLEANUP_SWEEP_FAILED" }`.
 *
 * @param request - The incoming request (checked for the bearer token).
 * @returns A JSON {@link NextResponse}: 401 when unauthorized, 200 on success, 500 on failure.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await runCleanupSweep();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("cleanup sweep: unexpected failure", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ ok: false, error: "CLEANUP_SWEEP_FAILED" }, { status: 500 });
  }
}

/**
 * POST /api/cron/cleanup — alias of {@link GET}.
 *
 * Lets manual/non-cron callers (e.g. a PowerShell `Invoke-RestMethod`) trigger the sweep
 * without special-casing the HTTP method.
 */
export const POST = GET;
