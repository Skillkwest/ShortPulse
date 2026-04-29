/**
 * Unit coverage for provider-aware submit dispatch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchProviderSubmit, ProviderSubmitValidationError } from "../submitProviderDispatcher";

const submitSingleTargetWithRetryMock = vi.fn();
const ORIGINAL_ENV = { ...process.env };

vi.mock("../../falIntegration/submitEngine", () => ({
  submitSingleTargetWithRetry: (...args: unknown[]) => submitSingleTargetWithRetryMock(...args),
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
    submitSingleTargetWithRetryMock.mockResolvedValue({
      response: new Response(JSON.stringify({ request_id: "req-1" }), { status: 200 }),
      data: { request_id: "req-1" },
      targetUrl: "https://queue.fal.run/fal-ai/model",
      targetIndex: 0,
      diagnostics: {
        attemptsTried: 1,
        targetCount: 1,
        totalDurationMs: 25,
        targetAttempts: [
          {
            targetIndex: 0,
            attemptsTried: 1,
            finalStatus: 200,
            ok: true,
            durationMs: 25,
          },
        ],
      },
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

    expect(submitSingleTargetWithRetryMock).toHaveBeenCalledTimes(1);
    expect(submitSingleTargetWithRetryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { submitUrl: "https://queue.fal.run/fal-ai/model" },
      })
    );
    expect(result.providerRequestId).toBe("req-1");
    expect(result.targetIndex).toBe(0);
    expect(result.providerDiagnostics).toEqual(
      expect.objectContaining({
        attemptsTried: expect.any(Number),
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
  });

  it("supports request-id aliases from provider payloads", async () => {
    submitSingleTargetWithRetryMock.mockResolvedValue({
      response: new Response(JSON.stringify({ task_id: "task-1" }), { status: 200 }),
      data: { task_id: "task-1" },
      targetUrl: "https://queue.fal.run/fal-ai/model",
      targetIndex: 0,
      diagnostics: {
        attemptsTried: 1,
        targetCount: 1,
        totalDurationMs: 25,
        targetAttempts: [
          {
            targetIndex: 0,
            attemptsTried: 1,
            finalStatus: 200,
            ok: true,
            durationMs: 25,
          },
        ],
      },
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

  it("rejects fal submits with more than one target", async () => {
    await expect(
      dispatchProviderSubmit({
        provider: "fal",
        modelId: "fal-ai/nano-banana-pro",
        targets: [
          { submitUrl: "https://queue.fal.run/fal-ai/model" },
          { submitUrl: "https://queue.fal.run/fal-ai/model-legacy" },
        ],
        payload: { prompt: "hello" },
        apiKey: "key",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow(
      "Fal submit requires exactly one canonical submit target for model fal-ai/nano-banana-pro; received 2."
    );
    expect(submitSingleTargetWithRetryMock).not.toHaveBeenCalled();
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
    expect(submitSingleTargetWithRetryMock).not.toHaveBeenCalled();
  });

  it("dispatches kie submits when dark path is enabled", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
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
      payload: { prompt: "hello", image_url: "https://example.com/ref.png" },
      apiKey: "key",
      signal: new AbortController().signal,
    });

    expect(result.providerRequestId).toBe("kie-req-1");
    expect(submitSingleTargetWithRetryMock).not.toHaveBeenCalled();
    expect(result.providerDiagnostics).toEqual(
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

  it("dispatches Seedance 1.5 submits without requiring an allowlist entry", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 200, data: { taskId: "seedance-task-1" } }), {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchProviderSubmit({
      provider: "kie",
      modelId: "kie-ai/seedance-1.5-pro",
      targets: [{ submitUrl: "https://api.kie.ai/api/v1/jobs/createTask" }],
      payload: {
        prompt: "a woman",
        aspect_ratio: "9:16",
        resolution: "720p",
        duration: 4,
      },
      apiKey: "key",
      signal: new AbortController().signal,
    });

    expect(result.providerRequestId).toBe("seedance-task-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.kie.ai/api/v1/jobs/createTask",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer key",
        }),
      })
    );
  });

  it("attaches Kling media diagnostics to Kie submit results", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/kling-3.0";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ request_id: "kie-kling-req-1" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchProviderSubmit({
      provider: "kie",
      modelId: "kie-ai/kling-3.0",
      targets: [{ submitUrl: "https://queue.kie.ai/v1/jobs" }],
      payload: {
        prompt: "animate frame",
        image_url: "https://cdn.example.com/renders/shot-1.png",
        aspect_ratio: "16:9",
        duration: 5,
      },
      apiKey: "key",
      signal: new AbortController().signal,
    });

    expect(result.providerRequestId).toBe("kie-kling-req-1");
    expect(result.providerDiagnostics).toEqual(
      expect.objectContaining({
        model: "kling-3.0/video",
        motion_control: false,
      })
    );
  });

  it("falls back to model-catalog kie submit target when env submit urls are unset", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    delete process.env.SHORTPULSE_KIE_SUBMIT_URLS;

    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ request_id: "kie-req-2" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchProviderSubmit({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      targets: [],
      payload: { prompt: "hello", image_url: "https://example.com/ref.png" },
      apiKey: "key",
      signal: new AbortController().signal,
    });

    expect(result.providerRequestId).toBe("kie-req-2");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.kie.ai/api/v1/veo/generate",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer key",
        }),
      })
    );
  });

  it("fails closed for unsupported Kie model contracts", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "*";
    await expect(
      dispatchProviderSubmit({
        provider: "kie",
        modelId: "kie-ai/unknown",
        targets: [{ submitUrl: "https://queue.kie.ai/v1/jobs" }],
        payload: { prompt: "hello", image_url: "https://example.com/ref.png" },
        apiKey: "key",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("Unsupported Kie model contract: kie-ai/unknown");
  });

  it("rejects Kling submit media before provider dispatch when extension is unsupported", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/kling-3.0";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      dispatchProviderSubmit({
        provider: "kie",
        modelId: "kie-ai/kling-3.0",
        targets: [{ submitUrl: "https://queue.kie.ai/v1/jobs" }],
        payload: {
          prompt: "hello",
          image_url: "https://cdn.example.com/bad.txt",
          duration: 5,
          aspect_ratio: "16:9",
        },
        apiKey: "key",
        signal: new AbortController().signal,
      })
    ).rejects.toBeInstanceOf(ProviderSubmitValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats HTTP 200 with non-success Kie body code as upstream failure", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ code: 402, msg: "Insufficient Credits" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchProviderSubmit({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      targets: [{ submitUrl: "https://queue.kie.ai/v1/jobs" }],
      payload: { prompt: "hello", image_url: "https://example.com/ref.png" },
      apiKey: "key",
      signal: new AbortController().signal,
    });

    expect(result.response.ok).toBe(false);
    expect(result.response.status).toBe(402);
    expect(result.providerRequestId).toBeNull();
  });

  it("rejects Kie submits with more than one target", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      dispatchProviderSubmit({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
        targets: [
          { submitUrl: "https://queue.kie.ai/v1/jobs-primary" },
          { submitUrl: "https://queue.kie.ai/v1/jobs-secondary" },
        ],
        payload: { prompt: "hello", image_url: "https://example.com/ref.png" },
        apiKey: "key",
        signal: new AbortController().signal,
        maxAttemptsPerTarget: 1,
      })
    ).rejects.toThrow(
      "Kie submit requires exactly one canonical submit target for model kie-ai/veo-3.1-fast-i2v; received 2."
    );

    expect(fetchMock).not.toHaveBeenCalled();
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
    expect(submitSingleTargetWithRetryMock).not.toHaveBeenCalled();
  });
});
