// Unit tests for server-side page image validation (magic-byte sniffing, size limit,
// EXIF orientation hint). docs/03_OCR_Specifications.md §4.1.

import { describe, it, expect } from "vitest";
import { validateImageUpload } from "@/lib/validation/image";
import { MAX_PAGE_SIZE_BYTES } from "@/lib/constants";

const JPEG_HEADER = [0xff, 0xd8, 0xff, 0x00];
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP_HEADER = [
  0x52, 0x49, 0x46, 0x46, // RIFF
  0x00, 0x00, 0x00, 0x00, // size (unused by sniff)
  0x57, 0x45, 0x42, 0x50, // WEBP
];

describe("validateImageUpload", () => {
  it("accepts a clean JPEG file", () => {
    const buffer = Buffer.from(JPEG_HEADER);
    const result = validateImageUpload(buffer, "image/jpeg");
    expect(result.mimeType).toBe("image/jpeg");
  });

  it("accepts a clean PNG file", () => {
    const buffer = Buffer.from(PNG_HEADER);
    const result = validateImageUpload(buffer, "image/png");
    expect(result.mimeType).toBe("image/png");
  });

  it("accepts a clean WEBP file", () => {
    const buffer = Buffer.from(WEBP_HEADER);
    const result = validateImageUpload(buffer, "image/webp");
    expect(result.mimeType).toBe("image/webp");
  });

  it("rejects a file whose header does not match any supported image format", () => {
    const buffer = Buffer.from("this is not an image");
    expect(() => validateImageUpload(buffer, "application/zip")).toThrowError(
      /Unsupported file/
    );
  });

  it("rejects a renamed file whose declared MIME type disagrees with a valid sniffed header", () => {
    // Real PNG bytes, but declared as a disallowed type — the declared type is untrusted,
    // so this should still be rejected for internal inconsistency.
    const buffer = Buffer.from(PNG_HEADER);
    expect(() => validateImageUpload(buffer, "application/pdf")).toThrowError(
      /Unsupported file/
    );
  });

  it("rejects an empty file", () => {
    expect(() => validateImageUpload(Buffer.alloc(0), "image/jpeg")).toThrowError(
      /empty/
    );
  });

  it("rejects a file larger than MAX_PAGE_SIZE_BYTES", () => {
    const buffer = Buffer.concat([
      Buffer.from(JPEG_HEADER),
      Buffer.alloc(MAX_PAGE_SIZE_BYTES),
    ]);
    expect(() => validateImageUpload(buffer, "image/jpeg")).toThrowError(
      /too large/
    );
  });

  it("reads a non-1 EXIF orientation tag from a JPEG when present", () => {
    // Minimal JPEG: SOI, APP1 (Exif header + tiny TIFF IFD with one Orientation entry), EOI.
    const tiff = Buffer.alloc(8 + 2 + 12 + 4);
    tiff.write("II", 0, "ascii"); // little-endian
    tiff.writeUInt16LE(42, 2); // TIFF magic
    tiff.writeUInt32LE(8, 4); // offset to first IFD
    tiff.writeUInt16LE(1, 8); // 1 IFD entry
    tiff.writeUInt16LE(0x0112, 10); // tag: Orientation
    tiff.writeUInt16LE(3, 12); // type: SHORT
    tiff.writeUInt32LE(1, 14); // count
    tiff.writeUInt16LE(6, 18); // value: orientation 6 (rotated 90 CW)

    const exifSegment = Buffer.concat([Buffer.from("Exif\0\0", "ascii"), tiff]);
    const app1Length = exifSegment.length + 2;
    const app1Header = Buffer.from([0xff, 0xe1, (app1Length >> 8) & 0xff, app1Length & 0xff]);

    const jpeg = Buffer.concat([
      Buffer.from([0xff, 0xd8]), // SOI
      app1Header,
      exifSegment,
      Buffer.from([0xff, 0xd9]), // EOI
    ]);

    const result = validateImageUpload(jpeg, "image/jpeg");
    expect(result.exifOrientation).toBe(6);
  });

  it("returns null EXIF orientation for a JPEG with no APP1/Exif segment", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const result = validateImageUpload(jpeg, "image/jpeg");
    expect(result.exifOrientation).toBeNull();
  });
});
