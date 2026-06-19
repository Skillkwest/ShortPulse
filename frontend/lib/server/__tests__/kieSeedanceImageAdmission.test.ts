import crypto from "crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { admitKieSeedanceReferenceImage } from "../kieSeedanceImageAdmission";

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

const buildNoisyPng = async (width = 420, height = 420): Promise<Buffer> => {
  const raw = Buffer.alloc(width * height * 3);
  crypto.randomFillSync(raw);
  return await sharp(raw, {
    raw: { width, height, channels: 3 },
  })
    .png()
    .toBuffer();
};

describe("admitKieSeedanceReferenceImage", () => {
  it("passes Kie-compatible PNG references through without replacing source bytes", async () => {
    const image = await buildPng();

    const admitted = await admitKieSeedanceReferenceImage({
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
        profile: "kie_seedance_reference_image",
        status: "passthrough",
        originalBytes: image.length,
        admittedBytes: image.length,
        supabaseTransformUsed: false,
      })
    );
  });

  it("upscales small screenshot-style references to Seedance's 300 px floor", async () => {
    const image = await buildPng(240, 180);

    const admitted = await admitKieSeedanceReferenceImage({
      buffer: image,
      filename: "small-screenshot.png",
      mimeType: "image/png",
    });

    expect(admitted.buffer).not.toEqual(image);
    expect(admitted.mimeType).toBe("image/png");
    expect(admitted.filename).toBe("small-screenshot.png");
    expect(admitted.dimensions).toEqual({ width: 400, height: 300 });
    expect(admitted.admission).toEqual(
      expect.objectContaining({
        status: "admitted",
        originalDimensions: { width: 240, height: 180 },
        admittedDimensions: { width: 400, height: 300 },
        supabaseTransformUsed: false,
      })
    );
  });

  it("downscales oversized references to Seedance's max dimension", async () => {
    const image = await buildPng(1200, 900);

    const admitted = await admitKieSeedanceReferenceImage({
      buffer: image,
      filename: "large-reference.png",
      mimeType: "image/png",
      constraints: {
        maxDimensionPx: 900,
      },
    });

    expect(admitted.dimensions).toEqual({ width: 900, height: 675 });
    expect(admitted.admission.status).toBe("admitted");
  });

  it("normalizes oversized references under the provider byte cap", async () => {
    const image = await buildNoisyPng();

    const admitted = await admitKieSeedanceReferenceImage({
      buffer: image,
      filename: "noisy-reference.png",
      mimeType: "image/png",
      constraints: {
        maxBytes: 96 * 1024,
        targetBytes: 72 * 1024,
      },
    });

    expect(image.length).toBeGreaterThan(96 * 1024);
    expect(admitted.size).toBeLessThanOrEqual(96 * 1024);
    expect(admitted.dimensions.width).toBeGreaterThanOrEqual(300);
    expect(admitted.dimensions.height).toBeGreaterThanOrEqual(300);
    expect(admitted.admission.status).toBe("admitted");
  }, 10000);

  it("rejects references outside Seedance aspect bounds", async () => {
    const image = await buildPng(1200, 200);

    await expect(
      admitKieSeedanceReferenceImage({
        buffer: image,
        filename: "too-wide.png",
        mimeType: "image/png",
      })
    ).rejects.toMatchObject({
      details: "Seedance reference image aspect ratio must be between 0.4 and 2.5.",
      statusCode: 400,
    });
  });

  it("rejects unreadable image bytes", async () => {
    await expect(
      admitKieSeedanceReferenceImage({
        buffer: Buffer.from("not an image"),
        filename: "broken.png",
        mimeType: "image/png",
      })
    ).rejects.toMatchObject({
      details: "Seedance reference image must be a readable still image.",
      statusCode: 400,
    });
  });
});
