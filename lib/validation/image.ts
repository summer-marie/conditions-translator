/**
 * Server-side page-image validation (`docs/03_OCR_Specifications.md`, Phase 4 §4.1).
 *
 * The declared Content-Type/extension is never trusted on its own — the actual file header
 * (magic bytes) is sniffed so a renamed or spoofed file can't slip past the allowlist.
 *
 * @module lib/validation/image
 */

import { AppError } from "@/lib/errors";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_PAGE_SIZE_BYTES } from "@/lib/constants";

/** One of the MIME types permitted for page uploads. */
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Result of a successful {@link validateImageUpload}. */
export interface ValidatedImage {
  /** The format actually detected from the file's magic bytes. */
  mimeType: AllowedImageMimeType;
  /**
   * EXIF Orientation tag (1–8) when present and readable on a JPEG. A non-1 value means
   * the stored pixels are rotated/flipped relative to intended display; the OCR client
   * uses this as a hint rather than physically re-encoding the image (no image-processing
   * dependency is in MVP scope). `null` when absent or unreadable.
   */
  exifOrientation: number | null;
}

/**
 * Detects the true image format from a file's magic bytes, ignoring the declared MIME type.
 *
 * @param buffer - The raw file bytes.
 * @returns The detected {@link AllowedImageMimeType}, or `null` for anything not on the allowlist.
 */
function sniffImageType(buffer: Buffer): AllowedImageMimeType | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Best-effort read of the EXIF Orientation tag (0x0112) from a JPEG's APP1 segment.
 *
 * Walks the JPEG marker segments to find APP1, parses the embedded TIFF header (honoring
 * its byte order), and scans IFD0 for the Orientation entry. Because orientation is only
 * a display hint, anything malformed or absent yields `null` rather than an error.
 *
 * @param buffer - The raw JPEG bytes.
 * @returns The orientation value (1–8), or `null` when not found or unparseable.
 */
function readJpegOrientation(buffer: Buffer): number | null {
  try {
    let offset = 2; // skip the SOI marker (FF D8)
    while (offset + 4 <= buffer.length) {
      if (buffer[offset] !== 0xff) return null;
      const marker = buffer[offset + 1];
      const segmentLength = buffer.readUInt16BE(offset + 2);

      if (marker === 0xe1) {
        const app1Start = offset + 4;
        if (buffer.toString("ascii", app1Start, app1Start + 6) !== "Exif\0\0") return null;

        const tiffStart = app1Start + 6;
        const byteOrder = buffer.toString("ascii", tiffStart, tiffStart + 2);
        const little = byteOrder === "II";
        const readU16 = (o: number) => (little ? buffer.readUInt16LE(o) : buffer.readUInt16BE(o));
        const readU32 = (o: number) => (little ? buffer.readUInt32LE(o) : buffer.readUInt32BE(o));

        const ifdOffset = tiffStart + readU32(tiffStart + 4);
        const entryCount = readU16(ifdOffset);

        for (let i = 0; i < entryCount; i++) {
          const entryOffset = ifdOffset + 2 + i * 12;
          const tag = readU16(entryOffset);
          if (tag === 0x0112) {
            return readU16(entryOffset + 8);
          }
        }
        return null;
      }

      // A Start-of-Scan marker means pixel data begins — no APPn segments remain to inspect.
      if (marker === 0xda) return null;
      offset += 2 + segmentLength;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Validates a page-image upload for size and true format, and extracts orientation.
 *
 * Rejects empty files, oversized files, and anything whose sniffed format (or declared
 * MIME type) is outside {@link ALLOWED_IMAGE_MIME_TYPES}. On success, returns the detected
 * type plus any EXIF orientation hint.
 *
 * @param buffer - The raw uploaded bytes.
 * @param declaredMimeType - The client-declared MIME type (cross-checked, never trusted alone).
 * @returns The {@link ValidatedImage} describing the accepted upload.
 * @throws {AppError} `EMPTY_FILE` (400) when the buffer is empty.
 * @throws {AppError} `FILE_TOO_LARGE` (400) when it exceeds {@link MAX_PAGE_SIZE_BYTES}.
 * @throws {AppError} `INVALID_FILE_TYPE` (400) when the sniffed or declared type is not allowed.
 */
export function validateImageUpload(buffer: Buffer, declaredMimeType: string): ValidatedImage {
  if (buffer.length === 0) {
    throw new AppError("The uploaded file is empty.", 400, "EMPTY_FILE");
  }

  if (buffer.length > MAX_PAGE_SIZE_BYTES) {
    const maxMb = Math.round(MAX_PAGE_SIZE_BYTES / (1024 * 1024));
    throw new AppError(`File too large. Maximum size is ${maxMb}MB.`, 400, "FILE_TOO_LARGE");
  }

  const sniffedType = sniffImageType(buffer);
  if (!sniffedType) {
    throw new AppError(
      "Unsupported file. Only JPEG, PNG, and WEBP images are allowed.",
      400,
      "INVALID_FILE_TYPE"
    );
  }

  if (declaredMimeType && !ALLOWED_IMAGE_MIME_TYPES.includes(declaredMimeType as AllowedImageMimeType)) {
    throw new AppError(
      "Unsupported file. Only JPEG, PNG, and WEBP images are allowed.",
      400,
      "INVALID_FILE_TYPE"
    );
  }

  const exifOrientation = sniffedType === "image/jpeg" ? readJpegOrientation(buffer) : null;

  return { mimeType: sniffedType, exifOrientation };
}
