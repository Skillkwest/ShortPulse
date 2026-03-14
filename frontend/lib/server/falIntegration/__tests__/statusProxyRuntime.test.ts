import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildFalStatusTransientPayload,
  isRetryableUpstreamResponse,
  readJsonSafe,
  resolveSuccessfulPayloadStatus,
  probeResponseUrlsForMedia,
} from "../statusProxyRuntime";

const ORIGINAL_ENV = { ...process.env };

describe("statusProxyRuntime", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.unstubAllGlobals();
  });

  it("classifies retryable upstream responses by status code and retry headers", () => {
    const retryableByStatus = new Response("{}", { status: 503 });
    const retryableByHeader = new Response("{}", {
      status: 400,
      headers: { "x-fal-retryable": "true" },
    });
    const nonRetryableByNeedsRetryFalse = new Response("{}", {
      status: 500,
      headers: { "x-fal-needs-retry": "false" },
    });
    const retryableByNeedsRetryTrue = new Response("{}", {
      status: 500,
      headers: { "x-fal-needs-retry": "true" },
    });
    const conflictingHeadersNeedsRetryWins = new Response("{}", {
      status: 500,
      headers: {
        "x-fal-needs-retry": "false",
        "x-fal-retryable": "true",
      },
    });
    const nonRetryable = new Response("{}", { status: 422 });

    expect(isRetryableUpstreamResponse(retryableByStatus)).toBe(true);
    expect(isRetryableUpstreamResponse(retryableByHeader)).toBe(true);
    expect(isRetryableUpstreamResponse(nonRetryableByNeedsRetryFalse)).toBe(false);
    expect(isRetryableUpstreamResponse(retryableByNeedsRetryTrue)).toBe(true);
    expect(isRetryableUpstreamResponse(conflictingHeadersNeedsRetryWins)).toBe(false);
    expect(isRetryableUpstreamResponse(nonRetryable)).toBe(false);
  });

  it("parses JSON and wraps non-JSON payloads safely", async () => {
    const parsed = await readJsonSafe(
      new Response(JSON.stringify({ status: "COMPLETED" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    const unparsed = await readJsonSafe(
      new Response("<!DOCTYPE html><h1>503</h1>", {
        status: 503,
        headers: { "Content-Type": "text/html" },
      })
    );

    expect(parsed.isJson).toBe(true);
    expect(parsed.json).toEqual({ status: "COMPLETED" });
    expect(unparsed.isJson).toBe(false);
    expect(typeof unparsed.json.raw).toBe("string");
  });

  it("builds transient polling payloads for non-terminal fallback handling", () => {
    expect(
      buildFalStatusTransientPayload({
        requestId: "req-1",
      })
    ).toEqual({
      status: "IN_PROGRESS",
      state: "running",
      request_id: "req-1",
    });
  });

  it("resolves completed payload status from mixed candidate values", () => {
    expect(resolveSuccessfulPayloadStatus(undefined, "IN_PROGRESS", "completed", "queued")).toBe(
      "completed"
    );
    expect(resolveSuccessfulPayloadStatus(undefined, null, "running")).toBe("completed");
  });

  it("probes response urls and returns first media-bearing payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "IN_PROGRESS" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "COMPLETED",
            data: {
              images: [{ url: "https://cdn.shortpulse.test/image.png" }],
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeResponseUrlsForMedia({
      responseUrls: [
        "https://queue.fal.run/example/requests/req-1",
        "https://queue.fal.run/example/requests/req-2",
      ],
      statusHint: "running",
      apiKey: "test-key",
      signal: new AbortController().signal,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      payload: {
        status: "COMPLETED",
        data: {
          images: [{ url: "https://cdn.shortpulse.test/image.png" }],
        },
      },
      payloadStatus: "completed",
    });
  });

  it("skips untrusted response probe URLs before fetch", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "COMPLETED",
          data: {
            images: [{ url: "https://cdn.shortpulse.test/image.png" }],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeResponseUrlsForMedia({
      responseUrls: [
        "https://localhost/private",
        "https://example.com/untrusted",
        "https://queue.fal.run/example/requests/req-2",
      ],
      statusHint: "running",
      apiKey: "test-key",
      signal: new AbortController().signal,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://queue.fal.run/example/requests/req-2",
      expect.any(Object)
    );
    expect(result?.payloadStatus).toBe("completed");
  });

  it("probes trusted kie response urls when model id is provided", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "SUCCESS",
          data: {
            images: [{ url: "https://cdn.shortpulse.test/kie-image.png" }],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await probeResponseUrlsForMedia({
      provider: "kie",
      modelId: "kie-ai/veo-3.1-fast-i2v",
      responseUrls: ["https://api.kie.ai/api/v1/veo/record-info?taskId=req-kie-1"],
      statusHint: "running",
      apiKey: "kie-test-key",
      signal: new AbortController().signal,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.kie.ai/api/v1/veo/record-info?taskId=req-kie-1",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Authorization: "Bearer kie-test-key",
        }),
      })
    );
    expect(result?.payloadStatus).toBe("completed");
  });

  it("fails closed for kie response probes when model id is missing", async () => {
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_TRUSTED_HOSTS = "kie.ai";

    await expect(
      probeResponseUrlsForMedia({
        provider: "kie",
        responseUrls: ["https://api.kie.ai/api/v1/veo/record-info?taskId=req-kie-1"],
        statusHint: "running",
        apiKey: "kie-test-key",
        signal: new AbortController().signal,
      })
    ).rejects.toThrow("Kie response probe URL resolution requires modelId.");
  });
});
