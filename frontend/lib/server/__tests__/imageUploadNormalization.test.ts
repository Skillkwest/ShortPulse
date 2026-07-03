import crypto from "crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { maybeNormalizeOversizedImageUpload } from "../imageUploadNormalization";

const buildNoisyAvifBuffer = async (width = 1000, height = 1000): Promise<Buffer> => {
  const raw = Buffer.alloc(width * height * 3);
  crypto.randomFillSync(raw);
  return await sharp(raw, {
    raw: { width, height, channels: 3 },
  })
    .avif({ quality: 100 })
    .toBuffer();
};

describe("maybeNormalizeOversizedImageUpload", () => {
  it("keeps under-cap images unchanged", async () => {
    const image = await sharp({
      create: {
        width: 32,
        height: 32,
        channels: 3,
        background: { r: 120, g: 80, b: 40 },
      },
    })
      .png()
      .toBuffer();

    const result = await maybeNormalizeOversizedImageUpload({
      buffer: image,
      mimeType: "image/png",
      maxBytes: image.length,
    });

    expect(result.buffer).toEqual(image);
    expect(result.mimeType).toBe("image/png");
    expect(result.metadata).toBeNull();
  });

  it("respects the provided maxBytes target for oversized still images", async () => {
    const image = await buildNoisyAvifBuffer();
    expect(image.length).toBeGreaterThan(2 * 1024 * 1024);

    const result = await maybeNormalizeOversizedImageUpload({
      buffer: image,
      mimeType: "image/avif",
      maxBytes: 2 * 1024 * 1024,
    });

    expect(result.buffer.length).toBeLessThanOrEqual(2 * 1024 * 1024);
    expect(result.buffer.length).toBeLessThan(image.length);
    expect(result.mimeType).toMatch(/^image\/(avif|webp|jpeg)$/);
    expect(result.metadata).toEqual(
      expect.objectContaining({
        attempted: true,
        applied: true,
        original_bytes: image.length,
        final_bytes: result.buffer.length,
        original_mime_type: "image/avif",
        final_mime_type: result.mimeType,
        failure_reason: null,
      })
    );
  }, 30000);
});
