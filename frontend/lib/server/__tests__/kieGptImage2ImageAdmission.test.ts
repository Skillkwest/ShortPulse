// @vitest-environment node

import crypto from "crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { admitKieGptImage2ReferenceImage } from "../kieGptImage2ImageAdmission";

const buildImage = async (
  mimeType: "png" | "jpeg" | "webp",
  width = 512,
  height = 512
): Promise<Buffer> => {
  const pipeline = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 80, g: 110, b: 180 },
    },
  });
  if (mimeType === "jpeg") return await pipeline.jpeg({ quality: 92 }).toBuffer();
  if (mimeType === "webp") return await pipeline.webp({ quality: 92 }).toBuffer();
  return await pipeline.png().toBuffer();
};

const buildNoisyPng = async (width = 720, height = 720): Promise<Buffer> => {
  const raw = Buffer.alloc(width * height * 3);
  crypto.randomFillSync(raw);
  return await sharp(raw, {
    raw: { width, height, channels: 3 },
  })
    .png()
    .toBuffer();
};

describe("admitKieGptImage2ReferenceImage", () => {
  it("passes documented Kie GPT Image 2 reference formats through under 30 MB", async () => {
    const image = await buildImage("webp");

    const admitted = await admitKieGptImage2ReferenceImage({
      buffer: image,
      filename: "reference.webp",
      mimeType: "image/webp",
    });

    expect(admitted.buffer).toEqual(image);
    expect(admitted.mimeType).toBe("image/webp");
    expect(admitted.filename).toBe("reference.webp");
    expect(admitted.size).toBe(image.length);
    expect(admitted.dimensions).toEqual({ width: 512, height: 512 });
    expect(admitted.admission).toEqual(
      expect.objectContaining({
        profile: "kie_gpt_image_2_reference_image",
        status: "passthrough",
        originalBytes: image.length,
        admittedBytes: image.length,
        supabaseTransformUsed: false,
      })
    );
  });

  it("converts readable unsupported still images into a documented GPT Image 2 format", async () => {
    const image = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 3,
        background: { r: 180, g: 80, b: 110 },
      },
    })
      .avif()
      .toBuffer();

    const admitted = await admitKieGptImage2ReferenceImage({
      buffer: image,
      filename: "reference.avif",
      mimeType: "image/avif",
    });

    expect(admitted.buffer).not.toEqual(image);
    expect(admitted.mimeType).toMatch(/^image\/(jpeg|webp)$/);
    expect(admitted.filename).toMatch(/reference\.(?:jpg|webp)$/);
    expect(admitted.dimensions).toEqual({ width: 512, height: 512 });
    expect(admitted.admission.status).toBe("admitted");
    expect(admitted.admission.supabaseTransformUsed).toBe(false);
  });

  it("normalizes oversized GPT Image 2 references under the provider byte cap", async () => {
    const image = await buildNoisyPng();

    const admitted = await admitKieGptImage2ReferenceImage({
      buffer: image,
      filename: "large-reference.png",
      mimeType: "image/png",
      constraints: {
        maxBytes: 220 * 1024,
        targetBytes: 180 * 1024,
      },
    });

    expect(image.length).toBeGreaterThan(220 * 1024);
    expect(admitted.size).toBeLessThanOrEqual(220 * 1024);
    expect(admitted.mimeType).toMatch(/^image\/(jpeg|webp|png)$/);
    expect(admitted.admission.status).toBe("admitted");
  }, 30000);

  it("rejects animated references", async () => {
    const firstFrame = await buildImage("png", 320, 320);
    const secondFrame = await buildImage("png", 320, 320);
    const animated = await sharp(firstFrame, { animated: true })
      .composite([{ input: secondFrame, left: 0, top: 0 }])
      .gif()
      .toBuffer();

    await expect(
      admitKieGptImage2ReferenceImage({
        buffer: animated,
        filename: "animated.gif",
        mimeType: "image/gif",
      })
    ).rejects.toMatchObject({
      details: "GPT Image 2 reference image must be a still JPEG, PNG, or WEBP image.",
      statusCode: 400,
    });
  });

  it("rejects unreadable image bytes", async () => {
    await expect(
      admitKieGptImage2ReferenceImage({
        buffer: Buffer.from("not an image"),
        filename: "broken.png",
        mimeType: "image/png",
      })
    ).rejects.toMatchObject({
      details: "GPT Image 2 reference image must be a readable still image.",
      statusCode: 400,
    });
  });
});
