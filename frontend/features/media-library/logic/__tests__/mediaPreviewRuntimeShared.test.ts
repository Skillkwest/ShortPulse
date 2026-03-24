import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hydrateMediaPreviewViaStorageDownload,
  resolveAndApplySignedPreviewUrlsByRows,
  signMediaStoragePath,
} from "../mediaPreviewRuntimeShared";

const { mockGetSignedMediaUrl, mockResolveMediaSigningStoragePaths } = vi.hoisted(() => ({
  mockGetSignedMediaUrl: vi.fn(async () => null as string | null),
  mockResolveMediaSigningStoragePaths: vi.fn(() => [] as string[]),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: mockGetSignedMediaUrl,
}));

vi.mock("../../../../lib/mediaPreviewPath", () => ({
  classifyMediaPreviewPath: vi.fn(() => "unknown"),
  resolveMediaSigningStoragePaths: mockResolveMediaSigningStoragePaths,
}));

describe("mediaPreviewRuntimeShared", () => {
  beforeEach(() => {
    mockGetSignedMediaUrl.mockReset();
    mockGetSignedMediaUrl.mockResolvedValue(null);
    mockResolveMediaSigningStoragePaths.mockReset();
    mockResolveMediaSigningStoragePaths.mockReturnValue([]);
  });

  it("signs storage paths through shared media bucket contract", async () => {
    mockGetSignedMediaUrl.mockResolvedValue("https://signed.example.com/media.png");

    const result = await signMediaStoragePath("user-1/upload/media.png", { forceRefresh: true });

    expect(result).toBe("https://signed.example.com/media.png");
    expect(mockGetSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/upload/media.png",
      expiresInSeconds: 3600,
      forceRefresh: true,
      previewProfile: "none",
    });
  });

  it("resolves and applies signed preview urls while returning unresolved ids", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        urls: {
          "media-1": "https://signed.example.com/media-1.png",
          "media-2": null,
        },
      }),
    }));
    const applySignedUrlsToTab = vi.fn();

    const unresolved = await resolveAndApplySignedPreviewUrlsByRows({
      tab: "uploaded_images",
      rows: [{ id: "media-1" }, { id: "media-2" }, { id: "media-1" }],
      applySignedUrlsToTab,
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/media/resolve-previews",
      expect.objectContaining({ method: "POST" })
    );
    expect(applySignedUrlsToTab).toHaveBeenCalledWith(
      "uploaded_images",
      new Map([["media-1", "https://signed.example.com/media-1.png"]])
    );
    expect(Array.from(unresolved.values())).toEqual(["media-2"]);
  });

  it("hydrates preview via storage-download fallback using candidate ordering", async () => {
    mockResolveMediaSigningStoragePaths.mockReturnValue(["path/first.png", "path/second.png"]);
    const objectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:second");
    const downloadFromStoragePath = vi
      .fn<(storagePath: string) => Promise<Blob | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new Blob(["media-bytes"]));
    const applyObjectUrlForRow = vi.fn();
    const row = { id: "media-1", storage_path: "path/second.png", file_type: "image/png" };

    try {
      const result = await hydrateMediaPreviewViaStorageDownload({
        row,
        currentUserId: "user-1",
        downloadFromStoragePath,
        applyObjectUrlForRow,
      });

      expect(result).toBe("blob:second");
      expect(downloadFromStoragePath).toHaveBeenNthCalledWith(1, "path/first.png");
      expect(downloadFromStoragePath).toHaveBeenNthCalledWith(2, "path/second.png");
      expect(applyObjectUrlForRow).toHaveBeenCalledWith(row, "blob:second");
      expect(objectUrlSpy).toHaveBeenCalledTimes(1);
    } finally {
      objectUrlSpy.mockRestore();
    }
  });

  it("returns null when no storage-download candidate resolves", async () => {
    mockResolveMediaSigningStoragePaths.mockReturnValue(["path/first.png"]);
    const objectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:unused");
    const downloadFromStoragePath = vi.fn(async () => null);
    const applyObjectUrlForRow = vi.fn();

    try {
      const result = await hydrateMediaPreviewViaStorageDownload({
        row: { id: "media-2", storage_path: "path/first.png", file_type: "image/png" },
        currentUserId: "user-1",
        downloadFromStoragePath,
        applyObjectUrlForRow,
      });

      expect(result).toBeNull();
      expect(applyObjectUrlForRow).not.toHaveBeenCalled();
      expect(objectUrlSpy).not.toHaveBeenCalled();
    } finally {
      objectUrlSpy.mockRestore();
    }
  });
});
