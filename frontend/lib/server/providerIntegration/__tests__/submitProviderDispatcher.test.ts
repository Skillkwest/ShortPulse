/**
 * Unit coverage for provider-aware submit dispatch.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchProviderSubmit } from "../submitProviderDispatcher";

const submitWithFallbackTargetsMock = vi.fn();

vi.mock("../../falIntegration/submitEngine", () => ({
  submitWithFallbackTargets: (...args: unknown[]) => submitWithFallbackTargetsMock(...args),
}));

describe("submitProviderDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      targets: [{ submitUrl: "https://queue.fal.run/fal-ai/model" }],
      payload: { prompt: "hello" },
      apiKey: "key",
      signal: controller.signal,
    });

    expect(result.providerRequestId).toBe("task-1");
  });

  it("throws for unsupported providers", async () => {
    await expect(
      dispatchProviderSubmit({
        provider: "kie",
        targets: [{ submitUrl: "https://queue.kie.ai/video" }],
        payload: { prompt: "hello" },
        apiKey: "key",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("Unsupported provider for submit dispatch");
    expect(submitWithFallbackTargetsMock).not.toHaveBeenCalled();
  });
});
