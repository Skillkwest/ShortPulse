import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyMediaFolderMembershipBatch,
  fetchMediaPromptListPage,
  getMediaFolderCanvasState,
  listMediaFolders,
  saveMediaFolderCanvasState,
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
              itemCount: 4,
            },
          ],
        }),
      });

    const folders = await listMediaFolders();
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(folders.map((folder) => folder.id)).toEqual(["folder-1"]);
    expect(folders[0]?.itemCount).toBe(4);
  });

  it("uses project folder routes when a projectId is provided", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        folders: [
          {
            id: "folder-1",
            name: "Campaign",
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
            itemCount: 6,
          },
        ],
      }),
    });

    const folders = await listMediaFolders("project-1");

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/projects/project-1/media/folders/list",
      expect.objectContaining({
        method: "GET",
      })
    );
    expect(folders[0]?.itemCount).toBe(6);
  });

  it("uses project membership routes when a projectId is provided", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
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

    await applyMediaFolderMembershipBatch(
      {
        action: "assign",
        folderId: "folder-1",
        mediaIds: ["media-1"],
        promptIds: [],
      },
      "project-1"
    );

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/projects/project-1/media/folders/membership-batch",
      expect.objectContaining({
        method: "POST",
      })
    );
  });

  it("includes projectId in prompt-list requests when provided", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rows: [],
        nextCursor: null,
        hasMore: false,
      }),
    });

    await fetchMediaPromptListPage({
      folderId: "folder-1",
      projectId: "project-1",
      query: "",
      cursor: null,
      limit: 20,
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/media/prompts/list",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"projectId":"project-1"'),
      })
    );
  });

  it("uses project folder canvas read routes when a projectId is provided", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        state: {
          folderId: "folder-1",
          schemaVersion: 1,
          snapshot: { items: [] },
          saveSeq: 2,
          createdAt: "2026-04-24T00:00:00.000Z",
          updatedAt: "2026-04-24T00:00:00.000Z",
        },
      }),
    });

    await getMediaFolderCanvasState("folder-1", "project-1");

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/projects/project-1/media/folders/folder-1/canvas",
      expect.objectContaining({
        method: "GET",
      })
    );
  });

  it("uses project folder canvas save routes when a projectId is provided", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        folderId: "folder-1",
        schemaVersion: 1,
        saveSeq: 3,
        updatedAt: "2026-04-24T00:00:00.000Z",
      }),
    });

    await saveMediaFolderCanvasState({
      folderId: "folder-1",
      projectId: "project-1",
      schemaVersion: 1,
      snapshot: { items: [] },
    });

    expect(fetchWithAuthMock).toHaveBeenCalledWith(
      "/api/projects/project-1/media/folders/folder-1/canvas",
      expect.objectContaining({
        method: "PUT",
        body: expect.stringContaining('"folderId":"folder-1"'),
      })
    );
  });
});
