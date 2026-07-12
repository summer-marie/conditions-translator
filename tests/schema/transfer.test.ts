// Integration tests for atomic ownership transfer against a live database
// (lib/auth/transfer.ts, docs/05_Account_Creation_and_Temporary_Access.md, Phase 7).
//
// These exercise the real schema + CHECK constraints: a transferred Document must end up saved
// (userId set, temporarySessionId + expiresAt null) with all its children intact, its ChatSession
// must move but keep expiring, cross-user access must be denied, and re-running must not duplicate.

import { afterAll, afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/database/prisma";
import { transferWorkspaceToUser } from "@/lib/auth/transfer";
import { getOwnedDocument, userOwner } from "@/lib/permissions/ownership";
import { OwnerCleanup, futureDate, isLiveDbConfigured } from "./helpers";

describe.skipIf(!isLiveDbConfigured())("Ownership transfer", () => {
  const owners = new OwnerCleanup();

  afterEach(async () => {
    await owners.cleanup();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  // Builds a full temporary workspace: a READY Document with an accepted page + OCR + a generated
  // section/source, plus a ChatSession referencing it with one message + source.
  async function buildTempWorkspace(temporarySessionId: string) {
    const document = await prisma.document.create({
      data: {
        title: "Conditions of Probation",
        status: "READY",
        temporarySessionId,
        expiresAt: futureDate(),
      },
    });
    const page = await prisma.page.create({
      data: { documentId: document.id, order: 0, status: "ACCEPTED" },
    });
    await prisma.ocrResult.create({
      data: { pageId: page.id, extractedText: "Report to your officer monthly." },
    });
    const section = await prisma.section.create({
      data: { documentId: document.id, heading: "Reporting", body: "You report monthly.", order: 0 },
    });
    await prisma.sectionSource.create({
      data: { sectionId: section.id, pageId: page.id },
    });
    const chatSession = await prisma.chatSession.create({
      data: { temporarySessionId, expiresAt: futureDate() },
    });
    await prisma.chatSessionDocument.create({
      data: { chatSessionId: chatSession.id, documentId: document.id },
    });
    const message = await prisma.chatMessage.create({
      data: { chatSessionId: chatSession.id, role: "USER", content: "Do I report monthly?" },
    });
    await prisma.chatMessageSource.create({
      data: { chatMessageId: message.id, documentId: document.id, pageId: page.id },
    });

    return { document, page, section, chatSession, message };
  }

  it("saves the Document to the user: sets userId, clears temp owner + expiry, keeps READY status", async () => {
    const session = await owners.createTemporarySession();
    const user = await owners.createUser();
    const { document } = await buildTempWorkspace(session.id);

    const result = await transferWorkspaceToUser(session.id, user.id);
    expect(result.documentCount).toBe(1);

    const moved = await prisma.document.findUnique({ where: { id: document.id } });
    expect(moved?.userId).toBe(user.id);
    expect(moved?.temporarySessionId).toBeNull();
    expect(moved?.expiresAt).toBeNull();
    expect(moved?.status).toBe("READY"); // READY gating for AI is preserved
  });

  it("preserves all child records (pages, OCR, sections, sources) through the transfer", async () => {
    const session = await owners.createTemporarySession();
    const user = await owners.createUser();
    const { document, page, section } = await buildTempWorkspace(session.id);

    await transferWorkspaceToUser(session.id, user.id);

    const pages = await prisma.page.findMany({ where: { documentId: document.id }, include: { ocr: true } });
    expect(pages).toHaveLength(1);
    expect(pages[0].id).toBe(page.id);
    expect(pages[0].status).toBe("ACCEPTED");
    expect(pages[0].ocr?.extractedText).toBe("Report to your officer monthly.");

    const sources = await prisma.sectionSource.findMany({ where: { sectionId: section.id } });
    expect(sources).toHaveLength(1);
    expect(sources[0].pageId).toBe(page.id);
  });

  it("moves the ChatSession to the user but keeps its expiry (chat stays temporary after saving)", async () => {
    const session = await owners.createTemporarySession();
    const user = await owners.createUser();
    const { chatSession, message } = await buildTempWorkspace(session.id);

    const result = await transferWorkspaceToUser(session.id, user.id);
    expect(result.chatSessionCount).toBe(1);

    const movedChat = await prisma.chatSession.findUnique({ where: { id: chatSession.id } });
    expect(movedChat?.userId).toBe(user.id);
    expect(movedChat?.temporarySessionId).toBeNull();
    expect(movedChat?.expiresAt).toBeInstanceOf(Date); // still expires — not permanent history

    // The active conversation survives the transfer (chat continuity).
    const messages = await prisma.chatMessage.findMany({ where: { chatSessionId: chatSession.id } });
    expect(messages.map((m) => m.id)).toContain(message.id);
  });

  it("leaves the saved Document unable to violate the owner/expiry CHECK constraint", async () => {
    const session = await owners.createTemporarySession();
    const user = await owners.createUser();
    const { document } = await buildTempWorkspace(session.id);
    await transferWorkspaceToUser(session.id, user.id);

    // A saved (user-owned) Document must never carry an expiry — the DB constraint enforces it.
    await expect(
      prisma.document.update({
        where: { id: document.id },
        data: { expiresAt: futureDate() },
      })
    ).rejects.toThrow();
  });

  it("denies cross-user access to the saved Document", async () => {
    const session = await owners.createTemporarySession();
    const userA = await owners.createUser();
    const userB = await owners.createUser();
    const { document } = await buildTempWorkspace(session.id);
    await transferWorkspaceToUser(session.id, userA.id);

    expect(await getOwnedDocument(userOwner(userA.id), document.id)).not.toBeNull();
    expect(await getOwnedDocument(userOwner(userB.id), document.id)).toBeNull();
  });

  it("is idempotent: a second transfer moves nothing and creates no duplicate Document", async () => {
    const session = await owners.createTemporarySession();
    const user = await owners.createUser();
    await buildTempWorkspace(session.id);

    const first = await transferWorkspaceToUser(session.id, user.id);
    const second = await transferWorkspaceToUser(session.id, user.id);

    expect(first.documentCount).toBe(1);
    expect(second.documentCount).toBe(0); // nothing left under the temporary session
    expect(await prisma.document.count({ where: { userId: user.id } })).toBe(1); // no duplicate
  });
});
