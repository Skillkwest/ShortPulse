import crypto from "crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { admitKieMotionControlCharacterImage } from "../kieMotionControlMediaAdmission";

const buildPng = async (width = 512, height = 512): Promise<Buffer> =>
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 80, b: 40 },
    },
  })
    .png()
    .toBuffer();

const buildNoisyWebp = async (width = 900, height = 900): Promise<Buffer> => {
  const raw = Buffer.alloc(width * height * 3);
  crypto.randomFillSync(raw);
  return await sharp(raw, {
    raw: { width, height, channels: 3 },
  })
    .webp({ quality: 100, lossless: true })
    .toBuffer();
};

describe("admitKieMotionControlCharacterImage", () => {
  it("passes Kie-compatible PNG images through without replacing the source bytes", async () => {
    const image = await buildPng();

    const admitted = await admitKieMotionControlCharacterImage({
      buffer: image,
      filename: "character.png",
      mimeType: "image/png",
    });

    expect(admitted.buffer).toEqual(image);
    expect(admitted.mimeType).toBe("image/png");
    expect(admitted.filename).toBe("character.png");
    expect(admitted.size).toBe(image.length);
    expect(admitted.dimensions).toEqual({ width: 512, height: 512 });
    expect(admitted.admission).toEqual(
      expect.objectContaining({
        profile: "kie_motion_control_character_image",
        status: "passthrough",
        originalBytes: image.length,
        admittedBytes: image.length,
        supabaseTransformUsed: false,
      })
    );
  });

  it("converts product-valid WebP images before they reach Kie Motion Control", async () => {
    const image = await buildNoisyWebp();

    const admitted = await admitKieMotionControlCharacterImage({
      buffer: image,
      filename: "character.webp",
      mimeType: "image/webp",
      constraints: {
        maxBytes: 256 * 1024,
        targetBytes: 192 * 1024,
      },
    });

    expect(admitted.mimeType).toMatch(/^image\/(jpeg|png)$/);
    expect(admitted.mimeType).not.toBe("image/webp");
    expect(admitted.filename).toMatch(/character\.(?:jpg|png)$/);
    expect(admitted.buffer).not.toEqual(image);
    expect(admitted.size).toBeLessThanOrEqual(256 * 1024);
    expect(admitted.admission).toEqual(
      expect.objectContaining({
        status: "admitted",
        originalMimeType: "image/webp",
        admittedMimeType: admitted.mimeType,
        supabaseTransformUsed: false,
      })
    );
  }, 10000);

  it("normalizes oversized Kie-allowed images under the provider cap", async () => {
    const image = await buildNoisyWebp(1200, 1200);
    const png = await sharp(image).png().toBuffer();

    const admitted = await admitKieMotionControlCharacterImage({
      buffer: png,
      filename: "large-character.png",
      mimeType: "image/png",
      constraints: {
        maxBytes: 320 * 1024,
        targetBytes: 260 * 1024,
      },
    });

    expect(png.length).toBeGreaterThan(320 * 1024);
    expect(admitted.size).toBeLessThanOrEqual(320 * 1024);
    expect(admitted.mimeType).toMatch(/^image\/(jpeg|png)$/);
    expect(admitted.admission.status).toBe("admitted");
  }, 10000);

  it("rejects images below Kie's Motion Control dimension floor", async () => {
    const image = await buildPng(340, 512);

    await expect(
      admitKieMotionControlCharacterImage({
        buffer: image,
        filename: "too-small.png",
        mimeType: "image/png",
      })
    ).rejects.toMatchObject({
      details: "Motion Control character image must be at least 341 px wide and 341 px tall.",
      statusCode: 400,
    });
  });

  it("rejects images outside Kie's Motion Control aspect bounds", async () => {
    const image = await buildPng(341, 900);

    await expect(
      admitKieMotionControlCharacterImage({
        buffer: image,
        filename: "too-tall.png",
        mimeType: "image/png",
      })
    ).rejects.toMatchObject({
      details: "Motion Control character image aspect ratio must be between 2:5 and 5:2.",
      statusCode: 400,
    });
  });
});
