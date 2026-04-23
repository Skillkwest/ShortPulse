/**
 * Media Library page tests for route-owned shell side effects and Escape priority.
 */
import { fireEvent, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import MediaLibraryPage from "../../pages/media-library";

const promptCrudState = vi.hoisted(() => ({
  closePromptModal: vi.fn(),
  deletePrompt: vi.fn(),
  focusedPrompt: null as { id: string } | null,
  handlePromptEditChange: vi.fn(),
  openPromptModal: vi.fn(),
  promptEditValue: "",
  promptModalError: null as string | null,
  promptSaveSuccess: false,
  savePromptEdits: vi.fn(),
  savingPromptEdit: false,
}));

const fileModalState = vi.hoisted(() => ({
  cancelDeleteFile: vi.fn(),
  closeModal: vi.fn(),
  confirmDeleteFile: vi.fn(),
  deleteTarget: null as { id: string } | null,
  deletingSingle: false,
  handleRenameInputChange: vi.fn(),
  modalError: null as string | null,
  openModal: vi.fn(),
  renameSuccess: false,
  renameValue: "",
  requestDeleteFile: vi.fn(),
  saveRename: vi.fn(),
  savingRename: false,
  setModalError: vi.fn(),
}));

const bulkDeleteState = vi.hoisted(() => ({
  bulkDeleting: false,
  cancelDeleteSelected: vi.fn(),
  confirmDeleteIds: [] as string[],
  confirmDeleteSelected: vi.fn(),
  requestDeleteSelected: vi.fn(),
}));

const previewRuntimeState = vi.hoisted(() => ({
  activeMediaQueryRef: { current: "" },
  activeTabRef: { current: "uploaded_images" },
  applySignedUrlsToTab: vi.fn(),
  currentUserIdRef: { current: "user-1" },
  getMediaCardRef: vi.fn(),
  handleMediaPreviewError: vi.fn(),
  hydrateViaStorageDownload: vi.fn(),
  isMountedRef: { current: true },
  markFirstMediaPaint: vi.fn(),
  mediaSignInFlightRef: { current: {} },
  mediaTabRequestRef: {
    current: { uploaded_images: 0, uploaded_videos: 0, private: 0, ai_generations: 0 },
  },
  resolveSignedUrlsByMediaIds: vi.fn(),
  setSignPassNonce: vi.fn(),
  signAttemptRef: { current: {} },
  signBudget: { prefetchWindow: 24, signBatchSize: 12 },
  signPassNonce: 0,
  signStoragePath: vi.fn(async () => null),
  signedUrlRetryRef: { current: {} as Record<string, number> },
  visibleMediaIdsRef: { current: [] as string[] },
  visibleMediaVersion: 0,
}));

vi.mock("next/head", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("next/router", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("../../lib/adaptive-media", () => ({
  isAdaptiveSurfaceEnabled: () => false,
}));

vi.mock("../../lib/mediaPerfTelemetry", () => ({
  createMediaPerfTimer: () => vi.fn(),
  logMediaPerf: vi.fn(),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: () => ({
    rpc: vi.fn(() => new Promise(() => {})),
    storage: {
      from: () => ({
        download: vi.fn(async () => ({ data: new Blob(), error: null })),
      }),
    },
  }),
}));

vi.mock("../../features/billing/useResolvedAccountPlan", () => ({
  useResolvedAccountPlan: () => ({
    user: { id: "user-1", email: "kirk@example.com", user_metadata: { plan: "free" } },
    resolvedPlan: { id: "free", label: "Free", className: "plan-free" },
  }),
}));

vi.mock("../../features/billing/useMediaStorageQuotaSummary", () => ({
  useMediaStorageQuotaSummary: () => ({
    quotaSummary: {
      usedBytes: 50 * 1024 * 1024,
      baseLimitBytes: 1024 * 1024 * 1024,
      addonLimitBytes: 0,
      totalLimitBytes: 1024 * 1024 * 1024,
      remainingBytes: 974 * 1024 * 1024,
      isOverLimit: false,
    },
    loading: false,
    refreshQuotaSummary: vi.fn(),
  }),
}));

vi.mock("../../features/media-library/hooks/useMediaBulkMoveController", () => ({
  useMediaBulkMoveController: () => ({
    bulkMoveTabOptions: [],
    canBulkMove: false,
    moveSelectedFiles: vi.fn(),
    selectedMediaRows: [],
  }),
}));

vi.mock("../../features/media-library/hooks/useMediaBulkDeleteController", () => ({
  useMediaBulkDeleteController: () => bulkDeleteState,
}));

vi.mock("../../features/media-library/components/MediaLibraryModalStack", () => ({
  MediaLibraryModalStack: () => <div data-testid="media-library-modal-stack" />,
}));

vi.mock("../../features/media-library/components/MediaLibraryWorkspaceContent", () => ({
  MediaLibraryWorkspaceContent: ({
    headerProps,
    gallerySectionProps,
  }: {
    headerProps: {
      planLabel: string;
      planName: string;
    };
    gallerySectionProps: {
      onOpenFileModal: (file: { id: string; storage_path: string; file_type: string }) => void;
    };
  }) => (
    <div data-testid="media-library-workspace">
      <span>{headerProps.planLabel}</span>
      <span>{headerProps.planName}</span>
      <button
        type="button"
        onClick={() =>
          gallerySectionProps.onOpenFileModal({
            id: "file-1",
            storage_path: "users/1/file.png",
            file_type: "image",
          })
        }
      >
        Open file modal
      </button>
    </div>
  ),
}));

vi.mock("../../features/media-library/logic/mediaLibraryDataEffects", () => ({
  collectMediaStoragePathsForDelete: vi.fn(),
  logMediaEvent: vi.fn(),
  removeStoragePaths: vi.fn(),
}));

vi.mock("../../features/media-library/hooks/useMediaFileModalCrud", () => ({
  useMediaFileModalCrud: () => fileModalState,
}));

vi.mock("../../features/media-library/hooks/useMediaModalImageZoom", () => ({
  useMediaModalImageZoom: () => ({
    cacheModalImageNaturalSize: vi.fn(),
    handleModalImageClick: vi.fn(),
    handleModalImageKeyDown: vi.fn(),
    handleModalImagePointerDown: vi.fn(),
    handleModalImagePointerMove: vi.fn(),
    handleModalImagePointerUp: vi.fn(),
    handleModalImageWheel: vi.fn(),
    handleModalPreviewWheel: vi.fn(),
    isModalImagePanning: false,
    modalImagePan: { x: 0, y: 0 },
    modalImageZoomActive: false,
    modalImageZoomScale: 1,
    modalPreviewRef: { current: null },
    resetModalImageZoom: vi.fn(),
  }),
}));

vi.mock("../../features/media-library/hooks/useMediaPromptModalCrud", () => ({
  useMediaPromptModalCrud: () => promptCrudState,
}));

vi.mock("../../features/media-library/hooks/useMediaSurfacePreviewRuntime", () => ({
  useMediaSurfacePreviewRuntime: () => previewRuntimeState,
}));

vi.mock("../../features/media-library/hooks/useMediaPreviewSigningController", () => ({
  useMediaPreviewSigningController: () => undefined,
}));

vi.mock("../../features/media-library/hooks/useMediaSingleMoveController", () => ({
  useMediaSingleMoveController: () => ({
    applyMovedFilesToCaches: vi.fn(),
    canMoveToAnotherTab: false,
    clearMoveState: vi.fn(),
    modalMoveTabOptions: [],
    moveError: null,
    moveFocusedFile: vi.fn(),
    moveMenuOpen: false,
    movingFile: false,
    setMoveMenuOpen: vi.fn(),
  }),
}));

vi.mock("../../features/media-library/hooks/useMediaAdaptivePressure", () => ({
  useMediaAdaptivePressure: () => ({
    previewPressureLevel: "low",
  }),
}));

vi.mock("../../features/media-library/hooks/useMediaTabDataController", () => ({
  useMediaTabDataController: () => ({
    fetchMediaTabPage: vi.fn(),
    markInactiveMediaCachesStale: vi.fn(),
    updateVisibleRows: vi.fn(),
  }),
}));

vi.mock("../../features/media-library/hooks/useMediaUploadController", () => ({
  useMediaUploadController: () => ({
    handleDragLeave: vi.fn(),
    handleDragOver: vi.fn(),
    handleDrop: vi.fn(),
    handleFileChange: vi.fn(),
    isDragging: false,
    selectedFiles: [],
    uploadCount: 0,
    uploading: false,
  }),
}));

describe("Media Library route behavior", () => {
  beforeEach(() => {
    promptCrudState.closePromptModal.mockReset();
    promptCrudState.deletePrompt.mockReset();
    promptCrudState.focusedPrompt = null;
    fileModalState.cancelDeleteFile.mockReset();
    fileModalState.closeModal.mockReset();
    bulkDeleteState.cancelDeleteSelected.mockReset();
    bulkDeleteState.confirmDeleteIds = [];
    fileModalState.deleteTarget = null;
  });

  afterEach(() => {
    document.body.classList.remove("media-library-body");
    document.documentElement.classList.remove("media-library-body");
  });

  it("adds and removes the media-library body classes", () => {
    const { unmount } = render(<MediaLibraryPage />);

    expect(screen.getByText("Current plan")).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(document.body.classList.contains("media-library-body")).toBe(true);
    expect(document.documentElement.classList.contains("media-library-body")).toBe(true);

    unmount();

    expect(document.body.classList.contains("media-library-body")).toBe(false);
    expect(document.documentElement.classList.contains("media-library-body")).toBe(false);
  });

  it("prioritizes file delete confirmation when Escape is pressed", () => {
    fileModalState.deleteTarget = { id: "file-1" };

    render(<MediaLibraryPage />);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(fileModalState.cancelDeleteFile).toHaveBeenCalledTimes(1);
    expect(bulkDeleteState.cancelDeleteSelected).not.toHaveBeenCalled();
    expect(promptCrudState.closePromptModal).not.toHaveBeenCalled();
    expect(fileModalState.closeModal).not.toHaveBeenCalled();
  });

  it("prioritizes bulk delete confirmation next on Escape", () => {
    bulkDeleteState.confirmDeleteIds = ["file-1", "file-2"];

    render(<MediaLibraryPage />);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(bulkDeleteState.cancelDeleteSelected).toHaveBeenCalledTimes(1);
    expect(promptCrudState.closePromptModal).not.toHaveBeenCalled();
    expect(fileModalState.closeModal).not.toHaveBeenCalled();
  });

  it("closes the prompt modal on Escape before the file modal", () => {
    promptCrudState.focusedPrompt = { id: "prompt-1" };

    render(<MediaLibraryPage />);
    fireEvent.keyDown(window, { key: "Escape" });

    expect(promptCrudState.closePromptModal).toHaveBeenCalledTimes(1);
    expect(fileModalState.closeModal).not.toHaveBeenCalled();
  });
});
