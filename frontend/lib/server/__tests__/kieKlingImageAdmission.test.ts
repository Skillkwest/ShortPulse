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
