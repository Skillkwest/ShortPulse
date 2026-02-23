import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isRetryableUpstreamResponse,
  readJsonSafe,
  resolveSuccessfulPayloadStatus,
  probeResponseUrlsForMedia,
} from "../statusProxyRuntime";

describe("statusProxyRuntime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("classifies retryable upstream responses by status code and header", () => {
    const retryableByStatus = new Response("{}", { status: 503 });
    const retryableByHeader = new Response("{}", {
      status: 400,
      headers: { "x-fal-retryable": "true" },
    });
    const nonRetryable = new Response("{}", { status: 422 });

    expect(isRetryableUpstreamResponse(retryableByStatus)).toBe(true);
    expect(isRetryableUpstreamResponse(retryableByHeader)).toBe(true);
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
});
