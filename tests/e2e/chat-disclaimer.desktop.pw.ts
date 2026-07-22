/**
 * Chat disclaimer regression tests — desktop compact banner (Playwright, live dev server +
 * live DB, `desktop-chrome` project only — see `playwright.config.ts`).
 *
 * Covers the desktop-scoped half of the chat-specific "not legal advice" disclaimer: the
 * compact banner (an `Alert` rendered inline in `app/app/chat/page.tsx`, `hidden md:flex`)
 * renders for an unacknowledged owner and disappears once acknowledged, a signed-in user's
 * acknowledgment persists on their account (never re-prompted), and it's independent of a
 * temporary session's own acknowledgment. The mobile bottom sheet is covered separately in
 * `chat-disclaimer.pw.ts`.
 *
 * Seeds real rows directly via Prisma (TemporarySession, User+AuthSession) reusing
 * `tests/schema/helpers.ts`'s `OwnerCleanup`. No OpenAI call is involved.
 *
 * Skips automatically when `DATABASE_URL` isn't a real database (`isLiveDbConfigured()`).
 *
 * @module tests/e2e/chat-disclaimer.desktop.pw
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { prisma } from "../../lib/database/prisma";
import { OwnerCleanup, futureDate, isLiveDbConfigured } from "../schema/helpers";

test.describe("chat disclaimer: desktop banner", () => {
  test.skip(!isLiveDbConfigured(), "DATABASE_URL is not a real database; skipping live E2E test.");

  const owners = new OwnerCleanup();

  test.afterAll(async () => {
    await owners.cleanup();
    await prisma.$disconnect();
  });

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

  async function signInAs(context: import("@playwright/test").BrowserContext, userId: string) {
    const token = randomUUID();
    await prisma.authSession.create({
      data: { userId, token, expiresAt: futureDate() },
    });
    await context.addCookies([
      {
        name: "auth_session",
        value: token,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
  }

  test("renders the compact banner for an unacknowledged owner and hides it once acknowledged", async ({
    page,
    context,
  }) => {
    const session = await owners.createTemporarySession({ expiresAt: futureDate() });
    await attachTempSessionCookie(context, session.token);

    await page.goto("/app/chat");

    const banner = page.getByRole("status").filter({ hasText: "not legal advice" });
    await expect(banner).toBeVisible();
    // The mobile-only sheet must not also render at desktop width.
    await expect(page.getByRole("dialog", { name: "Before you chat" })).toBeHidden();

    await banner.getByRole("button", { name: "Got it" }).click();
    await expect(banner).not.toBeVisible();

    // Persisted for this session: reload does not bring it back.
    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "not legal advice" })).not.toBeVisible();
  });

  test("a signed-in user with prior acknowledgment is never prompted, regardless of any temporary session", async ({
    page,
    context,
  }) => {
    const user = await owners.createUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { chatDisclaimerAcknowledgedAt: new Date() },
    });
    await signInAs(context, user.id);

    await page.goto("/app/chat");

    await expect(page.getByRole("status").filter({ hasText: "not legal advice" })).not.toBeVisible();
    await expect(page.getByRole("dialog", { name: "Before you chat" })).toBeHidden();
  });

  test("a signed-in user without prior acknowledgment is prompted once, then never again", async ({
    page,
    context,
  }) => {
    const user = await owners.createUser();
    await signInAs(context, user.id);

    await page.goto("/app/chat");

    const banner = page.getByRole("status").filter({ hasText: "not legal advice" });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Got it" }).click();
    await expect(banner).not.toBeVisible();

    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "not legal advice" })).not.toBeVisible();
  });
});
