import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MEDIA_STORAGE_FULL_USER_MESSAGE,
  MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE,
} from "../../../../lib/mediaStorageQuota";
import { useMediaLibraryPanelMutationController } from "../useMediaLibraryPanelMutationController";

const quotaMocks = vi.hoisted(() => ({
  requestMediaStorageQuotaSummaryRefresh: vi.fn(),
  useMediaStorageQuotaSummary: vi.fn(),
}));

const uploadMediaFileMock = vi.fn();
const applyMediaFolderMembershipBatchMock = vi.fn();

vi.mock("../../../billing/useMediaStorageQuotaSummary", () => ({
  requestMediaStorageQuotaSummaryRefresh: (...args: unknown[]) =>
    quotaMocks.requestMediaStorageQuotaSummaryRefresh(...args),
  useMediaStorageQuotaSummary: (...args: unknown[]) =>
    quotaMocks.useMediaStorageQuotaSummary(...args),
}));

vi.mock("../../logic/mediaLibraryPanelApi", () => ({
  MEDIA_LIBRARY_ROOT_FOLDER_ID: "all_items",
  applyMediaFolderMembershipBatch: (...args: unknown[]) =>
    applyMediaFolderMembershipBatchMock(...args),
  uploadMediaFile: (...args: unknown[]) => uploadMediaFileMock(...args),
}));

vi.mock("../../../media-library/logic/mediaLibraryDataEffects", () => ({
  deleteMediaFileWithStorage: vi.fn(),
  deleteMediaPromptById: vi.fn(),
  logMediaEvent: vi.fn(),
}));

describe("useMediaLibraryPanelMutationController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quotaMocks.useMediaStorageQuotaSummary.mockReturnValue({
      quotaSummary: { isOverLimit: false },
    });
    applyMediaFolderMembershipBatchMock.mockResolvedValue(undefined);
  });

  it("refreshes quota summary after reactive upload quota rejection", async () => {
    uploadMediaFileMock.mockRejectedValue(
      new Error(`${MEDIA_STORAGE_LIMIT_EXCEEDED_MESSAGE}: limit_bytes=1000`)
    );

    const { result } = renderHook(() =>
      useMediaLibraryPanelMutationController({
        projectId: "project-1",
        activeFolderId: "all_items",
        folders: [],
        refreshActiveRows: vi.fn().mockResolvedValue(undefined),
        refreshFolders: vi.fn().mockResolvedValue(undefined),
        setFolderError: vi.fn(),
        setMembershipMessage: vi.fn(),
        setMediaRows: vi.fn(),
        setPromptRows: vi.fn(),
      })
    );

    await expect(
      act(async () => {
        await result.current.uploadDroppedFilesToFolder({
          targetFolderId: "all_items",
          files: [new File(["img"], "image.png", { type: "image/png" })],
        });
      })
    ).rejects.toThrow();

    expect(quotaMocks.requestMediaStorageQuotaSummaryRefresh).toHaveBeenCalledTimes(1);
  });

  it("throws the canonical friendly quota message when proactive block is already known", async () => {
    quotaMocks.useMediaStorageQuotaSummary.mockReturnValue({
      quotaSummary: { isOverLimit: true },
    });

    const { result } = renderHook(() =>
      useMediaLibraryPanelMutationController({
        projectId: "project-1",
        activeFolderId: "all_items",
        folders: [],
        refreshActiveRows: vi.fn().mockResolvedValue(undefined),
        refreshFolders: vi.fn().mockResolvedValue(undefined),
        setFolderError: vi.fn(),
        setMembershipMessage: vi.fn(),
        setMediaRows: vi.fn(),
        setPromptRows: vi.fn(),
      })
    );

    await expect(
      act(async () => {
        await result.current.uploadDroppedFilesToFolder({
          targetFolderId: "all_items",
          files: [new File(["img"], "image.png", { type: "image/png" })],
        });
      })
    ).rejects.toThrow(MEDIA_STORAGE_FULL_USER_MESSAGE);

    expect(quotaMocks.requestMediaStorageQuotaSummaryRefresh).toHaveBeenCalledTimes(1);
    expect(uploadMediaFileMock).not.toHaveBeenCalled();
  });
});
