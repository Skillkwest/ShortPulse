/**
 * AI Studio reference-grid prop composition hook.
 * Keeps reference grid action wiring out of the page orchestrator.
 */
import { useCallback, useMemo } from "react";
import type { SharedMediaDetailSelectionTarget } from "../components/detail-modal/detailModalPlatformTypes";
import type { StudioOutput, WorkflowReloadMediaKindHint } from "../types";
import type { AiStudioReferenceGridRuntimeContract } from "./contracts/pageContentContracts";
import { selectVisibleAllRefsProjection } from "../reference-projections";
import type {
  LibraryMediaReferencePayload,
  LibraryPromptReferencePayload,
} from "../reference-grid/referenceGridTypes";
import {
  getAiStudioOutputSnapshot,
  selectVisibleAllRefsOutputIdsFromStoreSnapshot,
  useOutputSelector,
} from "./aiStudioOutputStore";

const EMPTY_ARCHIVED_OUTPUTS: StudioOutput[] = [];

export type UseAiStudioReferenceGridPropsParams = {
  outputs?: StudioOutput[];
  archivedOutputs?: StudioOutput[];
  readOutputsFromStore?: boolean;
  activeOutputId: string | null;
  topNotice?: string | null;
  curatedReferenceIds?: string[];
  removedFromAllRefsIds?: string[];
  onReferenceOutputMediaLoaded: (id: string) => void;
  linkedPromptReferenceIds: string[];
  handleSelectOutput: (id: string) => void;
  detailSelectionTarget?: SharedMediaDetailSelectionTarget | null;
  openDetailSelectionTarget: (target: SharedMediaDetailSelectionTarget | null) => void;
  setDetailOutputId: (id: string | null) => void;
  handleSaveReference: (id: string) => void;
  handleDownloadReference: (id: string) => void;
  handlePinPromptReference?: (text: string) => void;
  isMediaStorageFull?: boolean;
  handlePasteTextReference: (text: string) => void;
  handlePasteMediaReference: (reference: { url: string; mimeType?: string | null }) => void;
  handleAddLibraryMediaReference?: (payload: LibraryMediaReferencePayload) => void;
  handleAddLibraryMediaReferences?: (payloads: LibraryMediaReferencePayload[]) => void;
  handleAddLibraryPromptReference?: (payload: LibraryPromptReferencePayload) => void;
  handleRerollOutput?: (id: string) => void;
  handleReloadWorkflowOutput?: (
    output: StudioOutput,
    options?: { mediaKindHint?: WorkflowReloadMediaKindHint | null }
  ) => void;
  deleteOutput: (id: string) => void;
  clearGenerationOutput?: (id: string) => void;
  addCuratedReference?: (id: string) => void;
  removeCuratedReference?: (id: string) => void;
  reorderCuratedReference?: (
    id: string,
    targetId: string | null,
    placement: "start" | "before" | "after" | "end"
  ) => void;
  restoreArchivedOutput?: (id: string) => void;
  restoreAllArchivedOutputs?: () => void;
};

const areIdListsEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((item, index) => item === right[index]);

/**
 * Returns the reference-grid props consumed by `AiStudioPageContent`.
 */
export const useAiStudioReferenceGridProps = ({
  outputs,
  archivedOutputs,
  readOutputsFromStore = false,
  activeOutputId,
  topNotice = null,
  curatedReferenceIds = [],
  removedFromAllRefsIds = [],
  onReferenceOutputMediaLoaded,
  linkedPromptReferenceIds,
  handleSelectOutput,
  detailSelectionTarget = null,
  openDetailSelectionTarget,
  setDetailOutputId,
  handleSaveReference,
  handleDownloadReference,
  handlePinPromptReference,
  isMediaStorageFull = false,
  handlePasteTextReference,
  handlePasteMediaReference,
  handleAddLibraryMediaReference,
  handleAddLibraryMediaReferences,
  handleAddLibraryPromptReference,
  handleRerollOutput,
  handleReloadWorkflowOutput,
  deleteOutput,
  clearGenerationOutput,
  addCuratedReference,
  removeCuratedReference,
  reorderCuratedReference,
  restoreArchivedOutput,
  restoreAllArchivedOutputs,
}: UseAiStudioReferenceGridPropsParams): AiStudioReferenceGridRuntimeContract => {
  const directOutputs = readOutputsFromStore ? undefined : outputs;
  const directArchivedOutputs = readOutputsFromStore
    ? undefined
    : outputs === undefined && archivedOutputs === undefined
      ? undefined
      : (archivedOutputs ?? EMPTY_ARCHIVED_OUTPUTS);
  const directVisibleAllRefsOutputIds = useMemo(
    () =>
      directOutputs
        ? selectVisibleAllRefsProjection(directOutputs, {
            quickSlotIds: [],
            removedFromAllRefsIds: [...removedFromAllRefsIds],
          }).map((item) => item.id)
        : [],
    [directOutputs, removedFromAllRefsIds]
  );
  const directOutputById = useMemo(() => {
    const map: Record<string, StudioOutput> = {};
    directOutputs?.forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [directOutputs]);
  const selectorVisibleAllRefsOutputIds = useOutputSelector(
    useCallback(
      (snapshot) => {
        if (!readOutputsFromStore) return [];
        return selectVisibleAllRefsOutputIdsFromStoreSnapshot(snapshot, {
          removedFromAllRefsIds,
        });
      },
      [readOutputsFromStore, removedFromAllRefsIds]
    ),
    areIdListsEqual
  );
  const visibleAllRefsOutputIds = readOutputsFromStore
    ? selectorVisibleAllRefsOutputIds
    : directVisibleAllRefsOutputIds;
  const referenceGridDetailOutputId =
    detailSelectionTarget?.kind === "studio-output" &&
    detailSelectionTarget.surface === "reference-grid"
      ? detailSelectionTarget.outputId
      : null;
  const detailNavigationIndex = referenceGridDetailOutputId
    ? visibleAllRefsOutputIds.indexOf(referenceGridDetailOutputId)
    : -1;
  const navigateReferenceGridDetail = useCallback(
    (direction: "previous" | "next") => {
      if (!referenceGridDetailOutputId) return;
      const snapshot = readOutputsFromStore ? getAiStudioOutputSnapshot() : null;
      const currentVisibleIds = snapshot
        ? selectVisibleAllRefsOutputIdsFromStoreSnapshot(snapshot, {
            removedFromAllRefsIds,
          })
        : directVisibleAllRefsOutputIds;
      const currentIndex = currentVisibleIds.indexOf(referenceGridDetailOutputId);
      if (currentIndex < 0) return;
      const targetIndex = direction === "previous" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= currentVisibleIds.length) return;
      const targetId = currentVisibleIds[targetIndex];
      if (!targetId) return;
      const targetOutput = snapshot ? snapshot.outputById[targetId] : directOutputById[targetId];

      handleSelectOutput(targetId);
      openDetailSelectionTarget({
        kind: "studio-output",
        outputId: targetId,
        surface: "reference-grid",
        ...(targetOutput ? { outputSnapshot: targetOutput } : {}),
      });
      setDetailOutputId(targetId);
    },
    [
      directOutputById,
      directVisibleAllRefsOutputIds,
      handleSelectOutput,
      openDetailSelectionTarget,
      readOutputsFromStore,
      referenceGridDetailOutputId,
      removedFromAllRefsIds,
      setDetailOutputId,
    ]
  );
  const detailNavigation = useMemo(() => {
    if (!referenceGridDetailOutputId || detailNavigationIndex < 0) return null;
    return {
      sourceSurface: "reference-grid" as const,
      canNavigatePrevious: detailNavigationIndex > 0,
      canNavigateNext: detailNavigationIndex < visibleAllRefsOutputIds.length - 1,
      onNavigatePrevious: () => navigateReferenceGridDetail("previous"),
      onNavigateNext: () => navigateReferenceGridDetail("next"),
    };
  }, [
    detailNavigationIndex,
    navigateReferenceGridDetail,
    referenceGridDetailOutputId,
    visibleAllRefsOutputIds.length,
  ]);

  return useMemo(
    () => ({
      outputs: directOutputs,
      archivedOutputs: directArchivedOutputs,
      detailNavigation,
      activeOutputId,
      topNotice,
      curatedReferenceIds,
      removedFromAllRefsIds,
      isMediaStorageFull,
      showHeader: true,
      onOutputMediaLoaded: onReferenceOutputMediaLoaded,
      linkedPromptReferenceIds,
      onSelectOutput: handleSelectOutput,
      onOpenDetails: (id, output, options) => {
        const surface = options?.surface ?? "reference-grid";
        openDetailSelectionTarget({
          kind: "studio-output",
          outputId: id,
          surface,
          ...(output ? { outputSnapshot: output } : {}),
        });
        setDetailOutputId(id);
      },
      onSaveToLibrary: (output) => handleSaveReference(output.id),
      onDownload: (output) => handleDownloadReference(output.id),
      onPinPromptReference: handlePinPromptReference,
      onPasteTextReference: handlePasteTextReference,
      onPasteMediaReference: handlePasteMediaReference,
      onAddLibraryMediaReference: handleAddLibraryMediaReference,
      onAddLibraryMediaReferences: handleAddLibraryMediaReferences,
      onAddLibraryPromptReference: handleAddLibraryPromptReference,
      onRerollOutput: handleRerollOutput
        ? (output) => {
            handleRerollOutput(output.id);
          }
        : undefined,
      onReloadWorkflowOutput: handleReloadWorkflowOutput
        ? (output, options) => {
            handleReloadWorkflowOutput(output, options);
          }
        : undefined,
      onDeleteOutput: deleteOutput,
      onClearGenerationOutput: clearGenerationOutput,
      onAddCuratedReference: addCuratedReference,
      onRemoveCuratedReference: removeCuratedReference,
      onReorderCuratedReference: reorderCuratedReference,
      onRestoreArchivedOutput: restoreArchivedOutput,
      onRestoreAllArchivedOutputs: restoreAllArchivedOutputs,
    }),
    [
      activeOutputId,
      addCuratedReference,
      directArchivedOutputs,
      directOutputs,
      detailNavigation,
      curatedReferenceIds,
      removedFromAllRefsIds,
      topNotice,
      clearGenerationOutput,
      deleteOutput,
      handleDownloadReference,
      handlePinPromptReference,
      handleAddLibraryMediaReference,
      handleAddLibraryMediaReferences,
      handleAddLibraryPromptReference,
      handlePasteMediaReference,
      handlePasteTextReference,
      handleReloadWorkflowOutput,
      handleRerollOutput,
      handleSaveReference,
      handleSelectOutput,
      isMediaStorageFull,
      linkedPromptReferenceIds,
      openDetailSelectionTarget,
      onReferenceOutputMediaLoaded,
      removeCuratedReference,
      reorderCuratedReference,
      restoreAllArchivedOutputs,
      restoreArchivedOutput,
      setDetailOutputId,
    ]
  );
};
