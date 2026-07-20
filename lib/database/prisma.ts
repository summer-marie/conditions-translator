/**
 * Prisma client singleton, backed by the Neon serverless adapter.
 *
 * A single client is reused across hot reloads in development to avoid exhausting Neon's
 * connection limit — the standard Next.js + Prisma singleton pattern. In production a
 * fresh client is created per server instance and not stashed on `globalThis`.
 *
 * @module lib/database/prisma
 */

import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@/generated/prisma/client";

/** Typed handle to the global object used to cache the client across dev hot reloads. */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Constructs a new PrismaClient wired to the Neon adapter using `DATABASE_URL`.
 *
 * @returns A ready-to-use {@link PrismaClient}.
 */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

/** Shared PrismaClient instance for the whole app. Import this everywhere DB access is needed. */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Cache the client on the global object outside production so repeated hot reloads reuse
// one connection pool rather than opening a new one on every reload.
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
