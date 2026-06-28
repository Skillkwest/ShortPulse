/**
 * Reference-grid and preview-detail runtime assembly for AI Studio.
 * Keeps reference-surface orchestration out of the page composition root while preserving the page-content contract.
 */
import { useMemo } from "react";
import type { AiStudioPageContentProps } from "../components/AiStudioPageContent";
import { useAiStudioReferenceAssetActions } from "./useAiStudioReferenceAssetActions";
import { useAiStudioReferenceGridProps } from "./useAiStudioReferenceGridProps";
import { useAiStudioPreviewDetailProps } from "./useAiStudioPreviewDetailProps";
import { mapHookContractsToPageContentProps } from "./contracts/pageContentAdapter";
import type { AiStudioPageBaseRuntime } from "./useAiStudioPageBaseRuntime";
import { MEDIA_STORAGE_FULL_USER_MESSAGE } from "../../../lib/mediaStorageQuota";
import type { useAiStudioWorkspaceActions } from "./useAiStudioWorkspaceActions";
import type { useAiStudioGenerationController } from "./useAiStudioGenerationController";
import type { CanvasSceneItem } from "../components/canvas/canvasTypes";
import type { StudioOutput } from "../types";
import { isManualWorkflowReloadEnabled } from "../logic/workflowReloadAvailability";

type CreatePanelProps = AiStudioPageContentProps["propertiesCreate"];
type EditPanelProps = AiStudioPageContentProps["propertiesEditExpert"];
type VideoPanelProps = AiStudioPageContentProps["propertiesVideo"];
type PageContentRuntimeProps = ReturnType<typeof mapHookContractsToPageContentProps>;

type UseAiStudioReferenceExperienceRuntimeParams = {
  base: AiStudioPageBaseRuntime;
  isMediaStorageFull: boolean;
  linkedPromptReferenceIds: string[];
  propertiesCreate: CreatePanelProps;
  propertiesEditExpert: EditPanelProps;
  propertiesVideo: VideoPanelProps;
  handleSelectOutput: ReturnType<typeof useAiStudioWorkspaceActions>["handleSelectOutput"];
  handleManualPromptChange: ReturnType<
    typeof useAiStudioWorkspaceActions
  >["handleManualPromptChange"];
  handleRegenerateWithDebit: ReturnType<
    typeof useAiStudioGenerationController
  >["handleRegenerateWithDebit"];
  handleOpenMediaLibrary: ReturnType<typeof useAiStudioWorkspaceActions>["handleOpenMediaLibrary"];
  handleRerollOutput?: (outputId: string) => void;
};

/**
 * Builds the reference-grid and preview-detail contracts that feed `AiStudioPageContent`.
 */
export const useAiStudioReferenceExperienceRuntime = ({
  base,
  isMediaStorageFull,
  linkedPromptReferenceIds,
  propertiesCreate,
  propertiesEditExpert,
  propertiesVideo,
  handleSelectOutput,
  handleManualPromptChange,
  handleRegenerateWithDebit,
  handleOpenMediaLibrary,
  handleRerollOutput,
}: UseAiStudioReferenceExperienceRuntimeParams): PageContentRuntimeProps => {
  const {
    activeOutput,
    activeOutputId,
    addCuratedReference,
    addLibraryMediaReference,
    addLibraryMediaReferences,
    addLibraryPromptReference,
    addPastedMediaReference,
    addPastedPromptReference,
    clearGenerationOutput,
    curatedReferenceIds,
    deleteOutput,
    detailOutput,
    detailSelectionTarget,
    setDetailSelectionTarget,
    editReferenceText,
    findOutputById,
    handleQuickSlotLibraryMediaDrop,
    handleQuickSlotLibraryMediaBulkDrop,
    handleQuickSlotDroppedFiles,
    handleQuickSlotDroppedMediaReference,
    handleQuickSlotLibraryPromptDrop,
    onReferenceOutputMediaLoaded,
    projectId,
    railCanvasProps,
    removeCanvasItemById,
    referenceGridReadyOutputIds,
    referenceImageUrl,
    removedFromAllRefsIds,
    removeCuratedReference,
    reorderCuratedReference,
    reloadWorkflowFromStudioOutput,
    rerollOutputFromReplay,
    restoreAllArchivedOutputs,
    restoreArchivedOutput,
    savePromptToLibrary,
    saveReferenceToLibrary,
    selectedTool,
    setDetailOutputId,
    setReferenceImageUrl,
    setUiError,
    updateOutputPrompt,
    videoReferenceText,
  } = base;
  const resolvedRerollOutput = handleRerollOutput ?? rerollOutputFromReplay;
  const manualWorkflowReloadHandler = isManualWorkflowReloadEnabled()
    ? reloadWorkflowFromStudioOutput
    : undefined;
  const { handleDownloadReference, handleSaveReference } = useAiStudioReferenceAssetActions({
    projectId,
    findOutputById,
    saveReferenceToLibrary,
    setUiError,
    isMediaStorageFull,
  });
  const canvasMediaActions = useMemo(
    () => ({
      getOutputForCanvasItem: (item: CanvasSceneItem) => {
        if (!item.outputId) return null;
        return findOutputById(item.outputId);
      },
      onSelectOutput: handleSelectOutput,
      onSaveToLibrary: (output: StudioOutput) => handleSaveReference(output.id),
      onDownload: (output: StudioOutput) => handleDownloadReference(output.id),
      onRerollOutput: (output: StudioOutput) => resolvedRerollOutput(output.id),
      onReloadWorkflowOutput: manualWorkflowReloadHandler,
      onRemoveCanvasItem: removeCanvasItemById,
      isMediaStorageFull,
    }),
    [
      findOutputById,
      handleDownloadReference,
      handleSaveReference,
      handleSelectOutput,
      isMediaStorageFull,
      manualWorkflowReloadHandler,
      removeCanvasItemById,
      resolvedRerollOutput,
    ]
  );
  const railCanvasPropsWithMediaActions = useMemo(
    () =>
      railCanvasProps
        ? {
            ...railCanvasProps,
            mediaActions: canvasMediaActions,
          }
        : railCanvasProps,
    [canvasMediaActions, railCanvasProps]
  );
  const referenceGridHookProps = useAiStudioReferenceGridProps({
    readOutputsFromStore: true,
    activeOutputId,
    topNotice: isMediaStorageFull ? MEDIA_STORAGE_FULL_USER_MESSAGE : null,
    curatedReferenceIds,
    removedFromAllRefsIds,
    isMediaStorageFull,
    onReferenceOutputMediaLoaded,
    linkedPromptReferenceIds,
    handleSelectOutput,
    detailSelectionTarget,
    openDetailSelectionTarget: setDetailSelectionTarget,
    setDetailOutputId,
    handleSaveReference,
    handleDownloadReference,
    handlePasteTextReference: addPastedPromptReference,
    handlePasteMediaReference: addPastedMediaReference,
    handleAddLibraryMediaReference: addLibraryMediaReference,
    handleAddLibraryMediaReferences: addLibraryMediaReferences,
    handleAddLibraryPromptReference: addLibraryPromptReference,
    handleRerollOutput: resolvedRerollOutput,
    handleReloadWorkflowOutput: manualWorkflowReloadHandler,
    deleteOutput,
    clearGenerationOutput,
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
  });
  const detailNavigation = referenceGridHookProps.detailNavigation;
  const referenceGridPageProps = useMemo(() => {
    const { detailNavigation: _detailNavigation, ...referenceGridComponentProps } =
      referenceGridHookProps;
    void _detailNavigation;
    return {
      ...referenceGridComponentProps,
      railCanvasProps: railCanvasPropsWithMediaActions,
      onAddDroppedFilesToQuickSlot: handleQuickSlotDroppedFiles,
      onAddPastedMediaReferenceToQuickSlot: handleQuickSlotDroppedMediaReference,
      onAddLibraryMediaReferenceToQuickSlot: handleQuickSlotLibraryMediaDrop,
      onAddLibraryMediaReferencesToQuickSlot: handleQuickSlotLibraryMediaBulkDrop,
      onAddLibraryPromptReferenceToQuickSlot: handleQuickSlotLibraryPromptDrop,
    };
  }, [
    handleQuickSlotDroppedFiles,
    handleQuickSlotDroppedMediaReference,
    handleQuickSlotLibraryMediaDrop,
    handleQuickSlotLibraryMediaBulkDrop,
    handleQuickSlotLibraryPromptDrop,
    railCanvasPropsWithMediaActions,
    referenceGridHookProps,
  ]);
  const previewDetailProps = useAiStudioPreviewDetailProps({
    activeOutput,
    referenceGridReadyOutputIds,
    referenceImageUrl,
    selectedTool,
    videoReferenceText,
    editReferenceText,
    setReferenceImageUrl,
    handleManualPromptChange,
    handleRegenerateWithDebit,
    detailOutput,
    detailNavigation,
    setDetailSelectionTarget,
    setDetailOutputId,
    updateOutputPrompt,
    deleteOutput,
    handleSaveReference,
    handleDownloadReference,
    isMediaStorageFull,
    savePromptToLibrary,
    handleOpenMediaLibrary,
  });

  return mapHookContractsToPageContentProps({
    panelProps: {
      propertiesCreate,
      propertiesEditExpert,
      propertiesVideo,
    },
    referenceGridProps: referenceGridPageProps,
    previewDetailProps,
  });
};
