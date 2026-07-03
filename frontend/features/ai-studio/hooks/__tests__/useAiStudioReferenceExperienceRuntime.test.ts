import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import type { AiStudioPageBaseRuntime } from "../useAiStudioPageBaseRuntime";
import { useAiStudioReferenceExperienceRuntime } from "../useAiStudioReferenceExperienceRuntime";
import type { CanvasImageItem } from "../../components/canvas/canvasTypes";
import type { CanvasPropertiesPanelProps } from "../../components/canvas/canvasWorkspaceContracts";
import { resetAiStudioOutputStore, setAiStudioOutputStoreSnapshot } from "../aiStudioOutputStore";

const MANUAL_WORKFLOW_RELOAD_FLAG = "NEXT_PUBLIC_AI_STUDIO_MANUAL_WORKFLOW_RELOAD_ENABLED";
const originalManualWorkflowReloadFlag = process.env[MANUAL_WORKFLOW_RELOAD_FLAG];

vi.mock("../useAiStudioReferenceAssetActions", () => ({
  useAiStudioReferenceAssetActions: () => ({
    handleDownloadReference: vi.fn(),
    handleSaveReference: vi.fn(),
  }),
}));

vi.mock("../useAiStudioPreviewDetailProps", () => ({
  useAiStudioPreviewDetailProps: (params: { detailNavigation?: unknown }) => ({
    studioPreviewProps: {},
    detailModalOutput: null,
    detailNavigation: params.detailNavigation ?? null,
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

const createOutput = (id: string, prompt = id): StudioOutput => ({
  ...output,
  id,
  prompt,
  previewUrl: `https://example.com/${id}.mp4`,
});

const createBaseRuntime = (
  overrides: Partial<AiStudioPageBaseRuntime> = {}
): AiStudioPageBaseRuntime =>
  ({
    activeOutput: null,
    activeOutputId: null,
    addCuratedReference: vi.fn(),
    addLibraryMediaReference: vi.fn(),
    addLibraryMediaReferences: vi.fn(),
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
    handleQuickSlotLibraryMediaBulkDrop: vi.fn(),
    handleQuickSlotDroppedFiles: vi.fn(),
    handleQuickSlotDroppedMediaReference: vi.fn(),
    handleQuickSlotLibraryPromptDrop: vi.fn(),
    onReferenceOutputMediaLoaded: vi.fn(),
    projectId: "project-1",
    railCanvasProps: undefined,
    removeCanvasItemById: vi.fn(),
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
  beforeEach(() => {
    process.env[MANUAL_WORKFLOW_RELOAD_FLAG] = "true";
    resetAiStudioOutputStore();
  });

  afterEach(() => {
    if (originalManualWorkflowReloadFlag === undefined) {
      delete process.env[MANUAL_WORKFLOW_RELOAD_FLAG];
      return;
    }
    process.env[MANUAL_WORKFLOW_RELOAD_FLAG] = originalManualWorkflowReloadFlag;
  });

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

    expect(reloadWorkflowFromStudioOutput).toHaveBeenCalledWith(output, undefined);
    expect(reloadWorkflowFromOutput).not.toHaveBeenCalled();
  });

  it("decorates rail Canvas props with the shared Reference Grid media action handlers", () => {
    const findOutputById = vi.fn(() => output);
    const handleSelectOutput = vi.fn();
    const deleteOutput = vi.fn();
    const rerollOutputFromReplay = vi.fn();
    const reloadWorkflowFromStudioOutput = vi.fn();
    const railCanvasProps = {
      camera: { x: 0, y: 0, zoom: 1 },
      items: [],
      pendingItems: [],
    } as unknown as CanvasPropertiesPanelProps;
    const base = createBaseRuntime({
      deleteOutput,
      findOutputById,
      railCanvasProps,
      reloadWorkflowFromStudioOutput,
      rerollOutputFromReplay,
    });

    const { result } = renderHook(() =>
      useAiStudioReferenceExperienceRuntime({
        base,
        isMediaStorageFull: false,
        linkedPromptReferenceIds: [],
        propertiesCreate: {} as never,
        propertiesEditExpert: {} as never,
        propertiesVideo: {} as never,
        handleSelectOutput,
        handleManualPromptChange: vi.fn(),
        handleRegenerateWithDebit: vi.fn(),
        handleOpenMediaLibrary: vi.fn(),
      })
    );
    const mediaActions = result.current.referenceGridProps.railCanvasProps?.mediaActions;
    const item = {
      id: "canvas-image-1",
      kind: "image",
      outputId: "video-out-1",
    } as CanvasImageItem;

    expect(mediaActions?.getOutputForCanvasItem(item)).toBe(output);

    mediaActions?.onSelectOutput?.("video-out-1");
    mediaActions?.onRemoveCanvasItem?.("canvas-image-1");
    mediaActions?.onRerollOutput?.(output);
    mediaActions?.onReloadWorkflowOutput?.(output, { mediaKindHint: "video" });

    expect(handleSelectOutput).toHaveBeenCalledWith("video-out-1");
    expect(base.removeCanvasItemById).toHaveBeenCalledWith("canvas-image-1");
    expect(deleteOutput).not.toHaveBeenCalled();
    expect(rerollOutputFromReplay).toHaveBeenCalledWith("video-out-1");
    expect(reloadWorkflowFromStudioOutput).toHaveBeenCalledWith(output, {
      mediaKindHint: "video",
    });
  });

  it("preserves Reference Grid detail navigation through the preview-detail contract", () => {
    const firstOutput = createOutput("out-1", "First");
    const secondOutput = createOutput("out-2", "Second");
    const thirdOutput = createOutput("out-3", "Third");
    const handleSelectOutput = vi.fn();
    const setDetailSelectionTarget = vi.fn();
    const setDetailOutputId = vi.fn();
    setAiStudioOutputStoreSnapshot({
      outputOrder: [firstOutput.id, secondOutput.id, thirdOutput.id],
      outputById: {
        [firstOutput.id]: firstOutput,
        [secondOutput.id]: secondOutput,
        [thirdOutput.id]: thirdOutput,
      },
      archivedOutputOrder: [],
      archivedOutputById: {},
    });
    const base = createBaseRuntime({
      detailSelectionTarget: {
        kind: "studio-output",
        outputId: secondOutput.id,
        surface: "reference-grid",
      },
      setDetailSelectionTarget,
      setDetailOutputId,
    });

    const { result } = renderHook(() =>
      useAiStudioReferenceExperienceRuntime({
        base,
        isMediaStorageFull: false,
        linkedPromptReferenceIds: [],
        propertiesCreate: {} as never,
        propertiesEditExpert: {} as never,
        propertiesVideo: {} as never,
        handleSelectOutput,
        handleManualPromptChange: vi.fn(),
        handleRegenerateWithDebit: vi.fn(),
        handleOpenMediaLibrary: vi.fn(),
      })
    );

    expect(result.current.detailNavigation).toMatchObject({
      sourceSurface: "reference-grid",
      canNavigatePrevious: true,
      canNavigateNext: true,
    });

    result.current.detailNavigation?.onNavigateNext();

    expect(handleSelectOutput).toHaveBeenCalledWith(thirdOutput.id);
    expect(setDetailSelectionTarget).toHaveBeenCalledWith({
      kind: "studio-output",
      outputId: thirdOutput.id,
      surface: "reference-grid",
      outputSnapshot: thirdOutput,
    });
    expect(setDetailOutputId).toHaveBeenCalledWith(thirdOutput.id);
  });

  it("routes baseline composer pin clicks to the media plan notice without adding references", () => {
    const onMediaPlanAccessAttempt = vi.fn();
    const createPin = vi.fn();
    const editPin = vi.fn();
    const videoPin = vi.fn();
    const base = createBaseRuntime();

    const { result } = renderHook(() =>
      useAiStudioReferenceExperienceRuntime({
        base,
        isMediaStorageFull: false,
        mediaPlanAccessCta: {
          label: "View plans",
          href: "/pricing",
          ariaLabel: "View subscription plans",
        },
        onMediaPlanAccessAttempt,
        linkedPromptReferenceIds: [],
        propertiesCreate: {
          expertCreateMode: "standard",
          standard: {
            onPinPromptReference: createPin,
          } as never,
        },
        propertiesEditExpert: {
          onPinPromptReference: editPin,
        } as never,
        propertiesVideo: {
          onPinPromptReference: videoPin,
        } as never,
        handleSelectOutput: vi.fn(),
        handleManualPromptChange: vi.fn(),
        handleRegenerateWithDebit: vi.fn(),
        handleOpenMediaLibrary: vi.fn(),
      })
    );

    if (result.current.propertiesCreate.expertCreateMode === "standard") {
      result.current.propertiesCreate.standard.onPinPromptReference?.("baseline text reference");
    }
    result.current.propertiesEditExpert.onPinPromptReference?.("baseline edit reference");
    result.current.propertiesVideo.onPinPromptReference?.("baseline video reference");

    expect(onMediaPlanAccessAttempt).toHaveBeenCalledTimes(3);
    expect(createPin).not.toHaveBeenCalled();
    expect(editPin).not.toHaveBeenCalled();
    expect(videoPin).not.toHaveBeenCalled();
  });
});
