import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// The Prisma CLI does not read .env.local automatically, so it is loaded explicitly
// to match this project's local-development convention (see env.example).
config({ path: ".env.local" });

// This config is consumed ONLY by the Prisma CLI (migrate, generate, studio) — never by the
// runtime PrismaClient, which is instantiated in lib/database/prisma.ts with the Neon driver
// adapter over the pooled DATABASE_URL. Prisma 7 removed the `directUrl` field, so we point the
// CLI's single `url` at DIRECT_URL: schema migrations require Neon's direct (non-pooled) endpoint
// because the pgBouncer pooler does not support the DDL/advisory-lock operations Prisma Migrate
// performs. Runtime queries continue to use the pooled endpoint.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_URL"),
  },
});
