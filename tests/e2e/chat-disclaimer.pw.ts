/**
 * Chat disclaimer regression tests — mobile bottom sheet (Playwright, live dev server + live DB).
 *
 * Covers the mobile-scoped half of the chat-specific "not legal advice" disclaimer
 * (`components/chat/ChatDisclaimerSheet.tsx`, `lib/session/chatDisclaimer.ts`): the sheet
 * appears for an unacknowledged temporary session, traps focus while open, blocks
 * interaction with the chat screen underneath until acknowledged, persists acknowledgment
 * for that session, and re-prompts a genuinely new temporary session independently. The
 * desktop banner is covered separately in `chat-disclaimer.desktop.pw.ts` (see
 * `playwright.config.ts` for why these are split by project).
 *
 * Seeds real TemporarySession(+Document/Page/OcrResult) rows directly via Prisma, reusing
 * the same live-DB pattern as `tests/e2e/mobile-chat-overflow.pw.ts` and
 * `tests/schema/helpers.ts`. No OpenAI call is involved — only `startChat`/`createChatSession`
 * is exercised, never `sendMessage`.
 *
 * Skips automatically when `DATABASE_URL` isn't a real database (`isLiveDbConfigured()`).
 *
 * @module tests/e2e/chat-disclaimer.pw
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { test, expect } from "@playwright/test";
import { prisma } from "../../lib/database/prisma";
import { OwnerCleanup, futureDate, isLiveDbConfigured } from "../schema/helpers";

test.describe("chat disclaimer: mobile bottom sheet", () => {
  test.skip(!isLiveDbConfigured(), "DATABASE_URL is not a real database; skipping live E2E test.");

  const owners = new OwnerCleanup();

  test.afterAll(async () => {
    await owners.cleanup();
    await prisma.$disconnect();
  });

  async function seedReadyDocument(temporarySessionId: string, title: string) {
    const documentRow = await prisma.document.create({
      data: {
        title,
        status: "READY",
        temporarySessionId,
        expiresAt: futureDate(),
      },
    });
    const pageRow = await prisma.page.create({
      data: { documentId: documentRow.id, order: 0, status: "ACCEPTED" },
    });
    await prisma.ocrResult.create({
      data: {
        pageId: pageRow.id,
        extractedText: "You must report to your probation officer monthly.",
      },
    });
    return documentRow;
  }

  async function attachTempSessionCookie(context: import("@playwright/test").BrowserContext, token: string) {
    await context.addCookies([
      {
        name: "tmp_session",
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  }

  test("appears for a fresh temporary session, traps focus, and blocks the screen underneath until acknowledged", async ({
    page,
    context,
  }) => {
    const session = await owners.createTemporarySession({ expiresAt: futureDate() });
    const doc = await seedReadyDocument(session.id, `E2E Disclaimer Doc ${Date.now()}`);
    void doc;

    await attachTempSessionCookie(context, session.token);
    await page.goto("/app/chat");

    const sheet = page.getByRole("dialog", { name: "Before you chat" });
    await expect(sheet).toBeVisible();

    const gotItButton = sheet.getByRole("button", { name: "Got it" });
    // Focus moves into the sheet on open (useFocusTrap).
    await expect(gotItButton).toBeFocused();

    // Focus stays trapped: Tab/Shift+Tab must not escape the single-control sheet.
    await page.keyboard.press("Tab");
    await expect(gotItButton).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(gotItButton).toBeFocused();

    // The chat screen underneath is not interactable while the sheet is open — the sheet's
    // backdrop intercepts pointer events, so a real click on the document checkbox must fail.
    const docCheckbox = page.getByRole("checkbox", { name: doc.title });
    let interceptedClickError: unknown = null;
    try {
      await docCheckbox.click({ timeout: 2000 });
    } catch (err) {
      interceptedClickError = err;
    }
    expect(interceptedClickError).not.toBeNull();

    // Acknowledge — the sheet closes and the screen becomes usable.
    await gotItButton.click();
    await expect(sheet).not.toBeVisible();

    await docCheckbox.check();
    await expect(page.getByRole("button", { name: "Start chat" })).toBeEnabled();
  });

  test("does not reappear for the same temporary session after acknowledgment, but does for a genuinely new one", async ({
    page,
    context,
  }) => {
    const sessionA = await owners.createTemporarySession({ expiresAt: futureDate() });
    await attachTempSessionCookie(context, sessionA.token);

    await page.goto("/app/chat");
    const sheet = page.getByRole("dialog", { name: "Before you chat" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Got it" }).click();
    await expect(sheet).not.toBeVisible();

    // Same session, reloaded: already acknowledged, no reappearance.
    await page.reload();
    await expect(sheet).not.toBeVisible();

    // A genuinely new temporary session (fresh row, never acknowledged) — simulated by
    // overwriting the cookie, exactly like a new visitor with no prior acknowledgment.
    const sessionB = await owners.createTemporarySession({ expiresAt: futureDate() });
    await attachTempSessionCookie(context, sessionB.token);
    await page.reload();

    await expect(sheet).toBeVisible();
  });
});
