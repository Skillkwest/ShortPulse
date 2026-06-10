import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import {
  applySessionRestoreSignedUrls,
  buildSessionOutputSigningFingerprintById,
  collectSessionRestoreSigningPaths,
  resolveSessionRestoreReferenceSignedUrls,
  resolveSessionRestoreSignedMediaAuthority,
  resolveSessionRestoreSignedMediaAuthorityByMediaId,
  resolveSessionRestoreSignedUrls,
} from "../sessionRestoreMediaSigning";

const getSignedMediaUrlsBatchMock = vi.fn();
const mediaFilesQueryMock = vi.fn();
const generationPublicationsQueryMock = vi.fn();

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: (...args: unknown[]) => getSignedMediaUrlsBatchMock(...args),
}));

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ({
    from: (table: string) => {
      const queryState: Record<string, unknown> = {
        table,
        filters: [],
      };
      const builder = {
        select: (columns: string) => {
          queryState.columns = columns;
          return builder;
        },
        in: (...args: unknown[]) => mediaFilesQueryMock(...args),
        eq: (column: string, value: unknown) => {
          queryState.filters = [...(queryState.filters as unknown[]), { column, value }];
          return builder;
        },
        order: (column: string, options?: unknown) => {
          queryState.order = { column, options };
          return builder;
        },
        limit: (count: number) => {
          queryState.limit = count;
          if (table === "generation_publications") {
            return generationPublicationsQueryMock(queryState);
          }
          return Promise.resolve({ data: [], error: null });
        },
      };
      return builder;
    },
  }),
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
  beforeEach(() => {
    vi.clearAllMocks();
    mediaFilesQueryMock.mockResolvedValue({ data: [], error: null });
    generationPublicationsQueryMock.mockResolvedValue({ data: [], error: null });
  });

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

  it("can collect restore-preview paths without eager image full-quality signing", () => {
    const paths = collectSessionRestoreSigningPaths(
      [
        createOutput({
          id: "image-a",
          mode: "image",
          previewStoragePath: "user-1/images/image-a-thumb.png",
          fullStoragePath: "user-1/images/image-a-full.png",
        }),
        createOutput({
          id: "image-b",
          mode: "image",
          fullStoragePath: "user-1/images/image-b-full.png",
        }),
        createOutput({
          id: "video-a",
          mode: "video",
          previewPosterStoragePath: "user-1/videos/video-a-poster.jpg",
          fullStoragePath: "user-1/videos/video-a.mp4",
        }),
      ],
      {
        includeDetailFullQuality: false,
      }
    );

    expect(paths).toEqual([
      "user-1/images/image-a-thumb.png",
      "user-1/images/image-b-full.png",
      "user-1/videos/video-a-poster.jpg",
      "user-1/videos/video-a.mp4",
    ]);
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

  it("signs the primary image plus all ten restored reference slots", async () => {
    const refs = Array.from({ length: 11 }, (_, index) => ({
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: `user-1/images/ref-${index + 1}.png`,
    }));
    getSignedMediaUrlsBatchMock.mockResolvedValueOnce(
      new Map(refs.map((ref, index) => [ref.storagePath, `https://signed/ref-${index + 1}.png`]))
    );

    const resolved = await resolveSessionRestoreReferenceSignedUrls(refs);

    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "media_library",
        storagePaths: refs.map((ref) => ref.storagePath),
      })
    );
    expect(resolved).toEqual(refs.map((_, index) => `https://signed/ref-${index + 1}.png`));
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

  it("refreshes restored non-video result urls from durable signed authority", () => {
    const rows = [
      createOutput({
        id: "image-a",
        mode: "image",
        previewStoragePath: "user-1/images/image-a.png",
        fullStoragePath: "user-1/images/image-a.png",
        resultUrls: ["https://provider.test/image-a.png"],
      }),
    ];
    const signedByPath = new Map<string, string | null>([
      ["user-1/images/image-a.png", "https://signed/image-a.png"],
    ]);

    const result = applySessionRestoreSignedUrls(rows, signedByPath);

    expect(result.changed).toBe(true);
    expect(result.outputs[0]?.previewUrl).toBe("https://signed/image-a.png");
    expect(result.outputs[0]?.resultUrls).toEqual([
      "https://signed/image-a.png",
      "https://provider.test/image-a.png",
    ]);
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
    expect(result.outputs[0]?.previewUrl).toBe("https://signed/video-a.mp4");
    expect(result.outputs[0]?.previewPosterUrl).toBe("https://signed/poster_720.jpg");
    expect(result.outputs[0]?.resultUrls).toEqual(["https://signed/video-a.mp4"]);
    expect(result.outputs[0]?.previewStoragePath).toBe("user-1/generations/videos/video-a.mp4");
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
    expect(result.outputs[0]?.resultUrls).toEqual(["https://signed/video-b.mp4"]);
  });

  it("does not sign preview-loop video storage as a poster during session restore", () => {
    const rows = [
      createOutput({
        id: "video-preview-loop",
        mode: "video",
        previewStoragePath: "user-1/variants/videos/video-preview-loop/preview_loop_360p.mp4",
        fullStoragePath: "user-1/generations/videos/video-preview-loop.mp4",
      }),
    ];
    const signedByPath = new Map<string, string | null>([
      [
        "user-1/variants/videos/video-preview-loop/preview_loop_360p.mp4",
        "https://signed/preview-loop.mp4",
      ],
      ["user-1/generations/videos/video-preview-loop.mp4", "https://signed/video-preview-loop.mp4"],
    ]);

    const result = applySessionRestoreSignedUrls(rows, signedByPath);

    expect(result.changed).toBe(true);
    expect(result.outputs[0]?.previewUrl).toBe("https://signed/video-preview-loop.mp4");
    expect(result.outputs[0]?.previewPosterUrl).toBeNull();
    expect(result.outputs[0]?.previewPosterStoragePath).toBeNull();
    expect(result.outputs[0]?.resultUrls).toEqual(["https://signed/video-preview-loop.mp4"]);
  });

  it("keeps restored video hover playback on signed full URLs while preserving provider fallbacks", () => {
    const rows = [
      createOutput({
        id: "video-c",
        mode: "video",
        previewStoragePath: "user-1/variants/videos/video-c/poster_720.jpg",
        fullStoragePath: "user-1/generations/videos/video-c.mp4",
        resultUrls: ["https://provider.test/video-c.mp4"],
      }),
    ];
    const signedByPath = new Map<string, string | null>([
      ["user-1/variants/videos/video-c/poster_720.jpg", "https://signed/poster-c.jpg"],
      ["user-1/generations/videos/video-c.mp4", "https://signed/video-c.mp4"],
    ]);

    const result = applySessionRestoreSignedUrls(rows, signedByPath);

    expect(result.changed).toBe(true);
    expect(result.outputs[0]?.previewUrl).toBe("https://signed/video-c.mp4");
    expect(result.outputs[0]?.previewPosterUrl).toBe("https://signed/poster-c.jpg");
    expect(result.outputs[0]?.previewStoragePath).toBe("user-1/generations/videos/video-c.mp4");
    expect(result.outputs[0]?.resultUrls).toEqual([
      "https://signed/video-c.mp4",
      "https://provider.test/video-c.mp4",
    ]);
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

  it("recovers stripped storage authority from saved media ids during session restore", async () => {
    const rows = [
      createOutput({
        id: "library-1",
        mode: "image",
        mediaSource: "library",
        previewUrl: "https://stale.example.com/library.png",
        resultUrls: ["https://stale.example.com/library.png"],
        savedMediaIds: ["media-1"],
        saveState: "saved",
      }),
    ];
    mediaFilesQueryMock.mockResolvedValueOnce({
      data: [
        {
          id: "media-1",
          storage_path: "user-1/images/library.png",
          file_type: "image",
          poster_variant_path: null,
          thumb_variant_path: null,
          preview_variant_path: null,
        },
      ],
      error: null,
    });
    getSignedMediaUrlsBatchMock.mockResolvedValueOnce(
      new Map([["user-1/images/library.png", "https://signed/library.png"]])
    );

    const { signedByPath, recoveredAuthorityByOutputId } =
      await resolveSessionRestoreSignedMediaAuthority(rows);
    const result = applySessionRestoreSignedUrls(rows, signedByPath, {
      recoveredAuthorityById: recoveredAuthorityByOutputId,
    });

    expect(mediaFilesQueryMock).toHaveBeenCalledWith("id", ["media-1"]);
    expect(result.changed).toBe(true);
    expect(result.outputs[0]).toEqual(
      expect.objectContaining({
        previewUrl: "https://signed/library.png",
        previewStoragePath: "user-1/images/library.png",
        fullStoragePath: "user-1/images/library.png",
        resultUrls: ["https://signed/library.png", "https://stale.example.com/library.png"],
      })
    );
  });

  it("resolves signed restore authority directly from media ids", async () => {
    mediaFilesQueryMock.mockResolvedValueOnce({
      data: [
        {
          id: "media-canvas-1",
          storage_path: "user-1/images/canvas-full.png",
          file_type: "image",
          poster_variant_path: null,
          thumb_variant_path: "user-1/images/canvas-thumb.png",
          preview_variant_path: null,
        },
      ],
      error: null,
    });
    getSignedMediaUrlsBatchMock.mockResolvedValueOnce(
      new Map([
        ["user-1/images/canvas-thumb.png", "https://signed/canvas-thumb.png"],
        ["user-1/images/canvas-full.png", "https://signed/canvas-full.png"],
      ])
    );

    const authorityByMediaId = await resolveSessionRestoreSignedMediaAuthorityByMediaId([
      "media-canvas-1",
    ]);

    expect(mediaFilesQueryMock).toHaveBeenCalledWith("id", ["media-canvas-1"]);
    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: "media_library",
        storagePaths: ["user-1/images/canvas-thumb.png", "user-1/images/canvas-full.png"],
      })
    );
    expect(authorityByMediaId.get("media-canvas-1")).toEqual(
      expect.objectContaining({
        mediaId: "media-canvas-1",
        fileType: "image",
        previewStoragePath: "user-1/images/canvas-thumb.png",
        fullStoragePath: "user-1/images/canvas-full.png",
        signedPreviewUrl: "https://signed/canvas-thumb.png",
        signedFullUrl: "https://signed/canvas-full.png",
      })
    );
  });

  it("recovers stripped generated storage authority from generation identity during session restore", async () => {
    const rows = [
      createOutput({
        id: "generated-1",
        mode: "image",
        mediaSource: "generated",
        generationId: "generation-1",
        previewUrl: "https://stale.example.com/generated.png",
        resultUrls: ["https://stale.example.com/generated.png"],
        savedMediaIds: [],
      }),
    ];
    generationPublicationsQueryMock.mockResolvedValueOnce({
      data: [
        {
          owned_media_file_id: null,
          preview_storage_path: null,
          full_storage_path: "user-1/generations/images/generation-1/output.png",
          created_at: "2026-05-30T00:00:00.000Z",
        },
      ],
      error: null,
    });
    getSignedMediaUrlsBatchMock.mockResolvedValueOnce(
      new Map([
        ["user-1/generations/images/generation-1/output.png", "https://signed/generated.png"],
      ])
    );

    const { signedByPath, recoveredAuthorityByOutputId } =
      await resolveSessionRestoreSignedMediaAuthority(rows);
    const result = applySessionRestoreSignedUrls(rows, signedByPath, {
      recoveredAuthorityById: recoveredAuthorityByOutputId,
    });

    expect(generationPublicationsQueryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        table: "generation_publications",
        limit: 50,
      })
    );
    expect(result.changed).toBe(true);
    expect(result.outputs[0]).toEqual(
      expect.objectContaining({
        previewUrl: "https://signed/generated.png",
        previewStoragePath: "user-1/generations/images/generation-1/output.png",
        fullStoragePath: "user-1/generations/images/generation-1/output.png",
        resultUrls: ["https://signed/generated.png", "https://stale.example.com/generated.png"],
      })
    );
  });
});
