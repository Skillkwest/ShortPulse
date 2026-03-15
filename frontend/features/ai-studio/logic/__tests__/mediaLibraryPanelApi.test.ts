import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyMediaFolderMembershipBatch,
  fetchMediaPromptListPage,
  listMediaFolders,
} from "../mediaLibraryPanelApi";

const fetchWithAuthMock = vi.fn();

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: (...args: unknown[]) => fetchWithAuthMock(...args),
}));

describe("mediaLibraryPanelApi transient retry hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries transient network failures for membership-batch calls", async () => {
    fetchWithAuthMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          action: "assign",
          folderId: "folder-1",
          sourceFolderId: null,
          targetFolderId: "folder-1",
          mediaAssigned: 1,
          mediaUnassigned: 0,
          promptsAssigned: 0,
          promptsUnassigned: 0,
          mediaDuplicates: 0,
          promptDuplicates: 0,
          mediaSkipped: 0,
          promptSkipped: 0,
        }),
      });

    const result = await applyMediaFolderMembershipBatch({
      action: "assign",
      folderId: "folder-1",
      mediaIds: ["media-1"],
      promptIds: [],
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      action: "assign",
      folderId: "folder-1",
      mediaAssigned: 1,
    });
  });

  it("does not retry non-transient membership errors", async () => {
    fetchWithAuthMock.mockRejectedValueOnce(new Error("forbidden"));

    await expect(
      applyMediaFolderMembershipBatch({
        action: "assign",
        folderId: "folder-1",
        mediaIds: ["media-1"],
        promptIds: [],
      })
    ).rejects.toThrow("forbidden");
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient prompt-list fetch failures", async () => {
    fetchWithAuthMock
      .mockRejectedValueOnce(new TypeError("Network request failed"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          rows: [
            {
              id: "prompt-1",
              title: "Prompt One",
              prompt_text: "Prompt text",
              mode: "text",
              source: "manual",
              created_at: "2026-03-14T00:00:00.000Z",
              updated_at: "2026-03-14T00:00:00.000Z",
            },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      });

    const result = await fetchMediaPromptListPage({
      folderId: "all_items",
      query: "",
      cursor: null,
      limit: 20,
    });

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.id).toBe("prompt-1");
  });

  it("retries transient folder-list failures", async () => {
    fetchWithAuthMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          folders: [
            {
              id: "folder-1",
              name: "Campaign",
              createdAt: "2026-03-01T00:00:00.000Z",
              updatedAt: "2026-03-01T00:00:00.000Z",
            },
          ],
        }),
      });

    const folders = await listMediaFolders();
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(folders.map((folder) => folder.id)).toEqual(["folder-1"]);
  });
});
