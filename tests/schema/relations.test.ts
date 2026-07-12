import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/database/prisma";
import { createDocument, temporaryOwner } from "@/lib/permissions/ownership";
import { OwnerCleanup, futureDate, isLiveDbConfigured } from "./helpers";

describe.skipIf(!isLiveDbConfigured())("Page relationship and cascade behavior", () => {
  const owners = new OwnerCleanup();

  afterEach(async () => {
    await owners.cleanup();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function newTempDocument() {
    const session = await owners.createTemporarySession();
    const document = await createDocument(temporaryOwner(session.id), {
      title: "Doc with pages",
      expiresAt: futureDate(),
    });
    return { session, document };
  }

  it("attaches a Page to exactly one Document", async () => {
    const { document } = await newTempDocument();
    const page = await prisma.page.create({
      data: { documentId: document.id, order: 0 },
    });

    expect(page.documentId).toBe(document.id);
    expect(page.status).toBe("PENDING");
  });

  it("rejects a Page pointing at a non-existent Document (foreign key)", async () => {
    await expect(
      prisma.page.create({
        data: { documentId: `missing-${randomUUID()}`, order: 0 },
      })
    ).rejects.toThrow();
  });

  it("enforces unique page order within a Document", async () => {
    const { document } = await newTempDocument();
    await prisma.page.create({ data: { documentId: document.id, order: 0 } });

    await expect(
      prisma.page.create({ data: { documentId: document.id, order: 0 } })
    ).rejects.toThrow();
  });

  it("cascades deletion of a Document to its pages, OCR, sections, and sources", async () => {
    const { document } = await newTempDocument();

    const page = await prisma.page.create({
      data: { documentId: document.id, order: 0 },
    });
    await prisma.ocrResult.create({
      data: { pageId: page.id, extractedText: "extracted source text" },
    });
    const section = await prisma.section.create({
      data: { documentId: document.id, heading: "Overview", body: "plain language", order: 0 },
    });
    await prisma.sectionSource.create({
      data: { sectionId: section.id, pageId: page.id },
    });

    await prisma.document.delete({ where: { id: document.id } });

    await expect(
      prisma.page.count({ where: { documentId: document.id } })
    ).resolves.toBe(0);
    await expect(
      prisma.ocrResult.count({ where: { pageId: page.id } })
    ).resolves.toBe(0);
    await expect(
      prisma.section.count({ where: { documentId: document.id } })
    ).resolves.toBe(0);
    await expect(
      prisma.sectionSource.count({ where: { sectionId: section.id } })
    ).resolves.toBe(0);
  });

  it("cascades deletion of a TemporarySession to its Documents", async () => {
    const session = await owners.createTemporarySession();
    const document = await createDocument(temporaryOwner(session.id), {
      title: "Session-owned",
      expiresAt: futureDate(),
    });

    await prisma.temporarySession.delete({ where: { id: session.id } });

    await expect(
      prisma.document.count({ where: { id: document.id } })
    ).resolves.toBe(0);
  });

  it("cascades deletion of a Page to its OCR result", async () => {
    const { document } = await newTempDocument();
    const page = await prisma.page.create({
      data: { documentId: document.id, order: 0 },
    });
    await prisma.ocrResult.create({
      data: { pageId: page.id, extractedText: "text" },
    });

    await prisma.page.delete({ where: { id: page.id } });

    await expect(
      prisma.ocrResult.count({ where: { pageId: page.id } })
    ).resolves.toBe(0);
  });
});
