import { renderHook, waitFor } from "@testing-library/react";
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
});
