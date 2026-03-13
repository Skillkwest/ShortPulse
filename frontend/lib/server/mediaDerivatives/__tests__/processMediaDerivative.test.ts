/**
 * Unit tests for media derivative image processing helper.
 */
import { describe, expect, it, vi } from "vitest";
import { processClaimedMediaDerivative } from "../processMediaDerivative";

const createSupabaseMock = () => {
  const createSignedUrl = vi
    .fn()
    .mockResolvedValueOnce({ data: { signedUrl: "https://example.test/240" }, error: null })
    .mockResolvedValueOnce({ data: { signedUrl: "https://example.test/480" }, error: null });
  const upload = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const storageFrom = vi.fn(() => ({ createSignedUrl, upload }));
  const from = vi.fn(() => ({ upsert }));
  return {
    storage: { from: storageFrom },
    from,
    createSignedUrl,
    upload,
    upsert,
  };
};

describe("processClaimedMediaDerivative", () => {
  it("generates and uploads thumb variants", async () => {
    const supabase = createSupabaseMock();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "image/webp" },
      arrayBuffer: async () => Buffer.from("thumb-bytes"),
    }));

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
        sourceSignedUrlTtlSeconds: 300,
        retryBaseSeconds: 60,
        retryMaxSeconds: 1800,
        thumb240Quality: 58,
        thumb480Quality: 62,
      },
      supabaseAdmin: supabase as never,
      fetchImpl: fetchImpl as never,
    });

    expect(supabase.createSignedUrl).toHaveBeenCalledTimes(2);
    expect(supabase.upload).toHaveBeenCalledTimes(2);
    expect(supabase.upsert).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      thumbPath: "user-1/variants/images/media-1/thumb_480",
      width: 480,
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
          sourceSignedUrlTtlSeconds: 300,
          retryBaseSeconds: 60,
          retryMaxSeconds: 1800,
          thumb240Quality: 58,
          thumb480Quality: 62,
        },
        supabaseAdmin: supabase as never,
      })
    ).rejects.toThrow("invalid source storage path");
  });
});
