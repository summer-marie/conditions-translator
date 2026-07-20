/**
 * Health-check API route.
 *
 * @module app/api/health/route
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { validateServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * GET /api/health — liveness/readiness probe.
 *
 * Validates the server environment and, when nothing is missing, probes the database with a
 * trivial `SELECT 1`. A DB failure is logged (message only) and reflected in the response
 * rather than thrown.
 *
 * Response body: `{ status: "ok" | "degraded", checks: { env, missingEnvVars,
 * envExposedAsPublic, database }, timestamp }`. Returns HTTP 200 when healthy, 503 otherwise.
 *
 * @returns A JSON {@link NextResponse} describing health status.
 */
export async function GET() {
  const envCheck = validateServerEnv();

  let databaseOk = false;
  if (envCheck.missing.length === 0) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseOk = true;
    } catch (error) {
      logger.error("health check: database connection failed", {
        reason: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  const status = envCheck.ok && databaseOk ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      checks: {
        env: envCheck.ok,
        missingEnvVars: envCheck.missing,
        envExposedAsPublic: envCheck.exposedAsPublic,
        database: databaseOk,
      },
      timestamp: new Date().toISOString(),
    },
    { status: status === "ok" ? 200 : 503 }
  );
}
