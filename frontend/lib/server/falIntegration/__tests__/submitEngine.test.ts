import { afterEach, describe, expect, it, vi } from "vitest";
import { submitSingleTargetWithRetry } from "../submitEngine";

describe("submitEngine trusted target policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SHORTPULSE_FAL_TRUSTED_HOSTS;
  });

  it("rejects untrusted submit target URLs before fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitSingleTargetWithRetry({
        target: { submitUrl: "https://example.com/untrusted" },
        payload: { prompt: "hello" },
        apiKey: "test-key",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("Untrusted Fal provider URL blocked");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits successfully to trusted Fal targets", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ request_id: "req-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitSingleTargetWithRetry({
      target: { submitUrl: "https://queue.fal.run/fal-ai/nano-banana-pro" },
      payload: { prompt: "hello" },
      apiKey: "test-key",
      signal: new AbortController().signal,
    });

    expect(result.response.ok).toBe(true);
    expect(result.targetUrl).toBe("https://queue.fal.run/fal-ai/nano-banana-pro");
    expect(result.diagnostics).toEqual(
      expect.objectContaining({
        attemptsTried: 1,
        targetCount: 1,
        totalDurationMs: expect.any(Number),
        targetAttempts: [
          expect.objectContaining({
            targetIndex: 0,
            attemptsTried: 1,
            finalStatus: 200,
            ok: true,
            durationMs: expect.any(Number),
          }),
        ],
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
