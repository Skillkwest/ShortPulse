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
