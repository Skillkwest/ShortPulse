/**
 * AI Studio reference-grid prop composition hook.
 * Keeps reference grid action wiring out of the page orchestrator.
 */
import { useMemo } from "react";
import type { SharedMediaDetailSelectionTarget } from "../components/detail-modal/detailModalPlatformTypes";
import type { StudioOutput } from "../types";
import type { AiStudioReferenceGridContract } from "./contracts/pageContentContracts";
import type {
  LibraryMediaReferencePayload,
  LibraryPromptReferencePayload,
} from "../reference-grid/referenceGridTypes";

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
  openDetailSelectionTarget: (target: SharedMediaDetailSelectionTarget | null) => void;
  setDetailOutputId: (id: string | null) => void;
  handleSaveReference: (id: string) => void;
  handleDownloadReference: (id: string) => void;
  isMediaStorageFull?: boolean;
  handlePasteTextReference: (text: string) => void;
  handlePasteMediaReference: (reference: { url: string; mimeType?: string | null }) => void;
  handleAddLibraryMediaReference?: (payload: LibraryMediaReferencePayload) => void;
  handleAddLibraryPromptReference?: (payload: LibraryPromptReferencePayload) => void;
  retryOutputStatus: (id: string) => void;
  handleRerollOutput?: (id: string) => void;
  handleReloadWorkflowOutput?: (output: StudioOutput) => void;
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
  openDetailSelectionTarget,
  setDetailOutputId,
  handleSaveReference,
  handleDownloadReference,
  isMediaStorageFull = false,
  handlePasteTextReference,
  handlePasteMediaReference,
  handleAddLibraryMediaReference,
  handleAddLibraryPromptReference,
  retryOutputStatus,
  handleRerollOutput,
  handleReloadWorkflowOutput,
  deleteOutput,
  clearGenerationOutput,
  addCuratedReference,
  removeCuratedReference,
  reorderCuratedReference,
  restoreArchivedOutput,
  restoreAllArchivedOutputs,
}: UseAiStudioReferenceGridPropsParams): AiStudioReferenceGridContract => {
  const directOutputs = readOutputsFromStore ? undefined : outputs;
  const directArchivedOutputs = readOutputsFromStore
    ? undefined
    : outputs === undefined && archivedOutputs === undefined
      ? undefined
      : (archivedOutputs ?? EMPTY_ARCHIVED_OUTPUTS);

  return useMemo(
    () => ({
      outputs: directOutputs,
      archivedOutputs: directArchivedOutputs,
      activeOutputId,
      topNotice,
      curatedReferenceIds,
      removedFromAllRefsIds,
      isMediaStorageFull,
      showHeader: true,
      onOutputMediaLoaded: onReferenceOutputMediaLoaded,
      linkedPromptReferenceIds,
      onSelectOutput: handleSelectOutput,
      onOpenDetails: (id, output) => {
        openDetailSelectionTarget({
          kind: "studio-output",
          outputId: id,
          surface: "reference-grid",
          ...(output ? { outputSnapshot: output } : {}),
        });
        setDetailOutputId(id);
      },
      onSaveToLibrary: (output) => handleSaveReference(output.id),
      onDownload: (output) => handleDownloadReference(output.id),
      onPasteTextReference: handlePasteTextReference,
      onPasteMediaReference: handlePasteMediaReference,
      onAddLibraryMediaReference: handleAddLibraryMediaReference,
      onAddLibraryPromptReference: handleAddLibraryPromptReference,
      onRetryStatus: (output) => retryOutputStatus(output.id),
      onRerollOutput: handleRerollOutput
        ? (output) => {
            handleRerollOutput(output.id);
          }
        : undefined,
      onReloadWorkflowOutput: handleReloadWorkflowOutput
        ? (output) => {
            handleReloadWorkflowOutput(output);
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
      curatedReferenceIds,
      removedFromAllRefsIds,
      topNotice,
      clearGenerationOutput,
      deleteOutput,
      handleDownloadReference,
      handleAddLibraryMediaReference,
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
      retryOutputStatus,
      setDetailOutputId,
    ]
  );
};
