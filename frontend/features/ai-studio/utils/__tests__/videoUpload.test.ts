/**
 * Upload helper tests for AI Studio motion-reference videos.
 * Ensures recorded clips use browser-direct storage upload before final staging.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchWithAuthMock = vi.fn();
const uploadToSignedUrlMock = vi.fn();

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ({
    storage: {
      from: vi.fn(() => ({
        uploadToSignedUrl: (...args: unknown[]) => uploadToSignedUrlMock(...args),
      })),
    },
  }),
}));

import {
  deleteUploadedMotionVideoByPath,
  needsMotionReferenceVideoProviderNormalization,
  prepareMotionReferenceVideoUrl,
  retireCommittedMotionVideoByUrl,
  uploadVideoAssetToStorage,
  uploadVideoFileToStorage,
} from "../videoUpload";
import { forgetObjectUrlBlob, rememberObjectUrlBlob } from "../objectUrlBlobRegistry";

const jsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

describe("videoUpload", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    uploadToSignedUrlMock.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    forgetObjectUrlBlob("blob:missing-motion-reference");
    forgetObjectUrlBlob("blob:remembered-motion-reference");
  });

  it("stages recorded WebM files through browser-direct motion-reference upload", async () => {
    const file = new File(["recorded-video"], "motion-reference.webm", {
      type: "video/webm;codecs=vp9,opus",
    });
    fetchWithAuthMock
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            storagePath: "user-1/upload-staging/videos/motion-control/ref.webm",
            uploadToken: "upload-token",
            mimeType: "video/webm",
            name: "motion-reference.webm",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          url: "https://signed.example/motion-reference.mp4",
          path: "user-1/videos/motion-control/ref.mp4",
          size: 1024,
          mimeType: "video/mp4",
          name: "motion-reference.mp4",
        })
      );

    const uploaded = await uploadVideoFileToStorage(file);

    expect(uploaded).toEqual({
      url: "https://signed.example/motion-reference.mp4",
      path: "user-1/videos/motion-control/ref.mp4",
      size: 1024,
      mimeType: "video/mp4",
      name: "motion-reference.mp4",
    });
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      1,
      "/api/media/prepare-motion-reference-video-upload",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        shortpulseRetryNetworkOnce: true,
      })
    );
    expect(JSON.parse(String(fetchWithAuthMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      sourceMimeType: "video/webm",
      sourceName: expect.stringMatching(/^motion-reference-\d+-[a-z0-9]+\.webm$/),
    });
    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/upload-staging/videos/motion-control/ref.webm",
      "upload-token",
      file,
      expect.objectContaining({
        contentType: "video/webm",
        upsert: false,
      })
    );
    expect(fetchWithAuthMock).toHaveBeenNthCalledWith(
      2,
      "/api/media/stage-motion-reference-video",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        shortpulseRetryNetworkOnce: true,
      })
    );
    expect(JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      sourceMimeType: "video/webm",
      sourceName: "motion-reference.webm",
      sourceStoragePath: "user-1/upload-staging/videos/motion-control/ref.webm",
    });
  });

  it("infers motion-reference MIME type from filename when browsers omit file.type", async () => {
    const file = new File(["recorded-video"], "motion-reference.webm", { type: "" });
    fetchWithAuthMock
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            storagePath: "user-1/upload-staging/videos/motion-control/ref.webm",
            uploadToken: "upload-token",
            mimeType: "video/webm",
            name: "motion-reference.webm",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          url: "https://signed.example/motion-reference.mp4",
          path: "user-1/videos/motion-control/ref.mp4",
          size: 1024,
          mimeType: "video/mp4",
          name: "motion-reference.mp4",
        })
      );

    await uploadVideoFileToStorage(file);

    expect(JSON.parse(String(fetchWithAuthMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      sourceMimeType: "video/webm",
      sourceName: expect.stringMatching(/^motion-reference-\d+-[a-z0-9]+\.webm$/),
    });
    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/upload-staging/videos/motion-control/ref.webm",
      "upload-token",
      file,
      expect.objectContaining({
        contentType: "video/webm",
        upsert: false,
      })
    );
    expect(JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      sourceMimeType: "video/webm",
      sourceName: "motion-reference.webm",
      sourceStoragePath: "user-1/upload-staging/videos/motion-control/ref.webm",
    });
  });

  it("infers URL-staged motion-reference MIME type from extension when fetched blobs omit type", async () => {
    const remoteBlob = new Blob(["remote-video"], { type: "" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => remoteBlob,
      }))
    );
    fetchWithAuthMock
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            storagePath: "user-1/upload-staging/videos/motion-control/ref.webm",
            uploadToken: "upload-token",
            mimeType: "video/webm",
            name: "motion-reference.webm",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          url: "https://signed.example/motion-reference.mp4",
          path: "user-1/videos/motion-control/ref.mp4",
          size: 1024,
          mimeType: "video/mp4",
          name: "motion-reference.mp4",
        })
      );

    await uploadVideoAssetToStorage("https://cdn.example.com/motion-reference.webm");

    expect(JSON.parse(String(fetchWithAuthMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      sourceMimeType: "video/webm",
      sourceName: expect.stringMatching(/^motion-reference-\d+-[a-z0-9]+\.webm$/),
    });
    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/upload-staging/videos/motion-control/ref.webm",
      "upload-token",
      remoteBlob,
      expect.objectContaining({
        contentType: "video/webm",
        upsert: false,
      })
    );
    expect(JSON.parse(String(fetchWithAuthMock.mock.calls[1]?.[1]?.body))).toMatchObject({
      sourceMimeType: "video/webm",
      sourceName: "motion-reference.webm",
      sourceStoragePath: "user-1/upload-staging/videos/motion-control/ref.webm",
    });
  });

  it("rejects blob motion-reference URLs that no longer have Blob authority", async () => {
    const fetchMock = vi.fn();
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    await expect(uploadVideoAssetToStorage("blob:missing-motion-reference")).rejects.toThrow(
      "Local motion reference video is no longer available"
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(uploadToSignedUrlMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith("Video upload error:", expect.any(Error));
  });

  it("stages remembered blob motion-reference URLs without fetching the object URL", async () => {
    const rememberedBlob = new Blob(["remembered-video"], { type: "video/webm" });
    rememberObjectUrlBlob("blob:remembered-motion-reference", rememberedBlob);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchWithAuthMock
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            storagePath: "user-1/upload-staging/videos/motion-control/remembered.webm",
            uploadToken: "upload-token",
            mimeType: "video/webm",
            name: "motion-reference.webm",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          url: "https://signed.example/remembered-motion-reference.mp4",
          path: "user-1/videos/motion-control/remembered.mp4",
          size: 1024,
          mimeType: "video/mp4",
          name: "motion-reference.mp4",
        })
      );

    const uploaded = await uploadVideoAssetToStorage("blob:remembered-motion-reference");

    expect(uploaded.url).toBe("https://signed.example/remembered-motion-reference.mp4");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/upload-staging/videos/motion-control/remembered.webm",
      "upload-token",
      rememberedBlob,
      expect.objectContaining({
        contentType: "video/webm",
        upsert: false,
      })
    );
  });

  it("normalizes hosted MP4 URLs that have not already passed through Motion Control storage", async () => {
    const remoteBlob = new Blob(["remote-mp4"], { type: "video/mp4" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        blob: async () => remoteBlob,
      }))
    );
    fetchWithAuthMock
      .mockResolvedValueOnce(
        jsonResponse({
          target: {
            storagePath: "user-1/upload-staging/videos/motion-control/ref.mp4",
            uploadToken: "upload-token",
            mimeType: "video/mp4",
            name: "motion-reference.mp4",
          },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          url: "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/ref.mp4?token=fresh",
          path: "user-1/videos/motion-control/ref.mp4",
          size: 2048,
          mimeType: "video/mp4",
          name: "motion-reference.mp4",
        })
      );

    const prepared = await prepareMotionReferenceVideoUrl(
      "https://cdn.example.com/library/motion-reference.mp4"
    );

    expect(prepared).toBe(
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/ref.mp4?token=fresh"
    );
    expect(JSON.parse(String(fetchWithAuthMock.mock.calls[0]?.[1]?.body))).toMatchObject({
      sourceMimeType: "video/mp4",
      sourceName: expect.stringMatching(/^motion-reference-\d+-[a-z0-9]+\.mp4$/),
    });
    expect(uploadToSignedUrlMock).toHaveBeenCalledWith(
      "user-1/upload-staging/videos/motion-control/ref.mp4",
      "upload-token",
      remoteBlob,
      expect.objectContaining({
        contentType: "video/mp4",
        upsert: false,
      })
    );
  });

  it("requires provider normalization for non-canonical hosted motion-reference URLs", () => {
    expect(
      needsMotionReferenceVideoProviderNormalization("https://signed.example/motion-reference.webm")
    ).toBe(true);
    expect(
      needsMotionReferenceVideoProviderNormalization(
        "https://signed.example/motion-reference?mimeType=video%2Fwebm"
      )
    ).toBe(true);
    expect(
      needsMotionReferenceVideoProviderNormalization("https://signed.example/motion-reference.mp4")
    ).toBe(true);
    expect(
      needsMotionReferenceVideoProviderNormalization("https://signed.example/motion-reference.mov")
    ).toBe(true);
    expect(
      needsMotionReferenceVideoProviderNormalization(
        "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/ref.mp4?token=fresh"
      )
    ).toBe(false);
  });

  it("cleans stale motion-reference uploads through the canonical media route", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await deleteUploadedMotionVideoByPath("user-1/videos/motion-control/stale.mp4");

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/stage-motion-reference-video",
      expect.objectContaining({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "user-1/videos/motion-control/stale.mp4",
          mode: "stale",
        }),
      })
    );
  });

  it("retires committed motion-reference uploads through the canonical media route", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    await retireCommittedMotionVideoByUrl(
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion-control/committed.mp4?token=fresh"
    );

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/stage-motion-reference-video",
      expect.objectContaining({
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "user-1/videos/motion-control/committed.mp4",
          mode: "retire",
        }),
      })
    );
  });

  it("does not retire legacy motion-reference urls without a user-scoped storage path", async () => {
    await retireCommittedMotionVideoByUrl(
      "https://example.supabase.co/storage/v1/object/sign/media_library/videos/motion-control/legacy.mp4?token=fresh"
    );

    expect(fetchWithAuthMock).not.toHaveBeenCalled();
  });
});
