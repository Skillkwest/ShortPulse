import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectMediaStoragePathsForDelete,
  deleteMediaFileWithStorage,
  deleteMediaPromptById,
  logMediaEvent,
  removeStoragePaths,
} from "../mediaLibraryDataEffects";
import { invalidateSignedMediaUrl } from "../../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: vi.fn(),
  readSupabaseUserId: vi.fn(),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  invalidateSignedMediaUrl: vi.fn(),
}));

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);
const readSupabaseUserIdMock = vi.mocked(readSupabaseUserId);
const invalidateSignedMediaUrlMock = vi.mocked(invalidateSignedMediaUrl);
const fetchWithAuthMock = vi.mocked(fetchWithAuth);
const mediaEventsInsertMock = vi.fn();
const mediaVariantsInMock = vi.fn();
const mediaFilesDeleteMock = vi.fn();
const mediaFilesEqMock = vi.fn();
const mediaFilesSelectMock = vi.fn();
const mediaFilesMaybeSingleMock = vi.fn();
const mediaPromptsDeleteMock = vi.fn();
const mediaPromptsEqMock = vi.fn();
const mediaPromptsSelectMock = vi.fn();
const mediaPromptsMaybeSingleMock = vi.fn();
const storageRemoveMock = vi.fn();

describe("mediaLibraryDataEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    mediaEventsInsertMock.mockResolvedValue({ error: null });
    mediaVariantsInMock.mockResolvedValue({ data: [], error: null });
    mediaFilesDeleteMock.mockReturnValue({ eq: mediaFilesEqMock });
    mediaFilesEqMock.mockReturnValue({ select: mediaFilesSelectMock });
    mediaFilesSelectMock.mockReturnValue({ maybeSingle: mediaFilesMaybeSingleMock });
    mediaFilesMaybeSingleMock.mockResolvedValue({ data: { id: "file-1" }, error: null });
    mediaPromptsDeleteMock.mockReturnValue({ eq: mediaPromptsEqMock });
    mediaPromptsEqMock.mockReturnValue({ select: mediaPromptsSelectMock });
    mediaPromptsSelectMock.mockReturnValue({ maybeSingle: mediaPromptsMaybeSingleMock });
    mediaPromptsMaybeSingleMock.mockResolvedValue({ data: { id: "prompt-1" }, error: null });
    storageRemoveMock.mockResolvedValue({ error: null });
    fetchWithAuthMock.mockResolvedValue(
      new Response(JSON.stringify({ deletedMediaId: "file-1" }), {
        status: 200,
      })
    );

    ensureSupabaseQueryClientMock.mockReturnValue({
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
        if (table === "media_files") {
          return {
            delete: mediaFilesDeleteMock,
          };
        }
        if (table === "media_prompts") {
          return {
            delete: mediaPromptsDeleteMock,
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

  it("deletes media through the server-owned media delete route", async () => {
    await deleteMediaFileWithStorage({
      id: "file-1",
      storage_path: "u/private/file-1.png",
      preview_storage_path: "u/private/file-1-preview.png",
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/delete",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ mediaFileId: "file-1" }),
      })
    );
    expect(mediaFilesDeleteMock).not.toHaveBeenCalled();
  });

  it("throws the server route message when media delete fails", async () => {
    fetchWithAuthMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Failed to delete media", details: "No row" }), {
        status: 500,
      })
    );

    await expect(
      deleteMediaFileWithStorage({
        id: "missing-file",
        storage_path: "u/private/missing-file.png",
      })
    ).rejects.toThrow("No row");

    expect(storageRemoveMock).not.toHaveBeenCalled();
  });

  it("deletes a prompt row only when Supabase returns the deleted id", async () => {
    await deleteMediaPromptById(" prompt-1 ");

    expect(mediaPromptsDeleteMock).toHaveBeenCalledTimes(1);
    expect(mediaPromptsEqMock).toHaveBeenCalledWith("id", "prompt-1");
    expect(mediaPromptsSelectMock).toHaveBeenCalledWith("id");
  });

  it("throws when prompt deletion affects no rows", async () => {
    mediaPromptsMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null });

    await expect(deleteMediaPromptById("missing-prompt")).rejects.toThrow(
      "Unable to delete prompt."
    );

    expect(mediaPromptsEqMock).toHaveBeenCalledWith("id", "missing-prompt");
  });
});
