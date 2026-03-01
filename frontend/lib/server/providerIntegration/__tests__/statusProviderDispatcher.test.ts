/**
 * Unit coverage for provider-aware status/result request dispatch.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dispatchProviderResponseProbeRequest,
  dispatchProviderResultRequest,
  dispatchProviderStatusRequest,
  resolveProviderResponseUrls,
  resolveProviderStatusBaseUrls,
} from "../statusProviderDispatcher";

const ORIGINAL_ENV = { ...process.env };

describe("statusProviderDispatcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed" }), { status: 200 }))
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
    await dispatchProviderResponseProbeRequest({
      provider: "fal",
      responseUrl: "https://queue.fal.run/fal-ai/model/requests/req-1",
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
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://queue.fal.run/fal-ai/model/requests/req-1",
      expect.objectContaining({
        method: "GET",
      })
    );
  });

  it("filters trusted response probe urls for fal provider", () => {
    const urls = resolveProviderResponseUrls({
      provider: "fal",
      responseUrls: [
        "https://queue.fal.run/fal-ai/model/requests/req-1",
        "https://evil.example.com/fal/req-1",
      ],
    });
    expect(urls).toEqual(["https://queue.fal.run/fal-ai/model/requests/req-1"]);
  });

  it("fails closed for kie while dark path is disabled", async () => {
    expect(() =>
      resolveProviderStatusBaseUrls({
        provider: "kie",
        configuredBaseUrls: ["https://queue.kie.ai/v1/requests"],
      })
    ).toThrow("Kie provider is disabled by runtime flag.");

    expect(() =>
      resolveProviderResponseUrls({
        provider: "kie",
        responseUrls: ["https://queue.kie.ai/v1/requests/req-kie"],
      })
    ).toThrow("Kie provider is disabled by runtime flag.");
  });

  it("dispatches kie requests when dark path is enabled", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_STATUS_BASE_URLS = "https://queue.kie.ai/v1/requests";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "running" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "completed" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "completed" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    await dispatchProviderStatusRequest({
      provider: "kie",
      baseUrl: "https://queue.kie.ai/v1/requests",
      requestId: "req-kie",
      apiKey: "test-key",
      signal: new AbortController().signal,
    });
    await dispatchProviderResultRequest({
      provider: "kie",
      baseUrl: "https://queue.kie.ai/v1/requests",
      requestId: "req-kie",
      apiKey: "test-key",
      signal: new AbortController().signal,
    });
    await dispatchProviderResponseProbeRequest({
      provider: "kie",
      responseUrl: "https://queue.kie.ai/v1/requests/req-kie",
      apiKey: "test-key",
      signal: new AbortController().signal,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://queue.kie.ai/v1/requests/req-kie/status",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
  });

  it("throws for unsupported providers", () => {
    expect(() =>
      resolveProviderStatusBaseUrls({
        provider: "openai",
        configuredBaseUrls: ["https://api.openai.com/v1/responses"],
      })
    ).toThrow("Unsupported provider for status base resolution");
  });
});
