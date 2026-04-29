import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import {
  applySessionRestoreSignedUrls,
  buildSessionOutputSigningFingerprintById,
  collectSessionRestoreSigningPaths,
  resolveSessionRestoreSignedUrls,
} from "../sessionRestoreMediaSigning";

const getSignedMediaUrlsBatchMock = vi.fn();

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: (...args: unknown[]) => getSignedMediaUrlsBatchMock(...args),
}));

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "now",
  ...overrides,
});

describe("sessionRestoreMediaSigning", () => {
  it("collects unique canonical signing paths", () => {
    const paths = collectSessionRestoreSigningPaths([
      createOutput({
        id: "a",
        previewStoragePath: "/user-1/images/a.png",
      }),
      createOutput({
        id: "b",
        fullStoragePath: "user-1/images/b.png",
      }),
      createOutput({
        id: "c",
        previewStoragePath: "https://example.com/not-storage.png",
      }),
    ]);

    expect(paths).toEqual(["user-1/images/a.png", "user-1/images/b.png"]);
  });

  it("resolves signed URLs for restore paths", async () => {
    const signedMap = new Map<string, string | null>([
      ["user-1/images/a.png", "https://signed/a.png"],
    ]);
    getSignedMediaUrlsBatchMock.mockResolvedValueOnce(signedMap);

    const resolved = await resolveSessionRestoreSignedUrls([
      createOutput({
        id: "a",
        previewStoragePath: "user-1/images/a.png",
      }),
    ]);

    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "media_library",
        storagePaths: ["user-1/images/a.png"],
      })
    );
    expect(resolved).toBe(signedMap);
  });

  it("applies signed preview urls when storage paths are present", () => {
    const rows = [
      createOutput({
        id: "a",
        previewStoragePath: "user-1/images/a.png",
        previewUrl: undefined,
      }),
    ];
    const signedByPath = new Map<string, string | null>([
      ["user-1/images/a.png", "https://signed/a.png"],
    ]);

    const result = applySessionRestoreSignedUrls(rows, signedByPath);

    expect(result.changed).toBe(true);
    expect(result.outputs[0]?.previewUrl).toBe("https://signed/a.png");
  });

  it("applies signed poster urls for restored videos with distinct poster storage", () => {
    const rows = [
      createOutput({
        id: "video-a",
        mode: "video",
        previewStoragePath: "user-1/variants/videos/video-a/poster_720.jpg",
        fullStoragePath: "user-1/generations/videos/video-a.mp4",
        previewUrl: "https://provider.test/video-a.mp4",
      }),
    ];
    const signedByPath = new Map<string, string | null>([
      ["user-1/variants/videos/video-a/poster_720.jpg", "https://signed/poster_720.jpg"],
      ["user-1/generations/videos/video-a.mp4", "https://signed/video-a.mp4"],
    ]);

    const result = applySessionRestoreSignedUrls(rows, signedByPath);

    expect(result.changed).toBe(true);
    expect(result.outputs[0]?.previewUrl).toBe("https://signed/poster_720.jpg");
    expect(result.outputs[0]?.previewPosterUrl).toBe("https://signed/poster_720.jpg");
    expect(result.outputs[0]?.resultUrls).toBeUndefined();
    expect(result.outputs[0]?.fullStoragePath).toBe("user-1/generations/videos/video-a.mp4");
  });

  it("signs explicit poster storage independently from video preview storage", () => {
    const rows = [
      createOutput({
        id: "video-b",
        mode: "video",
        previewStoragePath: "user-1/generations/videos/video-b.mp4",
        previewPosterStoragePath: "user-1/variants/videos/video-b/poster_720.jpg",
        fullStoragePath: "user-1/generations/videos/video-b.mp4",
      }),
    ];
    const signedByPath = new Map<string, string | null>([
      ["user-1/variants/videos/video-b/poster_720.jpg", "https://signed/poster-b.jpg"],
      ["user-1/generations/videos/video-b.mp4", "https://signed/video-b.mp4"],
    ]);

    const result = applySessionRestoreSignedUrls(rows, signedByPath);

    expect(result.changed).toBe(true);
    expect(result.outputs[0]?.previewUrl).toBe("https://signed/video-b.mp4");
    expect(result.outputs[0]?.previewPosterUrl).toBe("https://signed/poster-b.jpg");
    expect(result.outputs[0]?.previewPosterStoragePath).toBe(
      "user-1/variants/videos/video-b/poster_720.jpg"
    );
  });

  it("skips apply when baseline fingerprint no longer matches", () => {
    const baselineRows = [
      createOutput({
        id: "a",
        previewStoragePath: "user-1/images/a.png",
        previewUrl: "blob:local-a",
      }),
    ];
    const currentRows = [
      createOutput({
        id: "a",
        previewStoragePath: "user-1/images/a.png",
        previewUrl: "blob:local-newer",
      }),
    ];
    const signedByPath = new Map<string, string | null>([
      ["user-1/images/a.png", "https://signed/a.png"],
    ]);

    const result = applySessionRestoreSignedUrls(currentRows, signedByPath, {
      baselineById: buildSessionOutputSigningFingerprintById(baselineRows),
    });

    expect(result.changed).toBe(false);
    expect(result.outputs[0]?.previewUrl).toBe("blob:local-newer");
  });
});
