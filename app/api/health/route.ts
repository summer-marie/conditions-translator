import { NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { validateServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";

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
