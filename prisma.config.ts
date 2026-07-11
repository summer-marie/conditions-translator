import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// The Prisma CLI does not read .env.local automatically, so it is loaded explicitly
// to match this project's local-development convention (see env.example).
config({ path: ".env.local" });

// NOTE: Prisma 7.8.0's `datasource` config only accepts `url` and `shadowDatabaseUrl`
// (verified against node_modules/@prisma/config/dist/index.d.ts) — there is no `directUrl`
// field here despite some current docs describing one. DIRECT_URL remains documented in
// env.example for Neon's direct (non-pooled) connection; revisit this file if a future
// Prisma release adds first-class direct-connection support to prisma.config.ts.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
