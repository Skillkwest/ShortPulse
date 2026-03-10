/**
 * Tests for style extraction client helpers.
 * Verifies managed URL normalization and extractor response parsing behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { prepareImageUrlForSubmission } from "../../utils/imageUpload";
import { postExtractStyle, prepareStyleImageUrl } from "../styleExtraction";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

vi.mock("../../utils/imageUpload", () => ({
  prepareImageUrlForSubmission: vi.fn(),
}));

describe("styleExtraction helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps trusted managed style URLs without external re-upload", async () => {
    vi.mocked(prepareImageUrlForSubmission).mockResolvedValue(
      "https://demo.supabase.co/storage/v1/object/sign/media-library/user/image.jpg?token=abc"
    );

    const resolved = await prepareStyleImageUrl("https://demo.supabase.co/media/image.jpg");

    expect(resolved).toBe(
      "https://demo.supabase.co/storage/v1/object/sign/media-library/user/image.jpg?token=abc"
    );
  });

  it("normalizes non-trusted style URLs to managed storage when fetch succeeds", async () => {
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(["image-bytes"], { type: "image/jpeg" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    URL.createObjectURL = vi.fn(() => "blob:normalized-style") as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
    vi.mocked(prepareImageUrlForSubmission)
      .mockResolvedValueOnce("https://external.example.com/style.jpg")
      .mockResolvedValueOnce("https://demo.supabase.co/storage/v1/object/sign/media/style.jpg");

    try {
      const resolved = await prepareStyleImageUrl("https://external.example.com/style.jpg");

      expect(fetchMock).toHaveBeenCalledWith("https://external.example.com/style.jpg", {
        method: "GET",
        mode: "cors",
        credentials: "omit",
      });
      expect(prepareImageUrlForSubmission).toHaveBeenNthCalledWith(2, "blob:normalized-style");
      expect(resolved).toBe("https://demo.supabase.co/storage/v1/object/sign/media/style.jpg");
      expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:normalized-style");
    } finally {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    }
  });

  it("returns deterministic recovery guidance when external fetch is blocked", async () => {
    vi.mocked(prepareImageUrlForSubmission).mockResolvedValue("https://external.example.com/a.jpg");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch external style image"))
    );

    await expect(prepareStyleImageUrl("https://external.example.com/a.jpg")).rejects.toThrow(
      "This image source blocks browser access. Download the image and drop the file directly to analyze style."
    );
  });

  it("postExtractStyle falls back to deterministic title when API omits styleTitle", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue({
      ok: true,
      json: async () => ({
        stylePrompt: "cinematic editorial photography style, dramatic moody lighting",
        usage: { inputTokens: 4, outputTokens: 5 },
      }),
    } as Response);

    const result = await postExtractStyle("https://demo.supabase.co/storage/v1/object/sign/a.jpg");

    expect(result.stylePrompt).toBe(
      "cinematic editorial photography style, dramatic moody lighting"
    );
    expect(result.styleTitle).toBe("Cinematic Editorial Photography Dramatic Moody");
    expect(result.usage).toEqual({ inputTokens: 4, outputTokens: 5 });
  });

  it("retries once when style extraction request times out and then succeeds", async () => {
    vi.mocked(fetchWithAuth)
      .mockRejectedValueOnce(new DOMException("Timed out", "AbortError"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          stylePrompt: "editorial portrait, cool highlights, soft diffusion",
          styleTitle: "Cool Diffusion Editorial",
        }),
      } as Response);

    const result = await postExtractStyle("https://demo.supabase.co/storage/v1/object/sign/a.jpg");

    expect(fetchWithAuth).toHaveBeenCalledTimes(2);
    expect(result.stylePrompt).toBe("editorial portrait, cool highlights, soft diffusion");
    expect(result.styleTitle).toBe("Cool Diffusion Editorial");
  });

  it("returns timeout guidance after retry budget is exhausted", async () => {
    vi.mocked(fetchWithAuth).mockRejectedValue(new DOMException("Timed out", "AbortError"));

    await expect(
      postExtractStyle("https://demo.supabase.co/storage/v1/object/sign/a.jpg")
    ).rejects.toThrow("Style extraction timed out. Please retry.");
    expect(fetchWithAuth).toHaveBeenCalledTimes(2);
  });
});
