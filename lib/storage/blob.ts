// Thin wrapper around @vercel/blob for the private page-image store.
//
// The store is private (docs/03_OCR_Specifications.md, env.example): OIDC auth is used
// automatically on Vercel infrastructure, or via BLOB_STORE_ID + VERCEL_OIDC_TOKEN pulled
// locally with `vercel env pull .env.local`. No static BLOB_READ_WRITE_TOKEN is used.

import { put, get, del } from "@vercel/blob";
import { AppError } from "@/lib/errors";

const ACCESS = "private" as const;

export interface StoredPageImage {
  pathname: string;
  url: string;
  contentType: string;
}

// Uploads (or overwrites, for re-upload) a page image at a stable pathname.
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
  });

  return { pathname: blob.pathname, url: blob.url, contentType: blob.contentType };
}

// Reads a page image's bytes back from private storage (used to send to OpenAI Vision and
// to stream previews to the owner). Always bypasses the CDN cache since re-uploads overwrite
// the same pathname and a stale read would show the previous image.
export async function readPageImage(
  pathname: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const result = await get(pathname, { access: ACCESS, useCache: false });

  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new AppError("Stored page image was not found.", 404, "BLOB_NOT_FOUND");
  }

  const arrayBuffer = await new Response(result.stream).arrayBuffer();
  return { buffer: Buffer.from(arrayBuffer), contentType: result.blob.contentType };
}

// Deletes a page image. Never throws if the object no longer exists.
export async function deletePageImage(pathname: string): Promise<void> {
  await del(pathname);
}
