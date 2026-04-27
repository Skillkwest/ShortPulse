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
});
