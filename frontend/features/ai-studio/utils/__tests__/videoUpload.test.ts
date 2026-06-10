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
  needsMotionReferenceVideoProviderNormalization,
  uploadVideoAssetToStorage,
  uploadVideoFileToStorage,
} from "../videoUpload";

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

  it("requires provider normalization for hosted WebM motion-reference URLs", () => {
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
    ).toBe(false);
    expect(
      needsMotionReferenceVideoProviderNormalization("https://signed.example/motion-reference.mov")
    ).toBe(false);
  });
});
