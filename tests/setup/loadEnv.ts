// Vitest setup: load .env.local into process.env before any test module (and therefore the
// Prisma client singleton) is imported. Schema/ownership integration tests rely on the live
// DATABASE_URL; unit tests ignore it.
import { config } from "dotenv";

config({ path: ".env.local" });
