// @vitest-environment node

/**
 * Unit tests for media derivative image processing helper.
 */
import { describe, expect, it, vi } from "vitest";
import { processClaimedMediaDerivative } from "../processMediaDerivative";

const sharpMetadataMock = vi.fn(async () => ({ width: 1600, height: 1000 }));
const sharpToBufferMock = vi.fn(async () => Buffer.from("encoded-variant"));
const sharpWebpMock = vi.fn(() => ({ toBuffer: sharpToBufferMock }));
const sharpResizeMock = vi.fn(() => ({ webp: sharpWebpMock }));
const sharpRotateMock = vi.fn(() => ({ resize: sharpResizeMock }));
const sharpMock = vi.fn(() => ({
  metadata: sharpMetadataMock,
  rotate: sharpRotateMock,
}));

vi.mock("sharp", () => ({
  default: () => sharpMock(),
}));

const createSupabaseMock = () => {
  const download = vi.fn().mockResolvedValue({
    data: {
      arrayBuffer: async () => Buffer.from("source-image").buffer,
    },
    error: null,
  });
  const upload = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const storageFrom = vi.fn(() => ({ download, upload }));
  const from = vi.fn(() => ({ upsert }));
  return {
    storage: { from: storageFrom },
    from,
    download,
    upload,
    upsert,
  };
};

describe("processClaimedMediaDerivative", () => {
  it("generates and uploads thumb variants", async () => {
    const supabase = createSupabaseMock();

    const result = await processClaimedMediaDerivative({
      row: {
        id: "media-1",
        user_id: "user-1",
        storage_path: "user-1/generations/images/source.png",
        file_type: "image",
        processing_attempts: 1,
        processing_status: "processing",
      },
      flags: {
        enabled: true,
        cronSecret: "x",
        batchSize: 10,
        maxAttempts: 5,
        leaseSeconds: 120,
        retryBaseSeconds: 60,
        retryMaxSeconds: 1800,
        thumb240Quality: 58,
        thumb480Quality: 62,
      },
      supabaseAdmin: supabase as never,
    });

    expect(supabase.download).toHaveBeenCalledTimes(1);
    expect(supabase.upload).toHaveBeenCalledTimes(2);
    expect(supabase.upsert).toHaveBeenCalledTimes(2);
    expect(sharpToBufferMock).toHaveBeenCalledTimes(2);
    expect(sharpMetadataMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      thumbPath: "user-1/variants/images/media-1/thumb_480",
      width: 1600,
      height: 1000,
      generatedVariants: 2,
    });
  });

  it("rejects invalid source storage paths", async () => {
    const supabase = createSupabaseMock();

    await expect(
      processClaimedMediaDerivative({
        row: {
          id: "media-2",
          user_id: "user-2",
          storage_path: "../escape.png",
          file_type: "image",
          processing_attempts: 1,
          processing_status: "processing",
        },
        flags: {
          enabled: true,
          cronSecret: "x",
          batchSize: 10,
          maxAttempts: 5,
          leaseSeconds: 120,
          retryBaseSeconds: 60,
          retryMaxSeconds: 1800,
          thumb240Quality: 58,
          thumb480Quality: 62,
        },
        supabaseAdmin: supabase as never,
      })
    ).rejects.toThrow("unsupported_input: invalid_source_storage_path");
  });

  it("returns deterministic decode error when variant encoding fails", async () => {
    const supabase = createSupabaseMock();
    sharpToBufferMock.mockRejectedValueOnce(new Error("decode exploded"));

    await expect(
      processClaimedMediaDerivative({
        row: {
          id: "media-3",
          user_id: "user-3",
          storage_path: "user-3/generations/images/source.png",
          file_type: "image",
          processing_attempts: 1,
          processing_status: "processing",
        },
        flags: {
          enabled: true,
          cronSecret: "x",
          batchSize: 10,
          maxAttempts: 5,
          leaseSeconds: 120,
          retryBaseSeconds: 60,
          retryMaxSeconds: 1800,
          thumb240Quality: 58,
          thumb480Quality: 62,
        },
        supabaseAdmin: supabase as never,
      })
    ).rejects.toThrow("decode_failed");
  });

  it("returns null dimensions when source metadata cannot be read", async () => {
    const supabase = createSupabaseMock();
    sharpMetadataMock.mockRejectedValueOnce(new Error("metadata exploded"));

    const result = await processClaimedMediaDerivative({
      row: {
        id: "media-4",
        user_id: "user-4",
        storage_path: "user-4/generations/images/source.png",
        file_type: "image",
        processing_attempts: 1,
        processing_status: "processing",
      },
      flags: {
        enabled: true,
        cronSecret: "x",
        batchSize: 10,
        maxAttempts: 5,
        leaseSeconds: 120,
        retryBaseSeconds: 60,
        retryMaxSeconds: 1800,
        thumb240Quality: 58,
        thumb480Quality: 62,
      },
      supabaseAdmin: supabase as never,
    });

    expect(result).toEqual({
      thumbPath: "user-4/variants/images/media-4/thumb_480",
      width: null,
      height: null,
      generatedVariants: 2,
    });
  });
});
