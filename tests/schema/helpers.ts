import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/database/prisma";

// Schema/ownership tests are integration tests that require a live PostgreSQL database with the
// migration applied. When DATABASE_URL is missing or still holds the env.example placeholder,
// callers skip these suites (describe.skipIf) so `npm test` never hard-fails without a database.
export function isLiveDbConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  if (!url) return false;
  if (url.includes("USER:PASSWORD") || url.includes("replace-with")) return false;
  return true;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

// Tracks the root owner rows created by a test so afterEach can remove them. Deleting a User or
// TemporarySession cascades to its Documents and all downstream children, keeping the shared dev
// database clean between tests.
export class OwnerCleanup {
  private userIds = new Set<string>();
  private tempSessionIds = new Set<string>();

  async createTemporarySession(input?: { expiresAt?: Date }) {
    const session = await prisma.temporarySession.create({
      data: {
        token: randomUUID(),
        expiresAt: input?.expiresAt ?? new Date(Date.now() + ONE_HOUR_MS),
      },
    });
    this.tempSessionIds.add(session.id);
    return session;
  }

  async createUser() {
    const user = await prisma.user.create({
      data: {
        email: `test-${randomUUID()}@example.com`,
        passwordHash: "test-only-not-a-real-hash",
      },
    });
    this.userIds.add(user.id);
    return user;
  }

  async cleanup() {
    if (this.tempSessionIds.size > 0) {
      await prisma.temporarySession.deleteMany({
        where: { id: { in: [...this.tempSessionIds] } },
      });
      this.tempSessionIds.clear();
    }
    if (this.userIds.size > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: [...this.userIds] } },
      });
      this.userIds.clear();
    }
  }
}

export function futureDate(msFromNow = ONE_HOUR_MS): Date {
  return new Date(Date.now() + msFromNow);
}
