import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import type { AiStudioPageBaseRuntime } from "../useAiStudioPageBaseRuntime";
import { useAiStudioReferenceExperienceRuntime } from "../useAiStudioReferenceExperienceRuntime";

vi.mock("../useAiStudioReferenceAssetActions", () => ({
  useAiStudioReferenceAssetActions: () => ({
    handleDownloadReference: vi.fn(),
    handleSaveReference: vi.fn(),
  }),
}));

vi.mock("../useAiStudioPreviewDetailProps", () => ({
  useAiStudioPreviewDetailProps: () => ({
    studioPreviewProps: {},
    detailModalOutput: null,
    isMediaStorageFull: false,
    onDetailClose: vi.fn(),
    onUpdateOutputPrompt: vi.fn(),
    onDeleteOutput: vi.fn(),
    onDetailDownload: vi.fn(),
    onDetailSaveReference: vi.fn(),
    onDetailSavePrompt: vi.fn(),
    onOpenMediaLibrary: vi.fn(),
  }),
}));

const output: StudioOutput = {
  id: "video-out-1",
  prompt: "A restored video workflow",
  mode: "video",
  aspect: "16:9",
  model: "Kling 3.0",
  modelId: "kie-ai/kling-3.0",
  status: "ready",
  timestamp: "2026-06-15T00:00:00.000Z",
  previewUrl: "https://example.com/video.mp4",
};

const createBaseRuntime = (
  overrides: Partial<AiStudioPageBaseRuntime> = {}
): AiStudioPageBaseRuntime =>
  ({
    activeOutput: null,
    activeOutputId: null,
    addCuratedReference: vi.fn(),
    addLibraryMediaReference: vi.fn(),
    addLibraryPromptReference: vi.fn(),
    addPastedMediaReference: vi.fn(),
    addPastedPromptReference: vi.fn(),
    clearGenerationOutput: vi.fn(),
    curatedReferenceIds: [],
    deleteOutput: vi.fn(),
    detailOutput: null,
    setDetailSelectionTarget: vi.fn(),
    editReferenceText: "",
    findOutputById: vi.fn(),
    handleQuickSlotLibraryMediaDrop: vi.fn(),
    handleQuickSlotDroppedFiles: vi.fn(),
    handleQuickSlotDroppedMediaReference: vi.fn(),
    handleQuickSlotLibraryPromptDrop: vi.fn(),
    onReferenceOutputMediaLoaded: vi.fn(),
    projectId: "project-1",
    railCanvasProps: undefined,
    referenceGridReadyOutputIds: new Set<string>(),
    referenceImageUrl: null,
    removedFromAllRefsIds: [],
    removeCuratedReference: vi.fn(),
    reorderCuratedReference: vi.fn(),
    reloadWorkflowFromStudioOutput: vi.fn(),
    rerollOutputFromReplay: vi.fn(),
    restoreAllArchivedOutputs: vi.fn(),
    restoreArchivedOutput: vi.fn(),
    retryOutputStatus: vi.fn(),
    savePromptToLibrary: vi.fn(),
    saveReferenceToLibrary: vi.fn(),
    selectedTool: "video",
    setDetailOutputId: vi.fn(),
    setReferenceImageUrl: vi.fn(),
    setUiError: vi.fn(),
    updateOutputPrompt: vi.fn(),
    videoReferenceText: "",
    ...overrides,
  }) as AiStudioPageBaseRuntime;

describe("useAiStudioReferenceExperienceRuntime", () => {
  it("routes Reference Grid workflow reload through the clicked output snapshot", () => {
    const reloadWorkflowFromOutput = vi.fn();
    const reloadWorkflowFromStudioOutput = vi.fn();
    const base = createBaseRuntime({
      reloadWorkflowFromOutput,
      reloadWorkflowFromStudioOutput,
    });

    const { result } = renderHook(() =>
      useAiStudioReferenceExperienceRuntime({
        base,
        isMediaStorageFull: false,
        linkedPromptReferenceIds: [],
        propertiesCreate: {} as never,
        propertiesEditExpert: {} as never,
        propertiesVideo: {} as never,
        handleSelectOutput: vi.fn(),
        handleManualPromptChange: vi.fn(),
        handleRegenerateWithDebit: vi.fn(),
        handleOpenMediaLibrary: vi.fn(),
      })
    );

    result.current.referenceGridProps.onReloadWorkflowOutput?.(output);

    expect(reloadWorkflowFromStudioOutput).toHaveBeenCalledWith(output);
    expect(reloadWorkflowFromOutput).not.toHaveBeenCalled();
  });
});
