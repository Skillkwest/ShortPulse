import crypto from "crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  IMAGE_ADMISSION_POLICY_ID,
  IMAGE_ADMISSION_TARGET_BYTES,
} from "../../imageAdmissionPolicy";
import { admitImageBufferForProductUse } from "../imageAdmission";

const buildNoisyAvifBuffer = async (width = 512, height = 512): Promise<Buffer> => {
  const raw = Buffer.alloc(width * height * 3);
  crypto.randomFillSync(raw);
  return await sharp(raw, {
    raw: { width, height, channels: 3 },
  })
    .avif({ quality: 100 })
    .toBuffer();
};

const buildAnimatedWebpBuffer = async (): Promise<Buffer> => {
  const width = 4;
  const height = 4;
  const channels = 4;
  const frameSize = width * height * channels;
  const raw = Buffer.alloc(frameSize * 2);
  raw.fill(255, 0, frameSize);
  raw.fill(0, frameSize);

  return await sharp(raw, {
    animated: true,
    raw: {
      width,
      height: height * 2,
      channels,
      pageHeight: height,
    },
  })
    .webp({ delay: [100, 100], loop: 0 })
    .toBuffer();
};

describe("admitImageBufferForProductUse", () => {
  it("passes under-cap still images through without re-encoding", async () => {
    const image = await sharp({
      create: {
        width: 32,
        height: 24,
        channels: 3,
        background: { r: 120, g: 80, b: 40 },
      },
    })
      .png()
      .toBuffer();

    const result = await admitImageBufferForProductUse({
      buffer: image,
      mimeType: "image/png",
    });

    expect(result.status).toBe("not_required");
    if (result.status === "rejected") throw new Error("Expected image admission to succeed.");
    expect(result.buffer).toEqual(image);
    expect(result.mimeType).toBe("image/png");
    expect(result.dimensions).toEqual({ width: 32, height: 24 });
    expect(result.metadata).toEqual(
      expect.objectContaining({
        status: "not_required",
        policy: IMAGE_ADMISSION_POLICY_ID,
        target_bytes: IMAGE_ADMISSION_TARGET_BYTES,
        original_bytes: image.length,
        admitted_bytes: image.length,
        original_mime_type: "image/png",
        admitted_mime_type: "image/png",
        original_width: 32,
        original_height: 24,
        admitted_width: 32,
        admitted_height: 24,
        strategy: "passthrough",
        original_preserved: false,
        original_storage_path: null,
        admitted_storage_path: null,
        supabase_transform_used: false,
      })
    );
  });

  it("compresses over-cap still images under the provided admission cap", async () => {
    const image = await buildNoisyAvifBuffer();
    const maxBytes = 768 * 1024;
    expect(image.length).toBeGreaterThan(maxBytes);

    const result = await admitImageBufferForProductUse({
      buffer: image,
      mimeType: "image/avif",
      maxBytes,
      targetBytes: maxBytes,
    });

    expect(result.status).toBe("admitted");
    if (result.status === "rejected") throw new Error("Expected image admission to succeed.");
    expect(result.buffer.length).toBeLessThanOrEqual(maxBytes);
    expect(result.buffer.length).toBeLessThan(image.length);
    expect(result.mimeType).toMatch(/^image\/(avif|webp|jpeg)$/);
    expect(result.metadata).toEqual(
      expect.objectContaining({
        status: "admitted",
        policy: IMAGE_ADMISSION_POLICY_ID,
        max_bytes: maxBytes,
        target_bytes: maxBytes,
        original_bytes: image.length,
        admitted_bytes: result.buffer.length,
        original_mime_type: "image/avif",
        admitted_mime_type: result.mimeType,
        strategy: "server_sharp",
        supabase_transform_used: false,
      })
    );
  }, 30000);

  it("rejects over-cap animated images without converting them to still images", async () => {
    const image = await buildAnimatedWebpBuffer();

    const result = await admitImageBufferForProductUse({
      buffer: image,
      mimeType: "image/webp",
      maxBytes: 1,
      targetBytes: 1,
    });

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("Expected image admission to reject.");
    expect(result.reason).toBe("animated_over_cap");
    expect(result.userMessage).toContain("Animated images over 25 MB");
    expect(result.metadata).toEqual(
      expect.objectContaining({
        status: "rejected",
        policy: IMAGE_ADMISSION_POLICY_ID,
        max_bytes: 1,
        target_bytes: 1,
        original_bytes: image.length,
        admitted_bytes: null,
        original_mime_type: "image/webp",
        admitted_mime_type: null,
        strategy: "rejected_animated_over_cap",
        supabase_transform_used: false,
      })
    );
  });
});
