/**
 * Upload helper tests for AI Studio image references.
 * Ensures local images are sent as raw image bytes with explicit content type.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithAuthMock = vi.fn();
const getSignedMediaUrlMock = vi.fn();

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));
vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: (...args: unknown[]) => getSignedMediaUrlMock(...args),
}));

import {
  needsImageUpload,
  prepareImageUrlForSubmission,
  uploadImageToStorage,
} from "../imageUpload";

const originalFetch = global.fetch;

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("imageUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSignedMediaUrlMock.mockResolvedValue("https://example.com/signed/refreshed.png");
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
    expect(global.fetch).toHaveBeenCalledWith(localUrl);
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchWithAuthMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      "Content-Type": "image/png",
    });
    expect(options.body).toBeTruthy();
    expect((options.body as Blob).constructor?.name).toBe("Blob");
    expect((options.body as Blob).type).toBe("image/png");
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

    const [, options] = fetchWithAuthMock.mock.calls[0] as [string, RequestInit];
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

  it("only uploads blob and data image urls", async () => {
    expect(needsImageUpload("blob:reference")).toBe(true);
    expect(needsImageUpload("data:image/png;base64,abc")).toBe(true);
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
});
