import { beforeEach, describe, expect, it, vi } from "vitest";
import { listQuickSwapActive } from "../characterQuickSwapPersistence";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";
import { resolveSupabaseContext } from "../characterManagerPersistenceCore";

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: vi.fn(),
  getSignedMediaUrl: vi.fn(),
  invalidateSignedMediaUrl: vi.fn(),
}));

vi.mock("../characterManagerPersistenceCore", async () => {
  const actual = await vi.importActual("../characterManagerPersistenceCore");
  return {
    ...actual,
    resolveSupabaseContext: vi.fn(),
    loadSlotFilesForCharacterSheet: vi.fn(),
  };
});

vi.mock("../characterMediaIsolationFlags", () => ({
  isCharacterMediaV2ReadsEnabled: vi.fn(() => false),
  isCharacterMediaV2WritesEnabled: vi.fn(() => false),
}));

const getSignedMediaUrlsBatchMock = vi.mocked(getSignedMediaUrlsBatch);
const resolveSupabaseContextMock = vi.mocked(resolveSupabaseContext);

const createAwaitableQuery = <TData>(data: TData, error: unknown = null) => {
  const query = {
    data,
    error,
    eq: () => query,
    in: () => query,
    order: () => query,
    limit: () => query,
  };
  return query;
};

describe("characterQuickSwapPersistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
  });

  it("hydrates quick swap previews from variant storage paths before original uploads", async () => {
    resolveSupabaseContextMock.mockResolvedValue({
      userId: "user-1",
      supabase: {
        from: vi.fn((table: string) => {
          if (table === "character_quick_swap_items") {
            return {
              select: () =>
                createAwaitableQuery([
                  {
                    id: "qs-1",
                    media_file_id: "media-quick-1",
                    storage_path: "user-1/characters/char-1/quickswap/original.png",
                    status: "active",
                    created_at: "2026-04-27T00:00:00.000Z",
                    archived_at: null,
                  },
                ]),
            };
          }
          if (table === "media_files") {
            return {
              select: () =>
                createAwaitableQuery([
                  {
                    id: "media-quick-1",
                    filename: "original.png",
                    storage_path: "user-1/characters/char-1/quickswap/original.png",
                    file_type: "image/png",
                    file_size: 2048,
                    metadata: {},
                    thumb_variant_path: "user-1/variants/images/media-quick-1/thumb_240",
                    poster_variant_path: null,
                    preview_variant_path: null,
                    created_at: "2026-04-27T00:00:00.000Z",
                  },
                ]),
            };
          }
          throw new Error(`Unexpected table lookup: ${table}`);
        }),
      },
    } as unknown as Awaited<ReturnType<typeof resolveSupabaseContext>>);

    getSignedMediaUrlsBatchMock.mockResolvedValue(
      new Map([
        [
          "user-1/variants/images/media-quick-1/thumb_240",
          "https://signed.example/media-quick-1-thumb.webp",
        ],
      ])
    );

    const result = await listQuickSwapActive("char-1");

    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: ["user-1/variants/images/media-quick-1/thumb_240"],
      surface: "character-grid",
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: "qs-1",
        storagePath: "user-1/characters/char-1/quickswap/original.png",
        previewStoragePath: "user-1/variants/images/media-quick-1/thumb_240",
        previewUrl: "https://signed.example/media-quick-1-thumb.webp",
      }),
    ]);
  });
});
