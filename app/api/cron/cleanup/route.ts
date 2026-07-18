// Phase 9 scheduled cleanup endpoint (docs/08_Conditions_Translator_Implementation_Roadmap.md
// Phase 9). Intended to be invoked by Vercel Cron (see vercel.json) on a fixed schedule, and is
// also safe to call manually (e.g. for local/manual retry) with the same bearer token.
//
// Auth: requires `Authorization: Bearer <CLEANUP_JOB_SECRET>`. Vercel's own Cron feature only
// auto-attaches a bearer token for an env var literally named CRON_SECRET, so on Vercel set
// CRON_SECRET to the same value as CLEANUP_JOB_SECRET (see docs/Deployment_Vercel.md) — this
// route only ever reads CLEANUP_JOB_SECRET, keeping one canonical secret name in application code.
//
// Never returns or logs document/page/chat content — only counts (see lib/cleanup/sweep.ts).

import { NextResponse } from "next/server";
import { runCleanupSweep } from "@/lib/cleanup/sweep";
import { logger } from "@/lib/logger";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CLEANUP_JOB_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

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

// Allow POST too, so manual/non-cron callers (e.g. a PowerShell Invoke-RestMethod for local
// testing) don't need to special-case the HTTP method.
export const POST = GET;
