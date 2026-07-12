// Server-side page image validation (docs/03_OCR_Specifications.md, Phase 4 §4.1).
//
// The declared Content-Type/extension is never trusted on its own — the actual file header
// (magic bytes) is sniffed so a renamed file can't slip past the allowlist.

import { AppError } from "@/lib/errors";
import { ALLOWED_IMAGE_MIME_TYPES, MAX_PAGE_SIZE_BYTES } from "@/lib/constants";

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export interface ValidatedImage {
  mimeType: AllowedImageMimeType;
  // EXIF orientation tag (1-8), when present and readable on a JPEG. Non-1 values mean the
  // stored pixels are rotated/flipped relative to how the image should be displayed; the OCR
  // client uses this as a hint rather than physically re-encoding the image (no image-processing
  // dependency in MVP scope).
  exifOrientation: number | null;
}

// Sniffs the actual image format from the file's magic bytes, ignoring the declared MIME type.
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

// Best-effort read of the EXIF Orientation tag (0x0112) from a JPEG's APP1 segment.
// Returns null on anything malformed or absent — this is a hint, never a hard requirement.
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

      // SOS marker means image data starts; no more APPn segments to check.
      if (marker === 0xda) return null;
      offset += 2 + segmentLength;
    }
    return null;
  } catch {
    return null;
  }
}

// Validates a page image upload. Throws AppError with a client-safe message/code on failure.
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
