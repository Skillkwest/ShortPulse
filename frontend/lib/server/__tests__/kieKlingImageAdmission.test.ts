// @vitest-environment node

import crypto from "crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { admitKieKlingReferenceImage } from "../kieKlingImageAdmission";

const buildPng = async (width = 512, height = 512): Promise<Buffer> =>
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 120, b: 160 },
    },
  })
    .png()
    .toBuffer();

const buildWebp = async (width = 512, height = 512): Promise<Buffer> =>
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 120, g: 80, b: 160 },
    },
  })
    .webp({ quality: 90 })
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

describe("admitKieKlingReferenceImage", () => {
  it("passes Kling-compatible PNG references through without replacing source bytes", async () => {
    const image = await buildPng();

    const admitted = await admitKieKlingReferenceImage({
      buffer: image,
      filename: "reference.png",
      mimeType: "image/png",
    });

    expect(admitted.buffer).toEqual(image);
    expect(admitted.mimeType).toBe("image/png");
    expect(admitted.filename).toBe("reference.png");
    expect(admitted.size).toBe(image.length);
    expect(admitted.dimensions).toEqual({ width: 512, height: 512 });
    expect(admitted.admission).toEqual(
      expect.objectContaining({
        profile: "kie_kling_reference_image",
        status: "passthrough",
        originalBytes: image.length,
        admittedBytes: image.length,
        supabaseTransformUsed: false,
      })
    );
  });

  it("converts product-valid WebP references before they reach Kling", async () => {
    const image = await buildWebp();

    const admitted = await admitKieKlingReferenceImage({
      buffer: image,
      filename: "reference.webp",
      mimeType: "image/webp",
    });

    expect(admitted.buffer).not.toEqual(image);
    expect(admitted.mimeType).toMatch(/^image\/(jpeg|png)$/);
    expect(admitted.mimeType).not.toBe("image/webp");
    expect(admitted.filename).toMatch(/reference\.(?:jpg|png)$/);
    expect(admitted.dimensions).toEqual({ width: 512, height: 512 });
    expect(admitted.admission).toEqual(
      expect.objectContaining({
        profile: "kie_kling_reference_image",
        status: "admitted",
        originalMimeType: "image/webp",
        admittedMimeType: admitted.mimeType,
        supabaseTransformUsed: false,
      })
    );
  });

  it("normalizes oversized Kie-allowed references under the provider cap", async () => {
    const image = await buildNoisyWebp(1200, 1200);
    const png = await sharp(image).png().toBuffer();

    const admitted = await admitKieKlingReferenceImage({
      buffer: png,
      filename: "large-reference.png",
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
  }, 30000);

  it("rejects images below Kie's Kling dimension floor", async () => {
    const image = await buildPng(299, 512);

    await expect(
      admitKieKlingReferenceImage({
        buffer: image,
        filename: "too-small.png",
        mimeType: "image/png",
      })
    ).rejects.toMatchObject({
      details: "Kling reference image must be at least 300 px wide and 300 px tall.",
      statusCode: 400,
    });
  });

  it("rejects unreadable image bytes", async () => {
    await expect(
      admitKieKlingReferenceImage({
        buffer: Buffer.from("not an image"),
        filename: "broken.webp",
        mimeType: "image/webp",
      })
    ).rejects.toMatchObject({
      details: "Kling reference image must be a readable still image.",
      statusCode: 400,
    });
  });
});
