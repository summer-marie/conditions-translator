import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/database/prisma";
import {
  assertOwnedDocument,
  createDocument,
  getOwnedDocument,
  listOwnedDocuments,
  temporaryOwner,
  userOwner,
} from "@/lib/permissions/ownership";
import { AppError } from "@/lib/errors";
import { OwnerCleanup, futureDate, isLiveDbConfigured } from "./helpers";

// Integration tests against a live database. The XOR-ownership and expiry rules are enforced by
// DB CHECK constraints (see the init migration), so these tests exercise the real Prisma client
// against the real schema rather than a mock.
describe.skipIf(!isLiveDbConfigured())("Document ownership", () => {
  const owners = new OwnerCleanup();

  afterEach(async () => {
    await owners.cleanup();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a temporary (session-owned) Document with an expiry", async () => {
    const session = await owners.createTemporarySession();
    const doc = await createDocument(temporaryOwner(session.id), {
      title: "Conditions of Probation",
      expiresAt: futureDate(),
    });

    expect(doc.temporarySessionId).toBe(session.id);
    expect(doc.userId).toBeNull();
    expect(doc.expiresAt).toBeInstanceOf(Date);
    expect(doc.status).toBe("IN_PROGRESS");
    expect(doc.deletionState).toBe("ACTIVE");
  });

  it("creates a saved (user-owned) Document that never expires", async () => {
    const user = await owners.createUser();
    const doc = await createDocument(userOwner(user.id), {
      title: "Saved Conditions",
    });

    expect(doc.userId).toBe(user.id);
    expect(doc.temporarySessionId).toBeNull();
    expect(doc.expiresAt).toBeNull();
  });

  it("rejects dual ownership (both userId and temporarySessionId)", async () => {
    const user = await owners.createUser();
    const session = await owners.createTemporarySession();

    await expect(
      prisma.document.create({
        data: {
          title: "Invalid dual owner",
          userId: user.id,
          temporarySessionId: session.id,
          expiresAt: futureDate(),
        },
      })
    ).rejects.toThrow();
  });

  it("rejects a Document with no owner at all", async () => {
    await expect(
      prisma.document.create({
        data: { title: "Ownerless" },
      })
    ).rejects.toThrow();
  });

  it("rejects a temporary Document with no expiry (DB constraint)", async () => {
    const session = await owners.createTemporarySession();

    await expect(
      prisma.document.create({
        data: {
          title: "Temp without expiry",
          temporarySessionId: session.id,
        },
      })
    ).rejects.toThrow();
  });

  it("rejects a temporary Document with no expiry (service guard)", async () => {
    const session = await owners.createTemporarySession();

    await expect(
      createDocument(temporaryOwner(session.id), { title: "No expiry" })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("rejects a saved Document that carries an expiry", async () => {
    const user = await owners.createUser();

    await expect(
      prisma.document.create({
        data: {
          title: "Saved with expiry",
          userId: user.id,
          expiresAt: futureDate(),
        },
      })
    ).rejects.toThrow();
  });

  it("scopes lookups to the owner and hides other owners' Documents", async () => {
    const sessionA = await owners.createTemporarySession();
    const sessionB = await owners.createTemporarySession();
    const user = await owners.createUser();

    const doc = await createDocument(temporaryOwner(sessionA.id), {
      title: "Owned by A",
      expiresAt: futureDate(),
    });

    // Correct owner sees it.
    await expect(
      getOwnedDocument(temporaryOwner(sessionA.id), doc.id)
    ).resolves.toMatchObject({ id: doc.id });

    // Another temporary session does not.
    await expect(
      getOwnedDocument(temporaryOwner(sessionB.id), doc.id)
    ).resolves.toBeNull();

    // A user does not see a session-owned Document.
    await expect(
      getOwnedDocument(userOwner(user.id), doc.id)
    ).resolves.toBeNull();

    // listOwnedDocuments is owner-scoped.
    await expect(
      listOwnedDocuments(temporaryOwner(sessionA.id))
    ).resolves.toHaveLength(1);
    await expect(
      listOwnedDocuments(temporaryOwner(sessionB.id))
    ).resolves.toHaveLength(0);
  });

  it("assertOwnedDocument throws 404 for a non-owner", async () => {
    const sessionA = await owners.createTemporarySession();
    const sessionB = await owners.createTemporarySession();

    const doc = await createDocument(temporaryOwner(sessionA.id), {
      title: "Owned by A",
      expiresAt: futureDate(),
    });

    await expect(
      assertOwnedDocument(temporaryOwner(sessionB.id), doc.id)
    ).rejects.toMatchObject({ statusCode: 404 });

    await expect(
      assertOwnedDocument(temporaryOwner(sessionA.id), doc.id)
    ).resolves.toMatchObject({ id: doc.id });
  });
});
