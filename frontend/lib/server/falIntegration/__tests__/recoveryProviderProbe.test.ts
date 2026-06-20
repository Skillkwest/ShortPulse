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

  it("treats terminal fal completed-without-media as completed instead of running", async () => {
    process.env.SHORTPULSE_FAL_TRUSTED_HOSTS = "queue.fal.run";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            request_id: "req-1",
            error_type: "runner_disconnected",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Request not found" }), { status: 404 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const observation = await probeProviderResult({
      requestId: "req-1",
      modelId: "fal-ai/nano-banana-pro",
      apiKey: "test-fal-key",
    });

    expect(observation).toEqual({
      state: "completed",
      payload: {
        status: "COMPLETED",
        request_id: "req-1",
        error_type: "runner_disconnected",
      },
      mediaUrls: [],
    });
  });

  it("treats terminal fal status payloads with provider errors as failed", async () => {
    process.env.SHORTPULSE_FAL_TRUSTED_HOSTS = "queue.fal.run";

    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            request_id: "req-1",
            error: "User defined request timeout exceeded: Pre-start",
            error_type: "startup_timeout",
          }),
          { status: 200 }
        )
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const observation = await probeProviderResult({
      requestId: "req-1",
      modelId: "fal-ai/nano-banana-2/edit",
      apiKey: "test-fal-key",
    });

    expect(observation).toEqual({
      state: "failed",
      payload: {
        status: "COMPLETED",
        request_id: "req-1",
        error: "User defined request timeout exceeded: Pre-start",
        error_type: "startup_timeout",
      },
      mediaUrls: [],
    });
  });

  it("treats failed status payloads with media-shaped fields as failed", async () => {
    process.env.SHORTPULSE_FAL_TRUSTED_HOSTS = "queue.fal.run";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "FAILED",
          request_id: "req-1",
          error: "provider failed after producing partial output",
          images: [{ url: "https://fal.media/files/partial.png" }],
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const observation = await probeProviderResult({
      requestId: "req-1",
      modelId: "fal-ai/nano-banana-2/edit",
      apiKey: "test-fal-key",
    });

    expect(observation).toEqual({
      state: "failed",
      payload: {
        status: "FAILED",
        request_id: "req-1",
        error: "provider failed after producing partial output",
        images: [{ url: "https://fal.media/files/partial.png" }],
      },
      mediaUrls: [],
    });
  });

  it("probes response and result endpoints before settling completed without media", async () => {
    process.env.SHORTPULSE_FAL_TRUSTED_HOSTS = "queue.fal.run";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            request_id: "req-1",
            response_url: "https://queue.fal.run/fal-ai/bytedance/requests/req-1",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            images: [{ url: "https://fal.media/files/result.png" }],
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            images: [{ url: "https://fal.media/files/result.png" }],
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const observation = await probeProviderResult({
      requestId: "req-1",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      apiKey: "test-fal-key",
    });

    expect(observation).toEqual({
      state: "completed",
      payload: {
        images: [{ url: "https://fal.media/files/result.png" }],
      },
      mediaUrls: ["https://fal.media/files/result.png"],
    });
  });
});
