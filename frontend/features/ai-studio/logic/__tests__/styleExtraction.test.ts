/**
 * Tests for style extraction client helpers.
 * Verifies the direct-image extraction client contract.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";
import { isStyleExtractionError, postExtractStyle } from "../styleExtraction";

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

describe("styleExtraction helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("postExtractStyle sends image data directly and requires canonical title output", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      new Response(
        JSON.stringify({
          stylePrompt: "cinematic editorial photography style, dramatic moody lighting",
          styleTitle: "Noir Bloom",
          usage: { inputTokens: 4, outputTokens: 5 },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "x-shortpulse-style-attempt-count": "2",
            "x-shortpulse-style-openai-ms": "513",
            "x-shortpulse-style-model-used": "gpt-5-nano",
          },
        }
      )
    );

    const result = await postExtractStyle("data:image/jpeg;base64,abc123");

    expect(result.stylePrompt).toBe(
      "cinematic editorial photography style, dramatic moody lighting"
    );
    expect(result.styleTitle).toBe("Noir Bloom");
    expect(result.usage).toEqual({ inputTokens: 4, outputTokens: 5 });
    expect(result.attemptCount).toBe(2);
    expect(vi.mocked(fetchWithAuth)).toHaveBeenCalledWith(
      "/api/ai/extract-style",
      expect.objectContaining({
        body: JSON.stringify({ imageDataUrl: "data:image/jpeg;base64,abc123" }),
      })
    );
    expect(result.probeMs).toBeNull();
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

    const resultPromise = postExtractStyle("data:image/jpeg;base64,abc123");
    await vi.advanceTimersByTimeAsync(46000);
    const result = await resultPromise;

    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
    expect(result.stylePrompt).toBe("anime style, warm palette, soft diffusion");
    expect(result.styleTitle).toBe("Warm Anime Diffusion");
  });

  it("returns timeout guidance after request timeout abort", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchWithAuth).mockImplementation(async (_input, init) => {
      const signal = init?.signal;
      return await new Promise<Response>((_, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {
          once: true,
        });
      });
    });

    const resultPromise = postExtractStyle("data:image/jpeg;base64,abc123");
    const rejection = expect(resultPromise).rejects.toThrow(
      "Style extraction timed out. Please retry."
    );
    await vi.advanceTimersByTimeAsync(60000);
    await rejection;
    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
  });

  it("classifies immediate aborts as canceled and does not retry", async () => {
    vi.mocked(fetchWithAuth).mockRejectedValue(new DOMException("Aborted", "AbortError"));

    try {
      await postExtractStyle("data:image/jpeg;base64,abc123");
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

  it("does not retry transient network errors on the client", async () => {
    vi.mocked(fetchWithAuth).mockRejectedValue(new TypeError("Failed to fetch"));

    try {
      await postExtractStyle("data:image/jpeg;base64,abc123");
      throw new Error("Expected postExtractStyle to reject.");
    } catch (error) {
      expect(isStyleExtractionError(error)).toBe(true);
      if (!isStyleExtractionError(error)) return;
      expect(error.failureClass).toBe("network_transient");
      expect(error.message).toBe("Style extraction hit a network issue. Please retry.");
      expect(error.attemptCount).toBe(1);
    }
    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
  });

  it("does not retry upstream HTTP failures", async () => {
    vi.mocked(fetchWithAuth).mockResolvedValue(
      new Response(JSON.stringify({ detail: "Image URL host is not in the trusted allowlist." }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(postExtractStyle("data:image/jpeg;base64,abc123")).rejects.toThrow(
      "Image URL host is not in the trusted allowlist."
    );
    expect(fetchWithAuth).toHaveBeenCalledTimes(1);
  });
});
