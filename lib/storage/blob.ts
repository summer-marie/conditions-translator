/**
 * Thin wrapper around `@vercel/blob` for the private page-image store.
 *
 * The store is private (`docs/03_OCR_Specifications.md`, `env.example`). On real Vercel
 * infrastructure, OIDC auth (`BLOB_STORE_ID` + `VERCEL_OIDC_TOKEN`) is used automatically.
 * Local development can't use OIDC for the "development" environment, so an explicit
 * `BLOB_READ_WRITE_TOKEN` is passed instead when present. `@vercel/blob` checks an explicit
 * `token` option before ever consulting OIDC (verified against the installed SDK), so
 * supplying it only when the env var is set leaves production/preview — where it is never
 * set — on the unchanged OIDC path.
 *
 * @module lib/storage/blob
 */

import { put, get, del } from "@vercel/blob";
import { AppError } from "@/lib/errors";

/** All page images are stored with private access. */
const ACCESS = "private" as const;

/**
 * Returns the explicit blob token used only in local development.
 *
 * @returns `BLOB_READ_WRITE_TOKEN` when set (local dev), otherwise `undefined` so the SDK
 *   falls through to OIDC auth on real Vercel infrastructure.
 */
function explicitToken(): string | undefined {
  return process.env.BLOB_READ_WRITE_TOKEN;
}

/** Metadata returned after a page image is stored. */
export interface StoredPageImage {
  /** Stable pathname the image is stored under. */
  pathname: string;
  /** Fully-qualified blob URL. */
  url: string;
  /** Stored content type. */
  contentType: string;
}

/**
 * Uploads (or overwrites, on re-upload) a page image at a stable pathname.
 *
 * `addRandomSuffix` is disabled and `allowOverwrite` enabled so re-uploading a page reuses
 * the same pathname, keeping the DB `blobPath` reference valid.
 *
 * @param pathname - Stable storage pathname for the page image.
 * @param body - Raw image bytes.
 * @param contentType - The image's MIME type.
 * @returns Metadata describing the stored object.
 */
export async function uploadPageImage(
  pathname: string,
  body: Buffer,
  contentType: string
): Promise<StoredPageImage> {
  const blob = await put(pathname, body, {
    access: ACCESS,
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: explicitToken(),
  });

  return { pathname: blob.pathname, url: blob.url, contentType: blob.contentType };
}

/**
 * Reads a page image's bytes back from private storage.
 *
 * Used to send the image to OpenAI Vision and to stream previews to the owner. The CDN
 * cache is bypassed (`useCache: false`) because re-uploads overwrite the same pathname —
 * a cached read could otherwise return the previous image.
 *
 * @param pathname - The stored pathname to read.
 * @returns The image `buffer` and its `contentType`.
 * @throws {AppError} `BLOB_NOT_FOUND` (404) when the object is missing or unreadable.
 */
export async function readPageImage(
  pathname: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const result = await get(pathname, {
    access: ACCESS,
    useCache: false,
    token: explicitToken(),
  });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new AppError("Stored page image was not found.", 404, "BLOB_NOT_FOUND");
  }

  const arrayBuffer = await new Response(result.stream).arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType: result.blob.contentType };
}

/**
 * Deletes a page image from private storage.
 *
 * Intentionally a no-op (never throws) when the object no longer exists, which makes
 * two-step Blob-then-DB deletion flows safely retryable.
 *
 * @param pathname - The stored pathname to delete.
 */
export async function deletePageImage(pathname: string): Promise<void> {
  await del(pathname, { token: explicitToken() });
}
