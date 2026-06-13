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
const dataEffectsMocks = vi.hoisted(() => ({
  deleteMediaFileWithStorage: vi.fn(),
  deleteMediaPromptById: vi.fn(),
  logMediaEvent: vi.fn(),
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
  deleteMediaFileWithStorage: (...args: unknown[]) =>
    dataEffectsMocks.deleteMediaFileWithStorage(...args),
  deleteMediaPromptById: (...args: unknown[]) => dataEffectsMocks.deleteMediaPromptById(...args),
  logMediaEvent: (...args: unknown[]) => dataEffectsMocks.logMediaEvent(...args),
}));

describe("useMediaLibraryPanelMutationController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    quotaMocks.useMediaStorageQuotaSummary.mockReturnValue({
      quotaSummary: { isOverLimit: false },
    });
    applyMediaFolderMembershipBatchMock.mockResolvedValue(undefined);
    dataEffectsMocks.deleteMediaFileWithStorage.mockResolvedValue(undefined);
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

  it("uses a parent quota block value without starting a second quota summary load", async () => {
    const { result } = renderHook(() =>
      useMediaLibraryPanelMutationController({
        projectId: "project-1",
        activeFolderId: "all_items",
        folders: [],
        isStorageQuotaBlockedOverride: true,
        refreshActiveRows: vi.fn().mockResolvedValue(undefined),
        refreshFolders: vi.fn().mockResolvedValue(undefined),
        setFolderError: vi.fn(),
        setMembershipMessage: vi.fn(),
        setMediaRows: vi.fn(),
        setPromptRows: vi.fn(),
      })
    );

    expect(quotaMocks.useMediaStorageQuotaSummary).toHaveBeenCalledWith({ enabled: false });
    expect(result.current.isStorageQuotaBlocked).toBe(true);

    await expect(
      act(async () => {
        await result.current.uploadDroppedFilesToFolder({
          targetFolderId: "all_items",
          files: [new File(["img"], "image.png", { type: "image/png" })],
        });
      })
    ).rejects.toThrow(MEDIA_STORAGE_FULL_USER_MESSAGE);
    expect(uploadMediaFileMock).not.toHaveBeenCalled();
  });

  it("notifies the workspace when deleted library media must be removed from right-rail state", async () => {
    const onDeleteMediaRowsFromWorkspace = vi.fn();

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
        onDeleteMediaRowsFromWorkspace,
      })
    );

    const deletedRow = {
      id: "media-1",
      filename: "ref-1.png",
      storage_path: "user-1/uploads/images/ref-1.png",
      preview_storage_path: "user-1/uploads/images/ref-1-thumb.webp",
      file_type: "image/png",
      source: "upload",
      created_at: "2026-05-26T18:00:00.000Z",
      metadata: null,
      signedUrl: "https://cdn.example.com/ref-1.png",
    };

    await act(async () => {
      await result.current.deleteMediaRowsFromLibrary([deletedRow]);
    });

    expect(onDeleteMediaRowsFromWorkspace).toHaveBeenCalledWith([deletedRow]);
  });
});
