import { afterEach, describe, expect, it, vi } from "vitest";
import { probeProviderResult } from "../recoveryProviderProbe";

describe("recoveryProviderProbe trusted base policy", () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("fails closed when model status bases are outside trusted host policy", async () => {
    process.env.SHORTPULSE_FAL_TRUSTED_HOSTS = "partner.fal.ai";

    await expect(
      probeProviderResult({
        requestId: "req-1",
        modelId: "fal-ai/nano-banana-pro",
        apiKey: "test-key",
      })
    ).rejects.toThrow("No trusted fal status base URL configured");
  });

  it("consumes normalized nested Kie record-info envelopes in recovery probing", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/kling-3.0";
    delete process.env.SHORTPULSE_KIE_STATUS_BASE_URLS;

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: { malformed: true },
          data: {
            result: {
              status: "success",
              responseUrl: "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_123",
              resultJson: {
                resultUrls: ["https://cdn.shortpulse.test/kie-recovery-probe.mp4"],
              },
            },
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const observation = await probeProviderResult({
      provider: "kie",
      requestId: "task_123",
      modelId: "kie-ai/kling-3.0",
      apiKey: "test-kie-key",
    });

    expect(observation.state).toBe("completed");
    expect(observation.mediaUrls).toEqual(["https://cdn.shortpulse.test/kie-recovery-probe.mp4"]);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task_123",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer test-kie-key",
        }),
      })
    );
  });

  it("maps probe timeout/abort transport failures to running state without throwing", async () => {
    process.env.SHORTPULSE_FAL_TRUSTED_HOSTS = "queue.fal.run";
    process.env.SHORTPULSE_FAL_RECOVERY_PROBE_TIMEOUT_MS = "10";

    const abortError = new DOMException("Aborted", "AbortError");
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    vi.stubGlobal("fetch", fetchMock);

    const observation = await probeProviderResult({
      requestId: "req-1",
      modelId: "fal-ai/nano-banana-pro",
      apiKey: "test-fal-key",
    });

    expect(observation).toEqual({
      state: "running",
      payload: null,
      mediaUrls: [],
    });
    expect(fetchMock).toHaveBeenCalled();
  });
});
