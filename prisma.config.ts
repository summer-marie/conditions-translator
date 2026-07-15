import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// The Prisma CLI does not read .env.local automatically, so it is loaded explicitly
// to match this project's local-development convention (see env.example). On Vercel there is no
// .env.local; DIRECT_URL comes from the platform environment, so this call is a harmless no-op.
config({ path: ".env.local" });

// This config is consumed ONLY by the Prisma CLI (migrate, generate, studio) — never by the
// runtime PrismaClient, which is instantiated in lib/database/prisma.ts with the Neon driver
// adapter over the pooled DATABASE_URL. Prisma 7 removed the `directUrl` field, so we point the
// CLI's single `url` at DIRECT_URL: schema migrations require Neon's direct (non-pooled) endpoint
// because the pgBouncer pooler does not support the DDL/advisory-lock operations Prisma Migrate
// performs. Runtime queries continue to use the pooled endpoint.
//
// The URL is read from process.env directly (with a "" fallback) rather than Prisma's `env()`
// helper on purpose: `env("DIRECT_URL")` is resolved EAGERLY when this config loads and THROWS
// (`PrismaConfigEnvError: Cannot resolve environment variable: DIRECT_URL`) if the var is unset —
// which breaks `prisma generate` (the Vercel build/postinstall step) even though code generation
// needs no database connection. The fallback lets `generate` succeed without DIRECT_URL; the
// DB-touching commands (`migrate deploy`, `studio`) are always run with DIRECT_URL present.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? "",
  },
});
