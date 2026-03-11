/**
 * Tests for style extraction client helpers.
 * Verifies managed URL normalization and extractor response parsing behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { prepareImageUrlForSubmission } from "../../utils/imageUpload";
import { isStyleExtractionError, postExtractStyle, prepareStyleImageUrl } from "../styleExtraction";

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
    vi.useRealTimers();
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
    vi.mocked(fetchWithAuth).mockResolvedValue(
      new Response(
        JSON.stringify({
          stylePrompt: "cinematic editorial photography style, dramatic moody lighting",
          usage: { inputTokens: 4, outputTokens: 5 },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "x-shortpulse-style-attempt-count": "2",
            "x-shortpulse-style-probe-ms": "71",
            "x-shortpulse-style-openai-ms": "513",
            "x-shortpulse-style-model-used": "gpt-5-nano",
          },
        }
      )
    );

    const result = await postExtractStyle("https://demo.supabase.co/storage/v1/object/sign/a.jpg");

    expect(result.stylePrompt).toBe(
      "cinematic editorial photography style, dramatic moody lighting"
    );
    expect(result.styleTitle).toBe("Cinematic Editorial Photography Dramatic Moody");
    expect(result.usage).toEqual({ inputTokens: 4, outputTokens: 5 });
    expect(result.attemptCount).toBe(2);
    expect(result.probeMs).toBe(71);
    expect(result.openAiMs).toBe(513);
    expect(result.modelUsed).toBe("gpt-5-nano");
  });

  it("allows slow upstream extraction responses within the aligned timeout budget", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchWithAuth).mockImplementation(async () => {
      return await new Promise<Response>((resolve) => {
        setTimeout(() => {
          resolve(
            new Response(
              JSON.stringify({
                stylePrompt: "anime style, warm palette, soft diffusion",
                styleTitle: "Warm Anime Diffusion",
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
          );
        }, 45000);
      });
    });

    const resultPromise = postExtractStyle("https://demo.supabase.co/storage/v1/object/sign/a.jpg");
    await vi.advanceTimersByTimeAsync(46000);
    const result = await resultPromise;

    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
    expect(result.stylePrompt).toBe("anime style, warm palette, soft diffusion");
    expect(result.styleTitle).toBe("Warm Anime Diffusion");
  });

  it("retries on timeout abort and succeeds on the next attempt", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    let requestCount = 0;
    vi.mocked(fetchWithAuth).mockImplementation(async (_input, init) => {
      requestCount += 1;
      if (requestCount === 1) {
        const signal = init?.signal;
        return await new Promise<Response>((_, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true }
          );
        });
      }
      return new Response(
        JSON.stringify({
          stylePrompt: "editorial portrait, cool highlights, soft diffusion",
          styleTitle: "Cool Diffusion Editorial",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    });

    const resultPromise = postExtractStyle("https://demo.supabase.co/storage/v1/object/sign/a.jpg");
    await vi.advanceTimersByTimeAsync(59000);
    const result = await resultPromise;

    expect(fetchWithAuth).toHaveBeenCalledTimes(2);
    expect(result.stylePrompt).toBe("editorial portrait, cool highlights, soft diffusion");
    expect(result.styleTitle).toBe("Cool Diffusion Editorial");
  });

  it("returns timeout guidance after deadline exhaustion", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.mocked(fetchWithAuth).mockImplementation(async (_input, init) => {
      const signal = init?.signal;
      return await new Promise<Response>((_, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        });
      });
    });

    const resultPromise = postExtractStyle("https://demo.supabase.co/storage/v1/object/sign/a.jpg");
    const rejection = expect(resultPromise).rejects.toThrow(
      "Style extraction timed out. Please retry."
    );
    await vi.advanceTimersByTimeAsync(100000);
    await rejection;
    expect(fetchWithAuth).toHaveBeenCalledTimes(2);
  });

  it("classifies immediate aborts as canceled and does not retry", async () => {
    vi.mocked(fetchWithAuth).mockRejectedValue(new DOMException("Aborted", "AbortError"));

    try {
      await postExtractStyle("https://demo.supabase.co/storage/v1/object/sign/a.jpg");
      throw new Error("Expected postExtractStyle to reject.");
    } catch (error) {
      expect(isStyleExtractionError(error)).toBe(true);
      if (!isStyleExtractionError(error)) return;
      expect(error.failureClass).toBe("canceled");
      expect(error.message).toBe("Style extraction was interrupted. Please retry.");
      expect(error.attemptCount).toBe(1);
    }
    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
  });

  it("retries transient network errors and then succeeds", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.mocked(fetchWithAuth)
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            stylePrompt: "painterly texture, muted palette, smooth tonal gradients",
            styleTitle: "Muted Painterly",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

    const result = await postExtractStyle("https://demo.supabase.co/storage/v1/object/sign/a.jpg");

    expect(fetchWithAuth).toHaveBeenCalledTimes(2);
    expect(result.styleTitle).toBe("Muted Painterly");
  });

  it("does not retry upstream HTTP failures", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      new Response(JSON.stringify({ detail: "Image URL host is not in the trusted allowlist." }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      postExtractStyle("https://demo.supabase.co/storage/v1/object/sign/a.jpg")
    ).rejects.toThrow("Image URL host is not in the trusted allowlist.");
    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
  });
});
