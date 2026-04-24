import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMediaLibraryFoldersState } from "../useMediaLibraryFoldersState";

const listMediaFoldersMock = vi.fn();
const createMediaFolderMock = vi.fn();
const deleteMediaFolderMock = vi.fn();
const renameMediaFolderMock = vi.fn();
const moveMediaFolderMock = vi.fn();

vi.mock("../../logic/mediaLibraryPanelApi", () => ({
  MEDIA_LIBRARY_ROOT_FOLDER_ID: "all_items",
  listMediaFolders: (...args: unknown[]) => listMediaFoldersMock(...args),
  createMediaFolder: (...args: unknown[]) => createMediaFolderMock(...args),
  deleteMediaFolder: (...args: unknown[]) => deleteMediaFolderMock(...args),
  moveMediaFolder: (...args: unknown[]) => moveMediaFolderMock(...args),
  renameMediaFolder: (...args: unknown[]) => renameMediaFolderMock(...args),
}));

describe("useMediaLibraryFoldersState", () => {
  beforeEach(() => {
    listMediaFoldersMock.mockReset();
    createMediaFolderMock.mockReset();
    deleteMediaFolderMock.mockReset();
    moveMediaFolderMock.mockReset();
    renameMediaFolderMock.mockReset();
  });

  it("orders folders by created time from oldest to newest", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-newer",
        name: "Newer",
        parentFolderId: null,
        createdAt: "2026-03-29T01:00:00.000Z",
        updatedAt: "2026-03-29T01:00:00.000Z",
      },
      {
        id: "folder-older",
        name: "Older",
        parentFolderId: null,
        createdAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
      },
      {
        id: "folder-middle",
        name: "Middle",
        parentFolderId: null,
        createdAt: "2026-03-29T00:30:00.000Z",
        updatedAt: "2026-03-29T00:30:00.000Z",
      },
    ]);

    const { result } = renderHook(() => useMediaLibraryFoldersState());

    await waitFor(() => {
      expect(result.current.customFolders.map((folder) => folder.name)).toEqual([
        "Older",
        "Middle",
        "Newer",
      ]);
    });
    expect(result.current.activeFolderName).toBe("All Media");
    expect(result.current.visibleFolders.map((folder) => folder.name)).toEqual([
      "Older",
      "Middle",
      "Newer",
    ]);
  });

  it("remaps an active pending folder id to the persisted folder id after create resolves", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([]);
    let resolveCreate:
      | ((value: {
          id: string;
          name: string;
          parentFolderId: string | null;
          createdAt: string;
          updatedAt: string;
        }) => void)
      | null = null;
    createMediaFolderMock.mockReturnValue(
      new Promise((resolve) => {
        resolveCreate = resolve;
      })
    );

    const { result } = renderHook(() => useMediaLibraryFoldersState());

    await waitFor(() => {
      expect(result.current.folders).toHaveLength(0);
    });

    await act(async () => {
      void result.current.createFolder();
    });

    const pendingFolderId = result.current.visibleFolders[0]?.id ?? null;
    expect(pendingFolderId).toContain("__pending_new_folder__");

    act(() => {
      result.current.setActiveFolderId(pendingFolderId!);
    });

    await act(async () => {
      resolveCreate?.({
        id: "folder-real",
        name: "New Folder",
        parentFolderId: null,
        createdAt: "2026-03-31T00:00:00.000Z",
        updatedAt: "2026-03-31T00:00:00.000Z",
      });
    });

    await waitFor(() => {
      expect(result.current.activeFolderId).toBe("folder-real");
      expect(result.current.editingFolderId).toBe("folder-real");
    });
  });

  it("passes projectId through folder load and create calls", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([]);
    createMediaFolderMock.mockResolvedValueOnce({
      id: "folder-project-real",
      name: "New Folder",
      parentFolderId: null,
      createdAt: "2026-03-31T00:00:00.000Z",
      updatedAt: "2026-03-31T00:00:00.000Z",
    });

    const { result } = renderHook(() => useMediaLibraryFoldersState("project-1"));

    await waitFor(() => {
      expect(listMediaFoldersMock).toHaveBeenCalledWith("project-1");
    });

    await act(async () => {
      await result.current.createFolder();
    });

    expect(createMediaFolderMock).toHaveBeenCalledWith("New Folder", null, "project-1");
  });
});
