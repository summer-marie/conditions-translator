/**
 * Signed-in "start/add new document" regression tests (Playwright, live dev server + live DB).
 *
 * Reproduces and covers the fix for `lib/actions/document.ts`'s `createTemporaryDocument`,
 * which previously resolved ownership only via a temporary session — so a signed-in user could
 * never create a document. Two scenarios:
 *
 * 1. A signed-in user with zero documents must land in a usable workspace (an intake document
 *    auto-created), not the dead-end "Unable to load workspace" state.
 * 2. A signed-in user with an existing finished (READY) document and no IN_PROGRESS document
 *    must be able to start a new one — the "Start a New Document" upload control must be
 *    enabled, and the old "isn't available for signed-in accounts yet" message must not appear.
 *
 * Seeds real rows directly via Prisma (User+AuthSession), reusing `tests/schema/helpers.ts`'s
 * `OwnerCleanup`, mirroring the pattern in `chat-disclaimer.desktop.pw.ts`.
 *
 * Skips automatically when `DATABASE_URL` isn't a real database (`isLiveDbConfigured()`).
 *
 * @module tests/e2e/signed-in-new-document.pw
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { prisma } from "../../lib/database/prisma";
import { OwnerCleanup, futureDate, isLiveDbConfigured } from "../schema/helpers";

test.describe("signed-in workspace: starting a new document", () => {
  test.skip(!isLiveDbConfigured(), "DATABASE_URL is not a real database; skipping live E2E test.");

  const owners = new OwnerCleanup();

  test.afterAll(async () => {
    await owners.cleanup();
    await prisma.$disconnect();
  });

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

  test("a signed-in user with zero documents lands in a usable workspace instead of the dead-end state", async ({
    page,
    context,
  }) => {
    const user = await owners.createUser();
    await signInAs(context, user.id);

    await page.goto("/app/workspace");

    // The old dead-end state must never appear.
    await expect(page.getByText("Unable to load workspace")).not.toBeVisible();

    // An intake document was auto-created, so the "add a page" heading renders.
    await expect(page.getByRole("heading", { name: "Upload Pages" })).toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeEnabled();
  });

  test("a signed-in user with an existing finished document can start another new document", async ({
    page,
    context,
  }) => {
    const user = await owners.createUser();
    await prisma.document.create({
      data: {
        title: `E2E Existing Finished Doc ${Date.now()}`,
        status: "READY",
        userId: user.id,
        expiresAt: null,
      },
    });
    await signInAs(context, user.id);

    await page.goto("/app/workspace");

    // No IN_PROGRESS document exists, so the box offers to start a new one — and, unlike
    // before the fix, it must be enabled rather than disabled with an explanatory message.
    await expect(page.getByRole("heading", { name: "Start a New Document" })).toBeVisible();
    await expect(
      page.getByText("Starting a new document isn't available for signed-in accounts yet.")
    ).not.toBeVisible();
    await expect(page.locator('input[type="file"]')).toBeEnabled();
  });
});
