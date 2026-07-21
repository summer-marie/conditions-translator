/**
 * Mobile chat overflow regression test (Playwright, live dev server + live DB).
 *
 * Reproduces the bug fixed in `app/app/chat/page.tsx` (missing `min-h-0` on the chat
 * screen's inner flex column): a long assistant response must scroll inside the message
 * log instead of pushing the whole chat screen past the mobile viewport.
 *
 * Seeds a real TemporarySession + READY Document/Page/OcrResult directly via Prisma, reusing
 * the same live-DB pattern and cleanup helper as `tests/schema/helpers.ts`'s `OwnerCleanup`.
 * Reaches the real chat screen through the real UI (select document -> Start chat, which
 * calls `startChat`/`createChatSession` — no OpenAI call is involved in reaching this screen).
 * A long assistant message is then injected directly into the real message-log DOM node to
 * reproduce a long AI response's layout impact without invoking `sendMessage`, which would
 * trigger a real, billed OpenAI call.
 *
 * Skips automatically when `DATABASE_URL` isn't a real database (`isLiveDbConfigured()`),
 * matching the schema integration tests' own gating.
 *
 * @module tests/e2e/mobile-chat-overflow.pw
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { test, expect } from "@playwright/test";
import { prisma } from "../../lib/database/prisma";
import { OwnerCleanup, futureDate, isLiveDbConfigured } from "../schema/helpers";

test.describe("mobile chat: long response scroll containment", () => {
  test.skip(!isLiveDbConfigured(), "DATABASE_URL is not a real database; skipping live E2E test.");

  const owners = new OwnerCleanup();
  const DOC_TITLE = `E2E Overflow Test Doc ${Date.now()}`;

  test.afterAll(async () => {
    await owners.cleanup();
    await prisma.$disconnect();
  });

  test("long assistant message scrolls inside the message log; composer and bottom nav stay reachable", async ({
    page,
    context,
  }) => {
    const session = await owners.createTemporarySession({ expiresAt: futureDate() });
    // Pre-acknowledge the chat disclaimer (lib/session/chatDisclaimer.ts) directly, so this
    // layout-only regression test isn't gated by the unrelated disclaimer bottom sheet added
    // in chat-disclaimer.pw.ts.
    await prisma.temporarySession.update({
      where: { id: session.id },
      data: { chatDisclaimerAcknowledgedAt: new Date() },
    });

    const documentRow = await prisma.document.create({
      data: {
        title: DOC_TITLE,
        status: "READY",
        temporarySessionId: session.id,
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

    // Attach the temp-session cookie directly rather than going through the real
    // /api/session/bootstrap redirect — same cookie shape lib/session/temporary.ts sets,
    // just pointed at our pre-seeded session instead of a freshly minted one.
    await context.addCookies([
      {
        name: "tmp_session",
        value: session.token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/app/chat");

    const docCheckbox = page.getByRole("checkbox", { name: DOC_TITLE });
    await expect(docCheckbox).toBeVisible();
    await docCheckbox.check();

    await page.getByRole("button", { name: "Start chat" }).click();

    const composer = page.getByLabel("Ask a question");
    await expect(composer).toBeVisible();

    // Inject a long assistant message directly into the real message log, matching the real
    // markup an ASSISTANT bubble renders (app/app/chat/page.tsx's message-rendering block).
    // This reproduces a long AI response's layout impact without calling sendMessage, which
    // would trigger a real, billed OpenAI request.
    const longMessage = "This condition requires you to report to your supervising officer. ".repeat(
      200
    );
    const messageLog = page.getByRole("log", { name: "Chat messages" });
    await messageLog.evaluate((el, text) => {
      const bubble = document.createElement("div");
      bubble.className = "text-left";
      bubble.innerHTML = `<div class="inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap rounded-bl-md" style="background-color: var(--color-background-subtle); color: var(--color-text-body)">${text}</div>`;
      el.appendChild(bubble);
    }, longMessage);

    // 1. The whole page must not grow past the viewport. The mobile top/bottom bars are
    // fixed-position, so if the fix regresses, the chat screen's flex column grows past its
    // outer viewport-height-constrained wrapper instead of the message log scrolling
    // internally, and the document itself becomes taller than the viewport.
    const { scrollHeight, viewportHeight } = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
    }));
    expect(scrollHeight).toBeLessThanOrEqual(viewportHeight + 2);

    // 2. The message log itself must be the thing that scrolls (real overflow contained
    // inside the Card, not spilling into the page).
    const logMetrics = await messageLog.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(logMetrics.scrollHeight).toBeGreaterThan(logMetrics.clientHeight);

    // 3. The composer stays reachable without scrolling the page.
    await expect(composer).toBeInViewport();

    // 4. The bottom nav stays visible/usable and doesn't overlap the composer.
    const bottomNav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(bottomNav).toBeInViewport();
    const chatTab = bottomNav.getByRole("link", { name: /chat/i });
    await expect(chatTab).toBeInViewport();

    const composerBox = await composer.boundingBox();
    const navBox = await bottomNav.boundingBox();
    expect(composerBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    if (composerBox && navBox) {
      expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(navBox.y + 1);
    }
  });
});
