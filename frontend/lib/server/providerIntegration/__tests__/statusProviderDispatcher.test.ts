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

  it("dispatches fal status, result, and response probe requests with GET", async () => {
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
        headers: expect.objectContaining({ Authorization: "Key test-key" }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://queue.fal.run/fal-ai/model/requests/req-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Key test-key" }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://queue.fal.run/fal-ai/model/requests/req-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Key test-key" }),
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
        configuredBaseUrls: ["https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}"],
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Kie provider is disabled by runtime flag.");

    expect(() =>
      resolveProviderResponseUrls({
        provider: "kie",
        responseUrls: ["https://queue.kie.ai/v1/requests/req-kie"],
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toThrow("Kie provider is disabled by runtime flag.");
  });

  it("filters kie status bases to canonical request-id templates", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_STATUS_BASE_URLS =
      "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}";

    expect(
      resolveProviderStatusBaseUrls({
        provider: "kie",
        configuredBaseUrls: [
          "https://queue.kie.ai/v1/requests",
          "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
        ],
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toEqual(["https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}"]);
    expect(
      resolveProviderResponseUrls({
        provider: "kie",
        responseUrls: ["https://queue.kie.ai/v1/requests/req-kie"],
        modelId: "kie-ai/veo-3.1-fast-i2v",
      })
    ).toEqual(["https://queue.kie.ai/v1/requests/req-kie"]);

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
      baseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
      requestId: "req-kie",
      apiKey: "test-key",
      signal: new AbortController().signal,
    });
    await dispatchProviderResultRequest({
      provider: "kie",
      baseUrl: "https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}",
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
      "https://api.kie.ai/api/v1/veo/record-info?taskId=req-kie",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.kie.ai/api/v1/veo/record-info?taskId=req-kie",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://queue.kie.ai/v1/requests/req-kie",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
  });

  it("fails closed when kie status/result dispatch receives a non-template base URL", async () => {
    await expect(
      dispatchProviderStatusRequest({
        provider: "kie",
        baseUrl: "https://queue.kie.ai/v1/requests",
        requestId: "req-kie",
        apiKey: "test-key",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("Kie status dispatch requires a {requestId} status URL template.");

    await expect(
      dispatchProviderResultRequest({
        provider: "kie",
        baseUrl: "https://queue.kie.ai/v1/requests",
        requestId: "req-kie",
        apiKey: "test-key",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("Kie result dispatch requires a {requestId} status URL template.");
  });

  it("dispatches kie requests from {requestId} url templates", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "running" }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "completed" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    await dispatchProviderStatusRequest({
      provider: "kie",
      baseUrl: "https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}",
      requestId: "task-kie-1",
      apiKey: "test-key",
      signal: new AbortController().signal,
    });
    await dispatchProviderResultRequest({
      provider: "kie",
      baseUrl: "https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}",
      requestId: "task-kie-1",
      apiKey: "test-key",
      signal: new AbortController().signal,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task-kie-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=task-kie-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
  });

  it("fails closed for kie status topology when model id is missing", () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";

    expect(() =>
      resolveProviderStatusBaseUrls({
        provider: "kie",
        configuredBaseUrls: ["https://queue.kie.ai/v1/requests"],
      })
    ).toThrow("Kie status base resolution requires modelId.");

    expect(() =>
      resolveProviderResponseUrls({
        provider: "kie",
        responseUrls: ["https://queue.kie.ai/v1/requests/req-kie"],
      })
    ).toThrow("Kie response probe URL resolution requires modelId.");
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
