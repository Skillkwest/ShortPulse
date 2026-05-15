import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  hydrateMediaPreviewViaStorageDownload,
  resolveAndApplySignedPreviewUrlsByRows,
  signMediaStoragePath,
} from "../mediaPreviewRuntimeShared";

const {
  mockGetSignedMediaUrl,
  mockResolveMediaSigningStoragePaths,
  mockResolveMediaPreviewCandidates,
  mockCreateMediaPerfTimer,
} = vi.hoisted(() => ({
  mockGetSignedMediaUrl: vi.fn(async () => null as string | null),
  mockResolveMediaSigningStoragePaths: vi.fn(() => [] as string[]),
  mockResolveMediaPreviewCandidates: vi.fn((row: { storage_path?: string | null }) => ({
    storagePaths: mockResolveMediaSigningStoragePaths(row),
    directUrl: null as string | null,
  })),
  mockCreateMediaPerfTimer: vi.fn(),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: mockGetSignedMediaUrl,
}));

vi.mock("../../../../lib/mediaPerfTelemetry", () => ({
  createMediaPerfTimer: mockCreateMediaPerfTimer,
}));

vi.mock("../../../../lib/mediaPreviewPath", () => ({
  classifyMediaPreviewPath: vi.fn(() => "unknown"),
  resolveMediaPreviewCandidates: mockResolveMediaPreviewCandidates,
}));

describe("mediaPreviewRuntimeShared", () => {
  beforeEach(() => {
    mockGetSignedMediaUrl.mockReset();
    mockGetSignedMediaUrl.mockResolvedValue(null);
    mockResolveMediaSigningStoragePaths.mockReset();
    mockResolveMediaSigningStoragePaths.mockReturnValue([]);
    mockResolveMediaPreviewCandidates.mockReset();
    mockResolveMediaPreviewCandidates.mockImplementation(
      (row: { storage_path?: string | null }) => ({
        storagePaths: mockResolveMediaSigningStoragePaths(row),
        directUrl: null as string | null,
      })
    );
    mockCreateMediaPerfTimer.mockReset();
    mockCreateMediaPerfTimer.mockReturnValue(vi.fn());
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

  it("applies trusted direct preview urls locally before calling resolve-previews", async () => {
    mockResolveMediaPreviewCandidates.mockImplementation(
      (row: { id?: string; storage_path?: string | null; thumb_variant_path?: string | null }) => ({
        storagePaths: row.storage_path ? [row.storage_path] : [],
        directUrl: row.id === "media-1" ? (row.thumb_variant_path ?? null) : null,
      })
    );
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        urls: {
          "media-2": "https://signed.example.com/media-2.png",
        },
      }),
    }));
    const applySignedUrlsToTab = vi.fn();
    const rowWithDirectUrl = {
      id: "media-1",
      storage_path: "user-1/images/media-1.png",
      file_type: "image/png",
      thumb_variant_path: "https://cdn.example.test/media_library/user-1/images/media-1.png",
    };

    const unresolved = await resolveAndApplySignedPreviewUrlsByRows({
      tab: "uploaded_images",
      rows: [rowWithDirectUrl, { id: "media-2" }],
      applySignedUrlsToTab,
      currentUserId: "user-1",
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/media/resolve-previews",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          ids: ["media-2"],
          expiresInSeconds: 3600,
          surface: undefined,
        }),
      })
    );
    expect(applySignedUrlsToTab).toHaveBeenNthCalledWith(
      1,
      "uploaded_images",
      new Map([["media-1", "https://cdn.example.test/media_library/user-1/images/media-1.png"]])
    );
    expect(applySignedUrlsToTab).toHaveBeenNthCalledWith(
      2,
      "uploaded_images",
      new Map([["media-2", "https://signed.example.com/media-2.png"]])
    );
    expect(Array.from(unresolved.values())).toEqual([]);
  });

  it("prefers local cached signing on media-library browse surfaces before resolve-previews", async () => {
    mockResolveMediaPreviewCandidates.mockImplementation(
      (row: { id?: string; storage_path?: string | null }) => ({
        storagePaths: row.storage_path ? [row.storage_path] : [],
        directUrl: null,
      })
    );
    mockGetSignedMediaUrl.mockImplementation(async (...args: unknown[]) => {
      const [{ storagePath }] = args as [{ storagePath: string }];
      return storagePath === "user-1/images/media-1.png"
        ? "https://signed.example.com/media-1.png"
        : null;
    });
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        urls: {
          "media-2": "https://signed.example.com/media-2.png",
        },
      }),
    }));
    const applySignedUrlsToTab = vi.fn();

    const unresolved = await resolveAndApplySignedPreviewUrlsByRows({
      tab: "uploaded_images",
      rows: [
        { id: "media-1", storage_path: "user-1/images/media-1.png" },
        { id: "media-2", storage_path: "user-1/images/media-2.png" },
      ],
      applySignedUrlsToTab,
      currentUserId: "user-1",
      surface: "media-library-panel",
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/media/resolve-previews",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          ids: ["media-2"],
          expiresInSeconds: 3600,
          surface: "media-library-panel",
        }),
      })
    );
    expect(applySignedUrlsToTab).toHaveBeenNthCalledWith(
      1,
      "uploaded_images",
      new Map([["media-1", "https://signed.example.com/media-1.png"]])
    );
    expect(applySignedUrlsToTab).toHaveBeenNthCalledWith(
      2,
      "uploaded_images",
      new Map([["media-2", "https://signed.example.com/media-2.png"]])
    );
    expect(Array.from(unresolved.values())).toEqual([]);
  });

  it("hydrates preview via storage-download fallback using candidate ordering", async () => {
    mockResolveMediaSigningStoragePaths.mockReturnValue(["path/first.png", "path/second.png"]);
    const finishFallback = vi.fn();
    mockCreateMediaPerfTimer.mockReturnValue(finishFallback);
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
        surface: "media-library-panel",
        downloadFromStoragePath,
        applyObjectUrlForRow,
      });

      expect(result).toBe("blob:second");
      expect(downloadFromStoragePath).toHaveBeenNthCalledWith(1, "path/first.png");
      expect(downloadFromStoragePath).toHaveBeenNthCalledWith(2, "path/second.png");
      expect(applyObjectUrlForRow).toHaveBeenCalledWith(row, "blob:second");
      expect(objectUrlSpy).toHaveBeenCalledTimes(1);
      expect(mockCreateMediaPerfTimer).toHaveBeenCalledWith({
        surface: "media-library-panel",
        candidate_count: 2,
      });
      expect(finishFallback).toHaveBeenCalledWith("media.storage_download_fallback.completed", {
        succeeded_count: 1,
        failed_count: 0,
      });
    } finally {
      objectUrlSpy.mockRestore();
    }
  });

  it("returns null when no storage-download candidate resolves", async () => {
    mockResolveMediaSigningStoragePaths.mockReturnValue(["path/first.png"]);
    const finishFallback = vi.fn();
    mockCreateMediaPerfTimer.mockReturnValue(finishFallback);
    const objectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:unused");
    const downloadFromStoragePath = vi.fn(async () => null);
    const applyObjectUrlForRow = vi.fn();

    try {
      const result = await hydrateMediaPreviewViaStorageDownload({
        row: { id: "media-2", storage_path: "path/first.png", file_type: "image/png" },
        currentUserId: "user-1",
        surface: "media-library-route",
        downloadFromStoragePath,
        applyObjectUrlForRow,
      });

      expect(result).toBeNull();
      expect(applyObjectUrlForRow).not.toHaveBeenCalled();
      expect(objectUrlSpy).not.toHaveBeenCalled();
      expect(finishFallback).toHaveBeenCalledWith("media.storage_download_fallback.failed", {
        succeeded_count: 0,
        failed_count: 1,
      });
    } finally {
      objectUrlSpy.mockRestore();
    }
  });
});
