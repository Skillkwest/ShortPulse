import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import { useMediaLibraryFolderReparentController } from "../useMediaLibraryFolderReparentController";
import { writeMediaLibraryFolderDragPayload } from "../../logic/mediaLibraryFolderDragPayload";

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

const createTransfer = (): DataTransfer => {
  const values = new Map<string, string>();
  const types: string[] = [];
  return {
    types,
    setData(type: string, value: string) {
      values.set(type, value);
      if (!types.includes(type)) {
        types.push(type);
      }
    },
    getData(type: string) {
      return values.get(type) ?? "";
    },
    dropEffect: "none",
    effectAllowed: "all",
  } as unknown as DataTransfer;
};

const createDropEvent = (transfer: DataTransfer): React.DragEvent<HTMLElement> =>
  ({
    dataTransfer: transfer,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  }) as unknown as React.DragEvent<HTMLElement>;

const createDragEvent = (
  transfer: DataTransfer,
  currentTarget?: { classList: { add: ReturnType<typeof vi.fn>; remove: ReturnType<typeof vi.fn> } }
): React.DragEvent<HTMLElement> =>
  ({
    dataTransfer: transfer,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    currentTarget:
      currentTarget ??
      ({
        classList: {
          add: vi.fn(),
          remove: vi.fn(),
        },
      } as unknown as HTMLElement),
  }) as unknown as React.DragEvent<HTMLElement>;

describe("useMediaLibraryFolderReparentController", () => {
  beforeEach(() => {
    vi.mocked(addBreadcrumb).mockReset();
  });

  it("does not emit a success breadcrumb when moveFolder reports failure", async () => {
    const moveFolder = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useMediaLibraryFolderReparentController({
        folders: [
          {
            id: "folder-1",
            name: "Campaign",
            parentFolderId: null,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
            itemCount: 0,
          },
          {
            id: "folder-2",
            name: "Archive",
            parentFolderId: null,
            createdAt: "2026-03-02T00:00:00.000Z",
            updatedAt: "2026-03-02T00:00:00.000Z",
            itemCount: 0,
          },
        ],
        moveFolder,
      })
    );
    const transfer = createTransfer();
    writeMediaLibraryFolderDragPayload(transfer, {
      source: "mediaLibraryFolder",
      payload: {
        id: "folder-1",
        name: "Campaign",
        parentFolderId: null,
      },
    });

    await act(async () => {
      await result.current.handleFolderDrop("folder-2", createDropEvent(transfer));
    });

    expect(moveFolder).toHaveBeenCalledWith("folder-1", "folder-2");
    expect(vi.mocked(addBreadcrumb)).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: "media_library_folder_drag_move_success",
      })
    );
  });

  it("emits a success breadcrumb when moveFolder reports success", async () => {
    const moveFolder = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMediaLibraryFolderReparentController({
        folders: [
          {
            id: "folder-1",
            name: "Campaign",
            parentFolderId: null,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
            itemCount: 0,
          },
          {
            id: "folder-2",
            name: "Archive",
            parentFolderId: null,
            createdAt: "2026-03-02T00:00:00.000Z",
            updatedAt: "2026-03-02T00:00:00.000Z",
            itemCount: 0,
          },
        ],
        moveFolder,
      })
    );
    const transfer = createTransfer();
    writeMediaLibraryFolderDragPayload(transfer, {
      source: "mediaLibraryFolder",
      payload: {
        id: "folder-1",
        name: "Campaign",
        parentFolderId: null,
      },
    });

    await act(async () => {
      await result.current.handleFolderDrop("folder-2", createDropEvent(transfer));
    });

    expect(vi.mocked(addBreadcrumb)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "media_library_folder_drag_move_success",
        data: expect.objectContaining({
          folderId: "folder-1",
          targetFolderId: "folder-2",
        }),
      })
    );
  });

  it("keeps same-window folder drops working when dragover packets expose no transfer types", async () => {
    const moveFolder = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() =>
      useMediaLibraryFolderReparentController({
        folders: [
          {
            id: "folder-1",
            name: "Campaign",
            parentFolderId: null,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
            itemCount: 0,
          },
          {
            id: "folder-2",
            name: "Archive",
            parentFolderId: null,
            createdAt: "2026-03-02T00:00:00.000Z",
            updatedAt: "2026-03-02T00:00:00.000Z",
            itemCount: 0,
          },
        ],
        moveFolder,
      })
    );
    const dragStartTransfer = createTransfer();
    const unreadableTransfer = {
      types: [],
      getData: () => "",
      dropEffect: "none",
      effectAllowed: "move",
    } as unknown as DataTransfer;

    act(() => {
      result.current.handleFolderDragStart(createDragEvent(dragStartTransfer), {
        id: "folder-1",
        name: "Campaign",
        parentFolderId: null,
      });
    });

    act(() => {
      result.current.handleFolderDragOver("folder-2", createDropEvent(unreadableTransfer));
    });

    expect(result.current.hoveredFolderId).toBe("folder-2");

    await act(async () => {
      await result.current.handleFolderDrop("folder-2", createDropEvent(unreadableTransfer));
    });

    expect(moveFolder).toHaveBeenCalledWith("folder-1", "folder-2");
  });
});
