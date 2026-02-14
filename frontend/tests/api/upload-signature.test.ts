import { describe, expect, it } from "vitest";
import {
  areCompatibleMimeTypes,
  detectImageMimeType,
  detectVideoMimeType,
} from "../../lib/server/uploadSignature";

describe("upload signature helpers", () => {
  it("detects common image signatures", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);
    expect(detectImageMimeType(jpeg)).toBe("image/jpeg");

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectImageMimeType(png)).toBe("image/png");

    const webp = Buffer.from("RIFF0000WEBP", "ascii");
    expect(detectImageMimeType(webp)).toBe("image/webp");
  });

  it("detects common video signatures", () => {
    const mp4 = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    ]);
    expect(detectVideoMimeType(mp4)).toBe("video/mp4");

    const mov = Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20,
    ]);
    expect(detectVideoMimeType(mov)).toBe("video/quicktime");
  });

  it("treats compatible aliases as equivalent", () => {
    expect(areCompatibleMimeTypes("image/heif", "image/heic")).toBe(true);
    expect(areCompatibleMimeTypes("video/mp4", "video/x-m4v")).toBe(true);
    expect(areCompatibleMimeTypes("image/png", "image/jpeg")).toBe(false);
  });
});
