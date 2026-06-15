import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { resolveVideoPosterRepairsForOutputs } from "../videoPosterRepair";

const ensureSupabaseQueryClientMock = vi.hoisted(() => vi.fn());
const getSignedMediaUrlsBatchMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: getSignedMediaUrlsBatchMock,
}));

const makeOutput = (overrides: Partial<StudioOutput>): StudioOutput => ({
  id: "out-1",
  prompt: "",
  mode: "video",
  aspect: "16:9",
  model: "test-model",
  status: "ready",
  timestamp: "2026-04-30T00:00:00.000Z",
  ...overrides,
});

const createMediaRowsBuilder = (rows: unknown[]) => {
  const builder = {
    in: vi.fn(),
    limit: vi.fn(),
  };
  builder.in.mockReturnValue(builder);
  builder.limit.mockResolvedValue({ data: rows, error: null });
  return builder;
};

const mockMediaRows = (rows: unknown[]) => {
  const builders: ReturnType<typeof createMediaRowsBuilder>[] = [];
  ensureSupabaseQueryClientMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table !== "media_files") throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn(() => {
          const builder = createMediaRowsBuilder(rows);
          builders.push(builder);
          return builder;
        }),
      };
    }),
  });
  return builders;
};

const mockMediaRowsByColumn = (rowsByColumn: Record<string, unknown[]>) => {
  const builders: Array<ReturnType<typeof createMediaRowsBuilder> & { column?: string }> = [];
  ensureSupabaseQueryClientMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table !== "media_files") throw new Error(`Unexpected table: ${table}`);
      return {
        select: vi.fn(() => {
          const builder = createMediaRowsBuilder([]) as ReturnType<
            typeof createMediaRowsBuilder
          > & { column?: string };
          builder.in.mockImplementation((column: string) => {
            builder.column = column;
            return builder;
          });
          builder.limit.mockImplementation(async () => ({
            data: rowsByColumn[builder.column ?? ""] ?? [],
            error: null,
          }));
          builders.push(builder);
          return builder;
        }),
      };
    }),
  });
  return builders;
};

describe("resolveVideoPosterRepairsForOutputs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
  });

  it("repairs a restored video from its full storage path", async () => {
    mockMediaRows([
      {
        id: "media-1",
        file_type: "video",
        storage_path: "user-1/videos/out-1.mp4",
        poster_variant_path: "user-1/variants/videos/media-1/poster_720.jpg",
      },
    ]);
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user-1/variants/videos/media-1/poster_720.jpg", "https://signed.test/poster.jpg"]])
    );

    const repairs = await resolveVideoPosterRepairsForOutputs([
      makeOutput({
        id: "out-1",
        previewUrl: "https://signed.test/out-1.mp4",
        previewStoragePath: "user-1/videos/out-1.mp4",
        fullStoragePath: "user-1/videos/out-1.mp4",
      }),
    ]);

    expect(repairs.get("out-1")).toMatchObject({
      previewPosterUrl: "https://signed.test/poster.jpg",
      previewPosterStoragePath: "user-1/variants/videos/media-1/poster_720.jpg",
      previewStoragePath: "user-1/videos/out-1.mp4",
      fullStoragePath: "user-1/videos/out-1.mp4",
      previewUrl: "https://signed.test/out-1.mp4",
    });
  });

  it("repairs a saved-media video with no restored storage paths", async () => {
    mockMediaRows([
      {
        id: "media-2",
        file_type: "video",
        storage_path: "user-1/videos/out-2.mp4",
        poster_variant_path: "user-1/variants/videos/media-2/poster_720.jpg",
      },
    ]);
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        ["user-1/variants/videos/media-2/poster_720.jpg", "https://signed.test/poster-2.jpg"],
        ["user-1/videos/out-2.mp4", "https://signed.test/out-2.mp4"],
      ])
    );

    const repairs = await resolveVideoPosterRepairsForOutputs([
      makeOutput({
        id: "out-2",
        savedMediaIds: ["media-2"],
        previewUrl: undefined,
        previewStoragePath: null,
        fullStoragePath: null,
      }),
    ]);

    expect(repairs.get("out-2")).toMatchObject({
      previewPosterUrl: "https://signed.test/poster-2.jpg",
      previewPosterStoragePath: "user-1/variants/videos/media-2/poster_720.jpg",
      previewStoragePath: "user-1/videos/out-2.mp4",
      fullStoragePath: "user-1/videos/out-2.mp4",
      previewUrl: "https://signed.test/out-2.mp4",
      resultUrls: ["https://signed.test/out-2.mp4"],
    });
  });

  it("repairs playable video authority for poster-backed rows that already have a poster url", async () => {
    mockMediaRows([
      {
        id: "media-4",
        file_type: "video",
        storage_path: "user-1/generations/videos/out-4.mp4",
        poster_variant_path: "user-1/variants/videos/media-4/poster_720.jpg",
      },
    ]);
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([["user-1/generations/videos/out-4.mp4", "https://signed.test/out-4.mp4"]])
    );

    const repairs = await resolveVideoPosterRepairsForOutputs([
      makeOutput({
        id: "out-4",
        previewPosterUrl: "https://signed.test/poster-4.jpg",
        previewPosterStoragePath: "user-1/variants/videos/media-4/poster_720.jpg",
        previewStoragePath: "user-1/variants/videos/media-4/poster_720.jpg",
        fullStoragePath: "user-1/generations/videos/out-4.mp4",
        resultUrls: [],
        previewUrl: undefined,
      }),
    ]);

    expect(repairs.get("out-4")).toMatchObject({
      previewPosterUrl: "https://signed.test/poster-4.jpg",
      previewPosterStoragePath: "user-1/variants/videos/media-4/poster_720.jpg",
      previewStoragePath: "user-1/variants/videos/media-4/poster_720.jpg",
      fullStoragePath: "user-1/generations/videos/out-4.mp4",
      previewUrl: "https://signed.test/out-4.mp4",
      resultUrls: ["https://signed.test/out-4.mp4"],
    });
  });

  it("does not repair video rows without a poster variant", async () => {
    mockMediaRows([
      {
        id: "media-3",
        file_type: "video",
        storage_path: "user-1/videos/out-3.mp4",
      },
    ]);

    const repairs = await resolveVideoPosterRepairsForOutputs([
      makeOutput({
        id: "out-3",
        savedMediaIds: ["media-3"],
      }),
    ]);

    expect(repairs.size).toBe(0);
    expect(getSignedMediaUrlsBatchMock).not.toHaveBeenCalled();
  });

  it("skips preview-variant lookup when storage rows already cover preview paths", async () => {
    const builders = mockMediaRowsByColumn({
      storage_path: [
        {
          id: "media-5",
          file_type: "video",
          storage_path: "user-1/generations/videos/out-5.mp4",
          preview_variant_path: "user-1/variants/videos/media-5/preview_loop_360p.mp4",
          poster_variant_path: "user-1/variants/videos/media-5/poster_720.jpg",
        },
      ],
    });
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        ["user-1/variants/videos/media-5/poster_720.jpg", "https://signed.test/poster-5.jpg"],
      ])
    );

    const repairs = await resolveVideoPosterRepairsForOutputs([
      makeOutput({
        id: "out-5",
        previewUrl: "https://signed.test/out-5.mp4",
        previewStoragePath: "user-1/variants/videos/media-5/preview_loop_360p.mp4",
        fullStoragePath: "user-1/generations/videos/out-5.mp4",
      }),
    ]);

    expect(repairs.get("out-5")).toMatchObject({
      previewPosterUrl: "https://signed.test/poster-5.jpg",
      previewPosterStoragePath: "user-1/variants/videos/media-5/poster_720.jpg",
    });
    expect(builders.map((builder) => builder.in.mock.calls[0]?.[0])).toEqual(["storage_path"]);
  });

  it("falls back to preview-variant lookup when storage rows do not cover the path", async () => {
    const builders = mockMediaRowsByColumn({
      storage_path: [],
      preview_variant_path: [
        {
          id: "media-6",
          file_type: "video",
          storage_path: "user-1/generations/videos/out-6.mp4",
          preview_variant_path: "user-1/variants/videos/media-6/preview_loop_360p.mp4",
          poster_variant_path: "user-1/variants/videos/media-6/poster_720.jpg",
        },
      ],
    });
    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        ["user-1/variants/videos/media-6/poster_720.jpg", "https://signed.test/poster-6.jpg"],
      ])
    );

    const repairs = await resolveVideoPosterRepairsForOutputs([
      makeOutput({
        id: "out-6",
        previewUrl: "https://signed.test/out-6.mp4",
        previewStoragePath: "user-1/variants/videos/media-6/preview_loop_360p.mp4",
        fullStoragePath: null,
      }),
    ]);

    expect(repairs.get("out-6")).toMatchObject({
      previewPosterUrl: "https://signed.test/poster-6.jpg",
      previewPosterStoragePath: "user-1/variants/videos/media-6/poster_720.jpg",
      fullStoragePath: "user-1/generations/videos/out-6.mp4",
    });
    expect(builders.map((builder) => builder.in.mock.calls[0]?.[0])).toEqual([
      "storage_path",
      "preview_variant_path",
    ]);
  });
});
