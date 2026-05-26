/**
 * Upload helper tests for AI Studio image references.
 * Ensures local images are sent as raw image bytes with explicit content type.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShortPulseFetchInit } from "../../../../lib/authenticatedFetch";

const fetchWithAuthMock = vi.fn();
const getSignedMediaUrlMock = vi.fn();
const maybeTranscodeLocalImageBlobForUploadMock = vi.fn();

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
  isAuthRequiredError: (error: unknown) =>
    Boolean(error) &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "AUTH_REQUIRED",
  isAuthSessionTimeoutError: (error: unknown) =>
    Boolean(error) &&
    typeof error === "object" &&
    (error as { code?: unknown }).code === "AUTH_SESSION_TIMEOUT",
}));
vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: (...args: unknown[]) => getSignedMediaUrlMock(...args),
}));
vi.mock("../../../../lib/adaptive-media", () => ({
  maybeTranscodeLocalImageBlobForUpload: (...args: unknown[]) =>
    maybeTranscodeLocalImageBlobForUploadMock(...args),
}));

import {
  needsImageUpload,
  prepareImageUrlForSubmission,
  uploadImageToStorage,
} from "../imageUpload";
import { rememberObjectUrlBlob, forgetObjectUrlBlob } from "../objectUrlBlobRegistry";

const originalFetch = global.fetch;

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("imageUpload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSignedMediaUrlMock.mockResolvedValue("https://example.com/signed/refreshed.png");
    maybeTranscodeLocalImageBlobForUploadMock.mockImplementation(async (blob: Blob) => blob);
    forgetObjectUrlBlob("blob:expert-edit-flattened");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("uploads local blob URLs as raw image bytes", async () => {
    const localUrl = "blob:reference-1";
    const imageBlob = new Blob(["image-data"], { type: "image/png" });
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(imageBlob, { headers: { "Content-Type": "image/png" } })
      ) as typeof fetch;
    fetchWithAuthMock.mockResolvedValue(
      jsonResponse({
        url: "https://example.com/signed/reference-1.png",
        path: "user/images/reference-1.png",
        size: imageBlob.size,
      })
    );

    const signedUrl = await uploadImageToStorage(localUrl);

    expect(signedUrl).toBe("https://example.com/signed/reference-1.png");
    expect(global.fetch).toHaveBeenCalledWith(
      localUrl,
      expect.objectContaining({
        signal: expect.any(Object),
      })
    );
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchWithAuthMock.mock.calls[0] as [string, ShortPulseFetchInit];
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      "Content-Type": "image/png",
    });
    expect(options.shortpulseRetryNetworkOnce).toBe(true);
    expect(options.body).toBeTruthy();
    expect((options.body as Blob).constructor?.name).toBe("Blob");
    expect((options.body as Blob).type).toBe("image/png");
  });

  it("reuses remembered expert edit blobs without re-fetching the object url", async () => {
    const localUrl = "blob:expert-edit-flattened";
    const rememberedBlob = new Blob(["flattened"], { type: "image/png" });
    rememberObjectUrlBlob(localUrl, rememberedBlob);
    global.fetch = vi.fn() as typeof fetch;
    fetchWithAuthMock.mockResolvedValue(
      jsonResponse({
        url: "https://example.com/signed/reference-flattened.png",
        path: "user/images/reference-flattened.png",
        size: rememberedBlob.size,
      })
    );

    const signedUrl = await uploadImageToStorage(localUrl);

    expect(signedUrl).toBe("https://example.com/signed/reference-flattened.png");
    expect(global.fetch).not.toHaveBeenCalled();
    const [, options] = fetchWithAuthMock.mock.calls[0] as [string, ShortPulseFetchInit];
    expect((options.body as Blob).size).toBe(rememberedBlob.size);
  });

  it("uploads the transcode result when local preprocessing returns a resized blob", async () => {
    const localUrl = "blob:reference-1-transcoded";
    const imageBlob = new Blob(["image-data"], { type: "image/png" });
    const transcodedBlob = new Blob(["encoded-image"], { type: "image/webp" });
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(imageBlob, { headers: { "Content-Type": "image/png" } })
      ) as typeof fetch;
    maybeTranscodeLocalImageBlobForUploadMock.mockResolvedValueOnce(transcodedBlob);
    fetchWithAuthMock.mockResolvedValue(
      jsonResponse({
        url: "https://example.com/signed/reference-1.webp",
        path: "user/images/reference-1.webp",
        size: transcodedBlob.size,
      })
    );

    const signedUrl = await uploadImageToStorage(localUrl);

    expect(signedUrl).toBe("https://example.com/signed/reference-1.webp");
    expect(maybeTranscodeLocalImageBlobForUploadMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchWithAuthMock.mock.calls[0] as [string, ShortPulseFetchInit];
    expect(options.headers).toMatchObject({
      "Content-Type": "image/webp",
    });
    expect((options.body as Blob).type).toBe("image/webp");
  });

  it("falls back to image/jpeg when source blob has no image mime type", async () => {
    const localUrl = "blob:reference-2";
    const unknownBlob = new Blob(["binary-data"]);
    global.fetch = vi.fn().mockResolvedValue(new Response(unknownBlob)) as typeof fetch;
    fetchWithAuthMock.mockResolvedValue(
      jsonResponse({
        url: "https://example.com/signed/reference-2.jpg",
        path: "user/images/reference-2.jpg",
        size: unknownBlob.size,
      })
    );

    await uploadImageToStorage(localUrl);

    const [, options] = fetchWithAuthMock.mock.calls[0] as [string, ShortPulseFetchInit];
    expect(options.headers).toMatchObject({
      "Content-Type": "image/jpeg",
    });
  });

  it("reuses cached signed URLs for blob references", async () => {
    const localUrl = "blob:cached-reference";
    const imageBlob = new Blob(["cached-data"], { type: "image/webp" });
    global.fetch = vi.fn().mockResolvedValue(new Response(imageBlob)) as typeof fetch;
    fetchWithAuthMock.mockResolvedValue(
      jsonResponse({
        url: "https://example.com/signed/cached.webp",
        path: "user/images/cached.webp",
        size: imageBlob.size,
      })
    );

    const first = await uploadImageToStorage(localUrl);
    const second = await uploadImageToStorage(localUrl);

    expect(first).toBe("https://example.com/signed/cached.webp");
    expect(second).toBe(first);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
  });

  it("uploads local/provider-inaccessible image urls and passes through public urls", async () => {
    expect(needsImageUpload("blob:reference")).toBe(true);
    expect(needsImageUpload("data:image/png;base64,abc")).toBe(true);
    expect(needsImageUpload("/media/local-reference.png")).toBe(true);
    expect(needsImageUpload("http://localhost:3000/local-reference.png")).toBe(true);
    expect(needsImageUpload("http://127.0.0.1:3000/local-reference.png")).toBe(true);
    expect(needsImageUpload("https://example.com/image.png")).toBe(false);
    expect(needsImageUpload(null)).toBe(false);

    await expect(
      prepareImageUrlForSubmission("https://example.com/already-public.png")
    ).resolves.toBe("https://example.com/already-public.png");
    expect(getSignedMediaUrlMock).not.toHaveBeenCalled();
  });

  it("refreshes expiring Supabase signed URLs before submission", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const expSoon = Math.floor(Date.now() / 1000) + 120;
    const payload = Buffer.from(
      JSON.stringify({
        url: "media_library/user-1/images/ref.png",
        exp: expSoon,
      })
    ).toString("base64url");
    const token = `header.${payload}.sig`;
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/images/ref.png" +
      `?token=${token}`;

    await expect(prepareImageUrlForSubmission(signedUrl)).resolves.toBe(
      "https://example.com/signed/refreshed.png"
    );
    expect(getSignedMediaUrlMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/images/ref.png",
      forceRefresh: true,
    });
  });

  it("passes through non-expiring Supabase signed URLs without refresh", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const expFuture = Math.floor(Date.now() / 1000) + 3600;
    const payload = Buffer.from(
      JSON.stringify({
        url: "media_library/user-1/images/ref.png",
        exp: expFuture,
      })
    ).toString("base64url");
    const token = `header.${payload}.sig`;
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/images/ref.png" +
      `?token=${token}`;

    await expect(prepareImageUrlForSubmission(signedUrl)).resolves.toBe(signedUrl);
    expect(getSignedMediaUrlMock).not.toHaveBeenCalled();
  });

  it("fails fast when an expiring Supabase signed URL cannot be refreshed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const expSoon = Math.floor(Date.now() / 1000) + 60;
    const payload = Buffer.from(
      JSON.stringify({
        url: "media_library/user-1/images/ref.png",
        exp: expSoon,
      })
    ).toString("base64url");
    const token = `header.${payload}.sig`;
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/images/ref.png" +
      `?token=${token}`;
    getSignedMediaUrlMock.mockResolvedValueOnce(null);

    await expect(prepareImageUrlForSubmission(signedUrl)).rejects.toThrow(
      "Reference URL expired and could not be refreshed"
    );
  });

  it("emits stage telemetry for prepare lifecycle", async () => {
    const stages: string[] = [];
    await expect(
      prepareImageUrlForSubmission("https://example.com/already-public.png", {
        onStage: (event) => {
          stages.push(`${event.stage}:${event.status}`);
        },
      })
    ).resolves.toBe("https://example.com/already-public.png");

    expect(stages).toEqual(["prepare_image_url:start", "prepare_image_url:success"]);
  });

  it("times out stalled upload route requests", async () => {
    vi.useFakeTimers();
    try {
      const localUrl = "blob:stalled-upload";
      const imageBlob = new Blob(["image-data"], { type: "image/png" });
      global.fetch = vi.fn().mockResolvedValue(new Response(imageBlob)) as typeof fetch;
      fetchWithAuthMock.mockImplementation(
        async (_input: unknown, init?: RequestInit) =>
          await new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => {
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true }
            );
            // unresolved unless the timeout-driven abort signal fires
          })
      );

      const pending = uploadImageToStorage(localUrl);
      const rejection = pending.catch((error) => error);
      await vi.advanceTimersByTimeAsync(46_000);
      const error = await rejection;
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain("upload_image_route timed out");
    } finally {
      vi.useRealTimers();
    }
  });

  it("surfaces a direct size-limit message for 413 upload failures", async () => {
    const localUrl = "blob:oversized-reference";
    const imageBlob = new Blob(["image-data"], { type: "image/png" });
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(imageBlob, { headers: { "Content-Type": "image/png" } })
      ) as typeof fetch;
    fetchWithAuthMock.mockResolvedValue(
      jsonResponse(
        {
          error: "Upload failed: file too large",
        },
        413
      )
    );

    await expect(uploadImageToStorage(localUrl)).rejects.toThrow(
      "Reference image is too large. ShortPulse accepts reference images up to 25 MB."
    );
  });

  it("maps local blob fetch failures to a re-add guidance message", async () => {
    const localUrl = "blob:missing-reference";
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as typeof fetch;

    await expect(uploadImageToStorage(localUrl)).rejects.toThrow(
      "Local reference image is no longer available. Please re-add it and try again."
    );
  });

  it("maps upload route network failures to a clearer message", async () => {
    const localUrl = "blob:upload-network-fail";
    const imageBlob = new Blob(["image-data"], { type: "image/png" });
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(imageBlob, { headers: { "Content-Type": "image/png" } })
      ) as typeof fetch;
    fetchWithAuthMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await expect(uploadImageToStorage(localUrl)).rejects.toThrow(
      "Network request failed while uploading the reference image."
    );
  });
});
