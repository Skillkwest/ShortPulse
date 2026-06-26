import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMediaLibraryFolderDropController } from "../useMediaLibraryFolderDropController";

const applyMediaFolderMembershipBatchMock = vi.fn();
const readMediaLibraryDragPayloadMock = vi.fn();
const extractInternalReferenceDragPayloadMock = vi.fn();

vi.mock("../../logic/mediaLibraryPanelApi", () => ({
  MEDIA_LIBRARY_ROOT_FOLDER_ID: "all_items",
  applyMediaFolderMembershipBatch: (...args: unknown[]) =>
    applyMediaFolderMembershipBatchMock(...args),
}));

vi.mock("../../logic/mediaLibraryDragPayload", () => ({
  getMediaLibraryDragTypes: () => ["application/x-shortpulse-media-library-item"],
  readMediaLibraryDragPayload: (...args: unknown[]) => readMediaLibraryDragPayloadMock(...args),
}));

vi.mock("../../utils/dragDrop", () => ({
  extractInternalReferenceDragPayload: (...args: unknown[]) =>
    extractInternalReferenceDragPayloadMock(...args),
}));

describe("useMediaLibraryFolderDropController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readMediaLibraryDragPayloadMock.mockReturnValue({
      kind: "libraryMedia",
      payload: {
        id: "media-1",
        originFolderId: "all_items",
      },
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue(null);
    applyMediaFolderMembershipBatchMock.mockResolvedValue({
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
    });
  });

  it("threads projectId through membership mutations for folder drops", async () => {
    const setFolderError = vi.fn();
    const setMembershipMessage = vi.fn();
    const setMembershipPendingMessage = vi.fn();
    const refreshActiveRows = vi.fn().mockResolvedValue(undefined);
    const refreshFolders = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useMediaLibraryFolderDropController({
        projectId: "project-1",
        folders: [
          {
            id: "folder-1",
            name: "Folder 1",
            parentFolderId: null,
            createdAt: "2026-04-24T00:00:00.000Z",
            updatedAt: "2026-04-24T00:00:00.000Z",
          },
        ],
        setFolderError,
        setMembershipMessage,
        setMembershipPendingMessage,
        refreshActiveRows,
        refreshFolders,
      })
    );

    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        types: ["application/x-shortpulse-media-library-item"],
        files: [],
      },
    } as unknown as React.DragEvent<HTMLElement>;

    await act(async () => {
      await result.current.handleFolderDrop("folder-1", event);
    });

    expect(applyMediaFolderMembershipBatchMock).toHaveBeenCalledWith(
      {
        action: "assign",
        folderId: "folder-1",
        mediaIds: ["media-1"],
        promptIds: [],
      },
      "project-1"
    );
    expect(refreshFolders).toHaveBeenCalledTimes(1);
  });

  it("reports already-saved internal media drops on root All Media without refreshing as a save", async () => {
    const setFolderError = vi.fn();
    const setMembershipMessage = vi.fn();
    const setMembershipPendingMessage = vi.fn();
    const refreshActiveRows = vi.fn().mockResolvedValue(undefined);
    const refreshFolders = vi.fn().mockResolvedValue(undefined);
    const resolveInternalDropItem = vi.fn().mockResolvedValue({
      kind: "media",
      id: "media-1",
      alreadyInLibrary: true,
    });
    readMediaLibraryDragPayloadMock.mockReturnValue(null);
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      origin: "ai-studio-reference-grid",
      outputId: "output-1",
      mediaId: "media-1",
    });

    const { result } = renderHook(() =>
      useMediaLibraryFolderDropController({
        folders: [],
        setFolderError,
        setMembershipMessage,
        setMembershipPendingMessage,
        refreshActiveRows,
        refreshFolders,
        resolveInternalDropItem,
      })
    );

    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        types: ["text/reference-origin", "text/reference-output-id", "text/reference-media-id"],
        files: [],
      },
    } as unknown as React.DragEvent<HTMLElement>;

    await act(async () => {
      await result.current.handleFolderDrop("all_items", event);
    });

    expect(resolveInternalDropItem).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "ai-studio-reference-grid",
        mediaId: "media-1",
      })
    );
    expect(setMembershipMessage).toHaveBeenCalledWith("Media already exists in the media library.");
    expect(applyMediaFolderMembershipBatchMock).not.toHaveBeenCalled();
    expect(refreshActiveRows).not.toHaveBeenCalled();
    expect(refreshFolders).not.toHaveBeenCalled();
    expect(setFolderError).toHaveBeenCalledWith(null);
    expect(setFolderError).not.toHaveBeenCalledWith(expect.any(String));
  });

  it("proactively ignores desktop file drops while storage is full", async () => {
    const setFolderError = vi.fn();
    const setMembershipMessage = vi.fn();
    const setMembershipPendingMessage = vi.fn();
    const refreshActiveRows = vi.fn().mockResolvedValue(undefined);
    const refreshFolders = vi.fn().mockResolvedValue(undefined);
    const onDropFilesToFolder = vi.fn().mockResolvedValue(undefined);
    readMediaLibraryDragPayloadMock.mockReturnValue(null);

    const { result } = renderHook(() =>
      useMediaLibraryFolderDropController({
        projectId: "project-1",
        folders: [
          {
            id: "folder-1",
            name: "Folder 1",
            parentFolderId: null,
            createdAt: "2026-04-24T00:00:00.000Z",
            updatedAt: "2026-04-24T00:00:00.000Z",
          },
        ],
        isStorageQuotaBlocked: true,
        setFolderError,
        setMembershipMessage,
        setMembershipPendingMessage,
        refreshActiveRows,
        refreshFolders,
        onDropFilesToFolder,
      })
    );

    const file = new File(["video"], "clip.mp4", { type: "video/mp4" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
    } as unknown as FileList;
    const event = {
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      dataTransfer: {
        types: ["Files"],
        files,
      },
    } as unknown as React.DragEvent<HTMLElement>;

    await act(async () => {
      await result.current.handleFolderDrop("folder-1", event);
    });

    expect(onDropFilesToFolder).not.toHaveBeenCalled();
    expect(setFolderError).not.toHaveBeenCalledWith("Unable to process dropped files.");
    expect(setMembershipPendingMessage).not.toHaveBeenCalled();
  });
});
