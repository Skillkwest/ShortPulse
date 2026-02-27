/**
 * Unit coverage for provider-aware status/result request dispatch.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchProviderResultRequest,
  dispatchProviderStatusRequest,
  resolveProviderStatusBaseUrls,
} from "../statusProviderDispatcher";

describe("statusProviderDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters trusted status base URLs for fal provider", () => {
    const bases = resolveProviderStatusBaseUrls({
      provider: "fal",
      configuredBaseUrls: [
        "https://queue.fal.run/fal-ai/model/requests",
        "https://malicious.example.com/fal/requests",
      ],
    });
    expect(bases).toEqual(["https://queue.fal.run/fal-ai/model/requests"]);
  });

  it("dispatches fal status and result requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "running" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "completed" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    await dispatchProviderStatusRequest({
      provider: "fal",
      baseUrl: "https://queue.fal.run/fal-ai/model/requests",
      requestId: "req-1",
      apiKey: "test-key",
      signal: controller.signal,
    });
    await dispatchProviderResultRequest({
      provider: "fal",
      baseUrl: "https://queue.fal.run/fal-ai/model/requests",
      requestId: "req-1",
      apiKey: "test-key",
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://queue.fal.run/fal-ai/model/requests/req-1/status",
      expect.objectContaining({
        method: "GET",
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://queue.fal.run/fal-ai/model/requests/req-1",
      expect.objectContaining({
        method: "GET",
      })
    );
  });

  it("throws for unsupported providers", async () => {
    expect(() =>
      resolveProviderStatusBaseUrls({
        provider: "kie",
        configuredBaseUrls: ["https://queue.kie.ai/v1/requests"],
      })
    ).toThrow("Unsupported provider for status base resolution");

    await expect(
      dispatchProviderStatusRequest({
        provider: "kie",
        baseUrl: "https://queue.kie.ai/v1/requests",
        requestId: "req-kie",
        apiKey: "test-key",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("Unsupported provider for status dispatch");
  });
});
