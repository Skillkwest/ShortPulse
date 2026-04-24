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
  const createDeferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((nextResolve) => {
      resolve = nextResolve;
    });
    return { promise, resolve };
  };

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

  it("keeps pending folders from becoming active before create resolves", async () => {
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
    expect(result.current.activeFolderId).toBe("all_items");

    act(() => {
      result.current.setActiveFolderId(pendingFolderId!);
    });

    expect(result.current.activeFolderId).toBe("all_items");

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
      expect(result.current.activeFolderId).toBe("all_items");
      expect(result.current.editingFolderId).toBe("folder-real");
    });
  });

  it("starts rename without navigating into the target folder", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-1",
        name: "Campaign",
        parentFolderId: null,
        createdAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
      },
    ]);

    const { result } = renderHook(() => useMediaLibraryFoldersState());

    await waitFor(() => {
      expect(result.current.folders).toHaveLength(1);
    });

    act(() => {
      result.current.startFolderRename("folder-1", "Campaign", { clearInput: true });
    });

    expect(result.current.activeFolderId).toBe("all_items");
    expect(result.current.editingFolderId).toBe("folder-1");
    expect(result.current.editingFolderName).toBe("");
  });

  it("removes a deleted folder subtree from local state", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([
      {
        id: "folder-parent",
        name: "Parent",
        parentFolderId: null,
        createdAt: "2026-03-29T00:00:00.000Z",
        updatedAt: "2026-03-29T00:00:00.000Z",
      },
      {
        id: "folder-child",
        name: "Child",
        parentFolderId: "folder-parent",
        createdAt: "2026-03-29T00:01:00.000Z",
        updatedAt: "2026-03-29T00:01:00.000Z",
      },
      {
        id: "folder-grandchild",
        name: "Grandchild",
        parentFolderId: "folder-child",
        createdAt: "2026-03-29T00:02:00.000Z",
        updatedAt: "2026-03-29T00:02:00.000Z",
      },
    ]);
    deleteMediaFolderMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useMediaLibraryFoldersState());

    await waitFor(() => {
      expect(result.current.folders).toHaveLength(3);
    });

    act(() => {
      result.current.setActiveFolderId("folder-grandchild");
      result.current.startFolderRename("folder-child", "Child");
    });

    await act(async () => {
      await result.current.deleteFolder("folder-parent");
    });

    expect(deleteMediaFolderMock).toHaveBeenCalledWith("folder-parent", null);
    expect(result.current.folders).toEqual([]);
    expect(result.current.activeFolderId).toBe("all_items");
    expect(result.current.editingFolderId).toBeNull();
    expect(result.current.editingFolderName).toBe("");
  });

  it("ignores stale create results after the project scope changes", async () => {
    listMediaFoldersMock.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
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

    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string | null }) => useMediaLibraryFoldersState(projectId),
      { initialProps: { projectId: "project-1" } }
    );

    await waitFor(() => {
      expect(listMediaFoldersMock).toHaveBeenCalledWith("project-1");
    });

    await act(async () => {
      void result.current.createFolder();
    });

    expect(result.current.visibleFolders[0]?.id).toContain("__pending_new_folder__");

    rerender({ projectId: "project-2" });

    await waitFor(() => {
      expect(listMediaFoldersMock).toHaveBeenCalledWith("project-2");
      expect(result.current.folders).toEqual([]);
      expect(result.current.activeFolderId).toBe("all_items");
    });

    await act(async () => {
      resolveCreate?.({
        id: "folder-project-1-created",
        name: "New Folder",
        parentFolderId: null,
        createdAt: "2026-03-31T00:00:00.000Z",
        updatedAt: "2026-03-31T00:00:00.000Z",
      });
    });

    expect(result.current.folders).toEqual([]);
    expect(result.current.editingFolderId).toBeNull();
    expect(result.current.activeFolderId).toBe("all_items");
  });

  it("clears visible folder state immediately when the project changes", async () => {
    const projectTwoFolders = createDeferred<
      Array<{
        id: string;
        name: string;
        parentFolderId: string | null;
        createdAt: string;
        updatedAt: string;
      }>
    >();

    listMediaFoldersMock
      .mockResolvedValueOnce([
        {
          id: "project-1-folder",
          name: "Project One",
          parentFolderId: null,
          createdAt: "2026-03-29T00:00:00.000Z",
          updatedAt: "2026-03-29T00:00:00.000Z",
        },
      ])
      .mockReturnValueOnce(projectTwoFolders.promise);

    const { result, rerender } = renderHook(
      ({ projectId }: { projectId: string | null }) => useMediaLibraryFoldersState(projectId),
      { initialProps: { projectId: "project-1" } }
    );

    await waitFor(() => {
      expect(result.current.visibleFolders.map((folder) => folder.name)).toEqual(["Project One"]);
    });

    act(() => {
      result.current.setActiveFolderId("project-1-folder");
      result.current.startFolderRename("project-1-folder", "Project One");
    });

    rerender({ projectId: "project-2" });

    expect(result.current.folders).toEqual([]);
    expect(result.current.visibleFolders).toEqual([]);
    expect(result.current.activeFolderId).toBe("all_items");
    expect(result.current.editingFolderId).toBeNull();
    expect(result.current.editingFolderName).toBe("");

    await act(async () => {
      projectTwoFolders.resolve([]);
    });

    await waitFor(() => {
      expect(result.current.folders).toEqual([]);
      expect(result.current.activeFolderId).toBe("all_items");
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
