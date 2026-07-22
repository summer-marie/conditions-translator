/**
 * Workspace upload queue regression tests (Playwright, live dev server + live DB).
 *
 * Covers the fix for `app/app/workspace/page.tsx`'s `handleFileUpload`, which previously
 * disabled the page-image file input (`disabled={isUploading}`) for the entire duration of a
 * batch's upload+OCR cycle — so a user could not select more photos while earlier ones were
 * still being OCR-processed. The fix replaces that with a client-side queue
 * (`uploadQueueRef`/`drainUploadQueue`): newly selected files enqueue immediately and the picker
 * stays enabled, while a single serial worker still sends exactly one upload/OCR request pair to
 * the server at a time (page `order` is assigned server-side from the current page count —
 * `prisma/schema.prisma`'s `@@unique([documentId, order])` — so concurrent requests could
 * otherwise collide).
 *
 * Both `POST .../pages` and `POST .../pages/[pageId]/ocr` are intercepted with `page.route()`
 * and answered with fake JSON (no real Blob storage or OpenAI Vision call), so this test costs
 * nothing beyond the seeded Prisma rows it cleans up afterward. The OCR route's first response is
 * artificially delayed to create a real "still processing" window to select more files into.
 *
 * Skips automatically when `DATABASE_URL` isn't a real database (`isLiveDbConfigured()`),
 * matching the project's other live-DB Playwright specs.
 *
 * @module tests/e2e/workspace-upload-queue.pw
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { test, expect, type Route } from "@playwright/test";
import { prisma } from "../../lib/database/prisma";
import { OwnerCleanup, futureDate, isLiveDbConfigured } from "../schema/helpers";

test.describe("workspace upload queue", () => {
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

  function fakeImageFile(name: string) {
    return { name, mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) };
  }

  test("the picker stays enabled and a second file queues while the first is still OCR-processing, with no overlapping requests", async ({
    page,
    context,
  }) => {
    const user = await owners.createUser();
    await signInAs(context, user.id);

    let nextOrder = 0;
    let pagesInFlight = 0;
    let sawPagesOverlap = false;
    let ocrCallCount = 0;
    let ocrInFlight = 0;
    let sawOcrOverlap = false;

    await page.route("**/api/documents/*/pages", async (route: Route) => {
      if (route.request().method() !== "POST") return route.continue();
      pagesInFlight++;
      if (pagesInFlight > 1) sawPagesOverlap = true;
      // Small delay so a real regression (two concurrent uploads) would have a window to overlap.
      await new Promise((resolve) => setTimeout(resolve, 200));
      const order = nextOrder++;
      const pageId = `fake-page-${order}`;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          page: {
            id: pageId,
            order,
            blobPath: `fake/${pageId}`,
            status: "PENDING",
            ocrFailureReason: null,
            createdAt: new Date().toISOString(),
          },
        }),
      });
      pagesInFlight--;
    });

    await page.route("**/api/documents/*/pages/*/ocr", async (route: Route) => {
      if (route.request().method() !== "POST") return route.continue();
      ocrInFlight++;
      if (ocrInFlight > 1) sawOcrOverlap = true;
      const callIndex = ocrCallCount++;
      // Only the first page's OCR is slow, giving the test a real "still processing" window.
      if (callIndex === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      const match = route.request().url().match(/\/pages\/([^/]+)\/ocr/);
      const pageId = match ? match[1] : "unknown";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: {
            id: pageId,
            order: callIndex,
            blobPath: `fake/${pageId}`,
            status: "OCR_COMPLETE",
            ocrFailureReason: null,
            createdAt: new Date().toISOString(),
          },
          ocr: {
            extractedText: `Fake OCR text ${callIndex}`,
            correctedText: null,
            confidence: 0.9,
            warnings: null,
          },
          blockingQualityIssue: false,
        }),
      });
      ocrInFlight--;
    });

    await page.goto("/app/workspace");

    const input = page.locator('input[type="file"][multiple]');
    await expect(page.getByRole("heading", { name: "Upload Pages" })).toBeVisible();
    await expect(input).toBeEnabled();

    await input.setInputFiles(fakeImageFile("page1.jpg"));

    // The first file's OCR call is now in flight (delayed 1.2s) — the picker must stay usable.
    await expect(page.getByText("Uploading...")).toBeVisible();
    await expect(input).toBeEnabled();

    await input.setInputFiles(fakeImageFile("page2.jpg"));

    // Both pages eventually land, in the order they were selected. Exact match: "Page 1" is
    // otherwise a substring of the (closed, but still in the DOM) "Page 1 transcript" dialog
    // heading for the same page.
    await expect(page.getByText("Page 1", { exact: true })).toBeVisible();
    await expect(page.getByText("Page 2", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Uploading/)).not.toBeVisible();

    expect(sawPagesOverlap).toBe(false);
    expect(sawOcrOverlap).toBe(false);
    expect(ocrCallCount).toBe(2);
  });

  test("the 10-page cap counts files already queued but not yet uploaded, not just already-saved pages", async ({
    page,
    context,
  }) => {
    // 8 existing pages, so there's genuine room to test the boundary (the upload box hides
    // itself entirely once pageCount actually reaches 10 — pre-existing, unrelated behavior —
    // so the cap check can only be meaningfully exercised below that ceiling).
    const user = await owners.createUser();
    const documentRow = await prisma.document.create({
      data: {
        title: `E2E Upload Queue Cap Doc ${Date.now()}`,
        status: "IN_PROGRESS",
        userId: user.id,
        expiresAt: null,
      },
    });
    for (let order = 0; order < 8; order++) {
      await prisma.page.create({ data: { documentId: documentRow.id, order, status: "ACCEPTED" } });
    }
    await signInAs(context, user.id);

    let nextOrder = 8;
    let pagesInFlight = 0;
    let sawPagesOverlap = false;
    let pagesCallCount = 0;
    await page.route("**/api/documents/*/pages", async (route: Route) => {
      if (route.request().method() !== "POST") return route.continue();
      pagesInFlight++;
      if (pagesInFlight > 1) sawPagesOverlap = true;
      pagesCallCount++;
      // Delayed so the first queued file (of the two selected together below) is still
      // mid-upload — not yet reflected in pageCount, and not yet flipped to `uploaded` in
      // uploadQueueRef — when the third file's cap check runs.
      await new Promise((resolve) => setTimeout(resolve, 800));
      const order = nextOrder++;
      const pageId = `fake-page-${order}`;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          page: {
            id: pageId,
            order,
            blobPath: `fake/${pageId}`,
            status: "PENDING",
            ocrFailureReason: null,
            createdAt: new Date().toISOString(),
          },
        }),
      });
      pagesInFlight--;
    });
    await page.route("**/api/documents/*/pages/*/ocr", async (route: Route) => {
      if (route.request().method() !== "POST") return route.continue();
      const match = route.request().url().match(/\/pages\/([^/]+)\/ocr/);
      const pageId = match ? match[1] : "unknown";
      // The response's `order` gets merged straight into the client's page object
      // (setPages(prev => prev.map(...{...p, ...data.page}))), so it must echo back the same
      // order assigned above — pageId embeds it (`fake-page-<order>`), so parse it out rather
      // than hardcoding a value that would silently overwrite the real order client-side.
      const order = Number(pageId.replace("fake-page-", ""));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          page: {
            id: pageId,
            order,
            blobPath: `fake/${pageId}`,
            status: "OCR_COMPLETE",
            ocrFailureReason: null,
            createdAt: new Date().toISOString(),
          },
          ocr: { extractedText: "Fake OCR text", correctedText: null, confidence: 0.9, warnings: null },
          blockingQualityIssue: false,
        }),
      });
    });

    // Registered up front so there's no timing gap in which a dialog could fire unobserved.
    let dialogMessage: string | null = null;
    page.on("dialog", (dialog) => {
      dialogMessage = dialog.message();
      void dialog.accept();
    });

    await page.goto("/app/workspace");

    const input = page.locator('input[type="file"][multiple]');
    await expect(page.getByRole("heading", { name: "Upload Pages" })).toBeVisible();
    await expect(page.getByText("8/10 pages")).toBeVisible();

    // Selects two files at once: 8 existing + 0 queued + 2 new = 10, exactly at the cap — allowed.
    // Both enqueue; the drain worker starts uploading the first immediately (pages-POST delayed
    // 800ms, so it's still in flight — not yet "uploaded" — for a moment).
    await input.setInputFiles([fakeImageFile("page9.jpg"), fakeImageFile("page10.jpg")]);
    await expect(page.getByText("Uploading...")).toBeVisible();

    // A third file right away: pageCount is still 8 (the first of the two hasn't finished its
    // POST yet), but both queued files count toward the cap since neither is "uploaded" yet —
    // 8 + 2 queued + 1 new = 11 > 10, so this must be rejected. Without the not-yet-uploaded
    // queue count, only pageCount (8) would be checked and this would be wrongly accepted.
    await input.setInputFiles(fakeImageFile("page11.jpg"));

    await expect.poll(() => dialogMessage).toContain("You can upload 0 more page(s).");

    // The two legitimately-queued files still both land, in order, once the queue drains — the
    // rejection above didn't disturb them.
    await expect(page.getByText("Page 9", { exact: true })).toBeVisible();
    await expect(page.getByText("Page 10", { exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Page 11", { exact: true })).not.toBeVisible();
    await expect(page.getByText(/Uploading/)).not.toBeVisible();

    expect(sawPagesOverlap).toBe(false);
    expect(pagesCallCount).toBe(2);
  });
});
