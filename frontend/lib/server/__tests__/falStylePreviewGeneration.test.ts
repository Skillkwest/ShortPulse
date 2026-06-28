import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFalFluxKleinAudioCompanionArtPayload,
  buildFalFluxKleinStylePreviewPayload,
  generateFalFluxKleinStylePreviewImage,
} from "../falStylePreviewGeneration";

describe("falStylePreviewGeneration", () => {
  const originalFalKey = process.env.FAL_KEY;

  beforeEach(() => {
    process.env.FAL_KEY = "test-fal-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.FAL_KEY = originalFalKey;
  });

  it("keeps style previews large while audio companion art uses the compact card size", () => {
    expect(buildFalFluxKleinStylePreviewPayload("dream glow")).toMatchObject({
      image_size: { width: 1024, height: 1024 },
      num_images: 1,
      output_format: "jpeg",
      num_inference_steps: 4,
      enable_safety_checker: false,
    });

    expect(buildFalFluxKleinAudioCompanionArtPayload("dream glow")).toMatchObject({
      image_size: { width: 512, height: 512 },
      num_images: 1,
      output_format: "jpeg",
      num_inference_steps: 4,
      enable_safety_checker: false,
    });
  });

  it("submits the Flux Klein style-preview payload and downloads direct media", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            request_id: "fal-style-preview-1",
            images: [{ url: "https://fal.media/style-preview.jpg" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response("preview-image-bytes", {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const payload = buildFalFluxKleinStylePreviewPayload("dream glow");
    const result = await generateFalFluxKleinStylePreviewImage({
      payload,
      timeoutMs: 5000,
      pollIntervalMs: 0,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://queue.fal.run/fal-ai/flux-2/klein/9b");
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({
        Authorization: "Key test-fal-key",
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
    });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://fal.media/style-preview.jpg");
    expect(result).toMatchObject({
      providerRequestId: "fal-style-preview-1",
      mediaUrl: "https://fal.media/style-preview.jpg",
      contentType: "image/jpeg",
    });
    expect(result.buffer.toString()).toBe("preview-image-bytes");
  });

  it("polls queued Flux Klein results before downloading media", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ request_id: "fal-style-preview-queued" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "COMPLETED" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "IN_PROGRESS" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            images: [{ url: "https://fal.media/style-preview-queued.jpg" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "alias unavailable" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response("queued-preview-image-bytes", {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateFalFluxKleinStylePreviewImage({
      payload: buildFalFluxKleinStylePreviewPayload("dream glow"),
      timeoutMs: 5000,
      pollIntervalMs: 0,
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/requests/fal-style-preview-queued/status"
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/fal-style-preview-queued/status"
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/requests/fal-style-preview-queued"
    );
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/fal-style-preview-queued"
    );
    expect(fetchMock.mock.calls[5]?.[0]).toBe("https://fal.media/style-preview-queued.jpg");
    expect(result.providerRequestId).toBe("fal-style-preview-queued");
    expect(result.buffer.toString()).toBe("queued-preview-image-bytes");
  });

  it("tries documented status aliases before failing a queued style preview", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ request_id: "fal-style-preview-alias" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "alias unavailable" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "COMPLETED" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "alias unavailable" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            images: [{ url: "https://fal.media/style-preview-alias.jpg" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response("alias-preview-image-bytes", {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateFalFluxKleinStylePreviewImage({
      payload: buildFalFluxKleinStylePreviewPayload("dream glow"),
      timeoutMs: 5000,
      pollIntervalMs: 0,
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/requests/fal-style-preview-alias/status"
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/fal-style-preview-alias/status"
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/requests/fal-style-preview-alias"
    );
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/fal-style-preview-alias"
    );
    expect(result.providerRequestId).toBe("fal-style-preview-alias");
    expect(result.buffer.toString()).toBe("alias-preview-image-bytes");
  });

  it("keeps polling when one status alias fails but another alias is still running", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ request_id: "fal-style-preview-running-alias" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "alias unavailable" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "IN_PROGRESS" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "alias unavailable" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "COMPLETED" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "alias unavailable" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            images: [{ url: "https://fal.media/style-preview-running-alias.jpg" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response("running-alias-preview-image-bytes", {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateFalFluxKleinStylePreviewImage({
      payload: buildFalFluxKleinStylePreviewPayload("dream glow"),
      timeoutMs: 5000,
      pollIntervalMs: 0,
      initialPollDelayMs: 0,
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/requests/fal-style-preview-running-alias/status"
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/fal-style-preview-running-alias/status"
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/requests/fal-style-preview-running-alias/status"
    );
    expect(fetchMock.mock.calls[4]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/fal-style-preview-running-alias/status"
    );
    expect(result.providerRequestId).toBe("fal-style-preview-running-alias");
    expect(result.buffer.toString()).toBe("running-alias-preview-image-bytes");
  });

  it("uses media returned by any healthy Fal status alias before probing result endpoints", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ request_id: "fal-style-preview-status-media" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "COMPLETED" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "IN_PROGRESS",
            images: [{ url: "https://fal.media/style-preview-status-media.jpg" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response("status-media-preview-image-bytes", {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateFalFluxKleinStylePreviewImage({
      payload: buildFalFluxKleinStylePreviewPayload("dream glow"),
      timeoutMs: 5000,
      pollIntervalMs: 0,
      initialPollDelayMs: 0,
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/requests/fal-style-preview-status-media/status"
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/fal-style-preview-status-media/status"
    );
    expect(fetchMock.mock.calls[3]?.[0]).toBe("https://fal.media/style-preview-status-media.jpg");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(result.providerRequestId).toBe("fal-style-preview-status-media");
    expect(result.buffer.toString()).toBe("status-media-preview-image-bytes");
  });

  it("prefers provider-returned status bases before catalog status aliases", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            request_id: "fal-style-preview-provider-url",
            status_url:
              "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/fal-style-preview-provider-url/status",
            response_url:
              "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/fal-style-preview-provider-url",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            images: [{ url: "https://fal.media/style-preview-provider-url.jpg" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "IN_PROGRESS" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      .mockResolvedValueOnce(
        new Response("provider-url-preview-image-bytes", {
          status: 200,
          headers: { "Content-Type": "image/jpeg" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateFalFluxKleinStylePreviewImage({
      payload: buildFalFluxKleinStylePreviewPayload("dream glow"),
      timeoutMs: 5000,
      pollIntervalMs: 0,
      initialPollDelayMs: 0,
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://queue.fal.run/fal-ai/flux-2/klein/9b/requests/fal-style-preview-provider-url/status"
    );
    expect(result.providerRequestId).toBe("fal-style-preview-provider-url");
    expect(result.buffer.toString()).toBe("provider-url-preview-image-bytes");
  });
});
