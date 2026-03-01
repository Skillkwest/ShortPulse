/**
 * Unit coverage for provider-aware submit dispatch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchProviderSubmit } from "../submitProviderDispatcher";

const submitWithFallbackTargetsMock = vi.fn();
const ORIGINAL_ENV = { ...process.env };

vi.mock("../../falIntegration/submitEngine", () => ({
  submitWithFallbackTargets: (...args: unknown[]) => submitWithFallbackTargetsMock(...args),
}));

describe("submitProviderDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED;
    delete process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST;
    delete process.env.SHORTPULSE_KIE_SUBMIT_URLS;
    delete process.env.SHORTPULSE_KIE_STATUS_BASE_URLS;
    delete process.env.SHORTPULSE_KIE_TRUSTED_HOSTS;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dispatches fal submits and returns canonical provider request id", async () => {
    submitWithFallbackTargetsMock.mockResolvedValue({
      response: new Response(JSON.stringify({ request_id: "req-1" }), { status: 200 }),
      data: { request_id: "req-1" },
      targetUrl: "https://queue.fal.run/fal-ai/model",
      targetIndex: 0,
    });

    const controller = new AbortController();
    const result = await dispatchProviderSubmit({
      provider: "fal",
      modelId: "fal-ai/nano-banana-pro",
      targets: [{ submitUrl: "https://queue.fal.run/fal-ai/model" }],
      payload: { prompt: "hello" },
      apiKey: "key",
      signal: controller.signal,
      requestStartTimeoutSeconds: 20,
    });

    expect(submitWithFallbackTargetsMock).toHaveBeenCalledTimes(1);
    expect(result.providerRequestId).toBe("req-1");
    expect(result.targetIndex).toBe(0);
  });

  it("supports request-id aliases from provider payloads", async () => {
    submitWithFallbackTargetsMock.mockResolvedValue({
      response: new Response(JSON.stringify({ task_id: "task-1" }), { status: 200 }),
      data: { task_id: "task-1" },
      targetUrl: "https://queue.fal.run/fal-ai/model",
      targetIndex: 0,
    });

    const controller = new AbortController();
    const result = await dispatchProviderSubmit({
      provider: "fal_legacy_alias",
      modelId: "fal-ai/nano-banana-pro",
      targets: [{ submitUrl: "https://queue.fal.run/fal-ai/model" }],
      payload: { prompt: "hello" },
      apiKey: "key",
      signal: controller.signal,
    });

    expect(result.providerRequestId).toBe("task-1");
  });

  it("fails closed for kie when dark path is disabled", async () => {
    await expect(
      dispatchProviderSubmit({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
        targets: [{ submitUrl: "https://queue.kie.ai/video" }],
        payload: { prompt: "hello" },
        apiKey: "key",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("Kie provider is disabled by runtime flag.");
    expect(submitWithFallbackTargetsMock).not.toHaveBeenCalled();
  });

  it("dispatches kie submits when dark path is enabled", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ request_id: "kie-req-1" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchProviderSubmit({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      targets: [{ submitUrl: "https://queue.kie.ai/v1/jobs" }],
      payload: { prompt: "hello" },
      apiKey: "key",
      signal: new AbortController().signal,
    });

    expect(result.providerRequestId).toBe("kie-req-1");
    expect(submitWithFallbackTargetsMock).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://queue.kie.ai/v1/jobs",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer key",
        }),
      })
    );
  });

  it("throws for unsupported non-kie providers", async () => {
    await expect(
      dispatchProviderSubmit({
        provider: "openai",
        modelId: "gpt-5-nano",
        targets: [{ submitUrl: "https://api.openai.com/v1/responses" }],
        payload: { input: "hello" },
        apiKey: "key",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("Unsupported provider for submit dispatch");
    expect(submitWithFallbackTargetsMock).not.toHaveBeenCalled();
  });
});
