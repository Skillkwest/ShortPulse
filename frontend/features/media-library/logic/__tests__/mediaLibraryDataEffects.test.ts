import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectMediaStoragePathsForDelete,
  logMediaEvent,
  removeStoragePaths,
} from "../mediaLibraryDataEffects";
import { invalidateSignedMediaUrl } from "../../../../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../../../../lib/supabaseClient";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  invalidateSignedMediaUrl: vi.fn(),
}));

const ensureSupabaseClientMock = vi.mocked(ensureSupabaseClient);
const invalidateSignedMediaUrlMock = vi.mocked(invalidateSignedMediaUrl);

const authGetSessionMock = vi.fn();
const mediaEventsInsertMock = vi.fn();
const mediaVariantsInMock = vi.fn();
const storageRemoveMock = vi.fn();

describe("mediaLibraryDataEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authGetSessionMock.mockResolvedValue({
      data: {
        session: {
          user: { id: "user-1" },
        },
      },
    });
    mediaEventsInsertMock.mockResolvedValue({ error: null });
    mediaVariantsInMock.mockResolvedValue({ data: [], error: null });
    storageRemoveMock.mockResolvedValue({ error: null });

    ensureSupabaseClientMock.mockReturnValue({
      auth: {
        getSession: authGetSessionMock,
      },
      from: (table: string) => {
        if (table === "media_events") {
          return {
            insert: mediaEventsInsertMock,
          };
        }
        if (table === "media_asset_variants") {
          return {
            select: () => ({
              in: mediaVariantsInMock,
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
      storage: {
        from: () => ({
          remove: storageRemoveMock,
        }),
      },
    } as never);
  });

  it("logs media events for signed-in users", async () => {
    await logMediaEvent("delete", "media_file", "file-1", { source: "test" });

    expect(mediaEventsInsertMock).toHaveBeenCalledWith({
      user_id: "user-1",
      event_type: "delete",
      entity_type: "media_file",
      entity_id: "file-1",
      metadata: { source: "test" },
    });
  });

  it("collects and deduplicates base and variant storage paths", async () => {
    mediaVariantsInMock.mockResolvedValueOnce({
      data: [{ storage_path: "u/private/file-1-thumb.webp" }, { storage_path: null }],
      error: null,
    });

    const paths = await collectMediaStoragePathsForDelete([
      {
        id: "file-1",
        storage_path: "u/private/file-1.png",
        preview_storage_path: "u/private/file-1-preview.png",
      },
      {
        id: "file-2",
        storage_path: "u/private/file-2.png",
        preview_storage_path: "u/private/file-1-preview.png",
      },
    ]);

    expect(paths).toEqual([
      "u/private/file-1.png",
      "u/private/file-1-preview.png",
      "u/private/file-2.png",
      "u/private/file-1-thumb.webp",
    ]);
  });

  it("falls back to base paths when variants relation is missing", async () => {
    mediaVariantsInMock.mockResolvedValueOnce({
      data: null,
      error: { code: "42P01" },
    });

    const paths = await collectMediaStoragePathsForDelete([
      {
        id: "file-1",
        storage_path: "u/private/file-1.png",
      },
    ]);

    expect(paths).toEqual(["u/private/file-1.png"]);
  });

  it("deletes storage paths in batches and invalidates signed-url cache", async () => {
    const paths = Array.from({ length: 205 }, (_, index) => `u/private/file-${index}.png`);

    await removeStoragePaths(paths);

    expect(storageRemoveMock).toHaveBeenCalledTimes(3);
    expect(storageRemoveMock).toHaveBeenNthCalledWith(1, paths.slice(0, 100));
    expect(storageRemoveMock).toHaveBeenNthCalledWith(2, paths.slice(100, 200));
    expect(storageRemoveMock).toHaveBeenNthCalledWith(3, paths.slice(200));
    expect(invalidateSignedMediaUrlMock).toHaveBeenCalledTimes(205);
  });
});
