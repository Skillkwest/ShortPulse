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
import type { GenerationAccessCta } from "../logic/generationAccessCta";
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
  mediaPlanAccessCta?: GenerationAccessCta | null;
  onMediaPlanAccessAttempt?: () => void;
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
  mediaPlanAccessCta = null,
  onMediaPlanAccessAttempt,
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
    addAgentPromptReference,
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
  const isPlanAccessBlocked = Boolean(mediaPlanAccessCta);
  const { handleDownloadReference, handleSaveReference } = useAiStudioReferenceAssetActions({
    projectId,
    findOutputById,
    saveReferenceToLibrary,
    setUiError,
    isMediaStorageFull: isMediaStorageFull || isPlanAccessBlocked,
    onStorageBlockedSaveAttempt: isPlanAccessBlocked ? onMediaPlanAccessAttempt : undefined,
  });
  const handlePlanBlockedTextReference = useMemo(
    () =>
      isPlanAccessBlocked
        ? () => {
            onMediaPlanAccessAttempt?.();
          }
        : addPastedPromptReference,
    [addPastedPromptReference, isPlanAccessBlocked, onMediaPlanAccessAttempt]
  );
  const handlePlanBlockedMediaReference = useMemo(
    () =>
      isPlanAccessBlocked
        ? () => {
            onMediaPlanAccessAttempt?.();
          }
        : addPastedMediaReference,
    [addPastedMediaReference, isPlanAccessBlocked, onMediaPlanAccessAttempt]
  );
  const handlePlanBlockedReferencePromptPin = useMemo(
    () =>
      isPlanAccessBlocked
        ? () => {
            onMediaPlanAccessAttempt?.();
          }
        : addAgentPromptReference,
    [addAgentPromptReference, isPlanAccessBlocked, onMediaPlanAccessAttempt]
  );
  const notifyPlanBlockedVoid = useMemo(
    () =>
      isPlanAccessBlocked
        ? () => {
            onMediaPlanAccessAttempt?.();
          }
        : null,
    [isPlanAccessBlocked, onMediaPlanAccessAttempt]
  );
  const handlePlanBlockedComposerPin = useMemo(
    () =>
      isPlanAccessBlocked
        ? () => {
            onMediaPlanAccessAttempt?.();
          }
        : null,
    [isPlanAccessBlocked, onMediaPlanAccessAttempt]
  );
  const handlePlanBlockedSavePromptToLibrary = useMemo(
    () =>
      isPlanAccessBlocked
        ? () => {
            onMediaPlanAccessAttempt?.();
            return false;
          }
        : savePromptToLibrary,
    [isPlanAccessBlocked, onMediaPlanAccessAttempt, savePromptToLibrary]
  );
  const panelPropsWithMediaPlanAccess = useMemo(() => {
    if (!handlePlanBlockedComposerPin) {
      return {
        propertiesCreate,
        propertiesEditExpert,
        propertiesVideo,
      };
    }
    const propertiesCreateWithBlockedPin =
      propertiesCreate.expertCreateMode === "standard"
        ? {
            ...propertiesCreate,
            standard: {
              ...propertiesCreate.standard,
              onPinPromptReference: handlePlanBlockedComposerPin,
            },
          }
        : propertiesCreate;

    return {
      propertiesCreate: propertiesCreateWithBlockedPin,
      propertiesEditExpert: {
        ...propertiesEditExpert,
        onPinPromptReference: handlePlanBlockedComposerPin,
      },
      propertiesVideo: {
        ...propertiesVideo,
        onPinPromptReference: handlePlanBlockedComposerPin,
      },
    };
  }, [handlePlanBlockedComposerPin, propertiesCreate, propertiesEditExpert, propertiesVideo]);
  const canvasMediaActions = useMemo(
    () => ({
      getOutputForCanvasItem: (item: CanvasSceneItem) => {
        if (!item.outputId) return null;
        return findOutputById(item.outputId);
      },
      onSelectOutput: handleSelectOutput,
      onSaveToLibrary: (output: StudioOutput) => handleSaveReference(output.id),
      onDownload: (output: StudioOutput) => handleDownloadReference(output.id),
      onPinPromptReference: handlePlanBlockedReferencePromptPin,
      onRerollOutput: (output: StudioOutput) => resolvedRerollOutput(output.id),
      onReloadWorkflowOutput: manualWorkflowReloadHandler,
      onRemoveCanvasItem: removeCanvasItemById,
      isMediaStorageFull: isMediaStorageFull || isPlanAccessBlocked,
    }),
    [
      findOutputById,
      handleDownloadReference,
      handlePlanBlockedReferencePromptPin,
      handleSaveReference,
      handleSelectOutput,
      isMediaStorageFull,
      isPlanAccessBlocked,
      manualWorkflowReloadHandler,
      removeCanvasItemById,
      resolvedRerollOutput,
    ]
  );
  const railCanvasPropsWithMediaActions = useMemo(() => {
    if (!railCanvasProps) return railCanvasProps;
    const currentRailCanvasProps = railCanvasProps as typeof railCanvasProps & {
      onPinTextReference?: (text: string) => void;
    };

    return {
      ...railCanvasProps,
      onPinTextReference: isPlanAccessBlocked
        ? () => {
            onMediaPlanAccessAttempt?.();
          }
        : currentRailCanvasProps.onPinTextReference,
      mediaActions: canvasMediaActions,
    };
  }, [canvasMediaActions, isPlanAccessBlocked, onMediaPlanAccessAttempt, railCanvasProps]);
  const referenceGridHookProps = useAiStudioReferenceGridProps({
    readOutputsFromStore: true,
    activeOutputId,
    topNotice: isMediaStorageFull && !isPlanAccessBlocked ? MEDIA_STORAGE_FULL_USER_MESSAGE : null,
    curatedReferenceIds,
    removedFromAllRefsIds,
    isMediaStorageFull: isMediaStorageFull || isPlanAccessBlocked,
    onReferenceOutputMediaLoaded,
    linkedPromptReferenceIds,
    handleSelectOutput,
    detailSelectionTarget,
    openDetailSelectionTarget: setDetailSelectionTarget,
    setDetailOutputId,
    handleSaveReference,
    handleDownloadReference,
    handlePinPromptReference: handlePlanBlockedReferencePromptPin,
    handlePasteTextReference: handlePlanBlockedTextReference,
    handlePasteMediaReference: handlePlanBlockedMediaReference,
    handleAddLibraryMediaReference: isPlanAccessBlocked
      ? () => notifyPlanBlockedVoid?.()
      : addLibraryMediaReference,
    handleAddLibraryMediaReferences: isPlanAccessBlocked
      ? () => notifyPlanBlockedVoid?.()
      : addLibraryMediaReferences,
    handleAddLibraryPromptReference: isPlanAccessBlocked
      ? () => notifyPlanBlockedVoid?.()
      : addLibraryPromptReference,
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
      onAddDroppedFilesToQuickSlot: isPlanAccessBlocked
        ? async () => {
            onMediaPlanAccessAttempt?.();
            return [];
          }
        : handleQuickSlotDroppedFiles,
      onAddPastedMediaReferenceToQuickSlot: isPlanAccessBlocked
        ? () => {
            onMediaPlanAccessAttempt?.();
            return null;
          }
        : handleQuickSlotDroppedMediaReference,
      onAddLibraryMediaReferenceToQuickSlot: isPlanAccessBlocked
        ? async () => {
            onMediaPlanAccessAttempt?.();
            return null;
          }
        : handleQuickSlotLibraryMediaDrop,
      onAddLibraryMediaReferencesToQuickSlot: isPlanAccessBlocked
        ? async () => {
            onMediaPlanAccessAttempt?.();
            return [];
          }
        : handleQuickSlotLibraryMediaBulkDrop,
      onAddLibraryPromptReferenceToQuickSlot: isPlanAccessBlocked
        ? () => {
            onMediaPlanAccessAttempt?.();
            return null;
          }
        : handleQuickSlotLibraryPromptDrop,
    };
  }, [
    handleQuickSlotDroppedFiles,
    handleQuickSlotDroppedMediaReference,
    handleQuickSlotLibraryMediaDrop,
    handleQuickSlotLibraryMediaBulkDrop,
    handleQuickSlotLibraryPromptDrop,
    isPlanAccessBlocked,
    onMediaPlanAccessAttempt,
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
    isMediaStorageFull: isMediaStorageFull || isPlanAccessBlocked,
    savePromptToLibrary: handlePlanBlockedSavePromptToLibrary,
    handleOpenMediaLibrary,
  });

  return mapHookContractsToPageContentProps({
    panelProps: {
      propertiesCreate: panelPropsWithMediaPlanAccess.propertiesCreate,
      propertiesEditExpert: panelPropsWithMediaPlanAccess.propertiesEditExpert,
      propertiesVideo: panelPropsWithMediaPlanAccess.propertiesVideo,
    },
    referenceGridProps: referenceGridPageProps,
    previewDetailProps,
  });
};
