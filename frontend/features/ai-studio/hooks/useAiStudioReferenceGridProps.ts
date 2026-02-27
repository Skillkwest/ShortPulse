/**
 * AI Studio reference-grid prop composition hook.
 * Keeps reference grid action wiring out of the page orchestrator.
 */
import { useMemo } from "react";
import type { StudioOutput, ToolId } from "../types";
import type { AiStudioReferenceGridContract } from "./contracts/pageContentContracts";

export type UseAiStudioReferenceGridPropsParams = {
  outputs?: StudioOutput[];
  archivedOutputs?: StudioOutput[];
  activeOutputId: string | null;
  curatedReferenceIds?: string[];
  removedFromAllRefsIds?: string[];
  onReferenceOutputMediaLoaded: (id: string) => void;
  linkedPromptReferenceIds: string[];
  handleSelectOutput: (id: string) => void;
  setDetailOutputId: (id: string | null) => void;
  handleSaveReference: (id: string) => void;
  handleDownloadReference: (id: string) => void;
  handlePasteTextReference: (text: string) => void;
  handlePasteMediaReference: (reference: { url: string; mimeType?: string | null }) => void;
  retryOutputStatus: (id: string) => void;
  handleRerollOutput?: (id: string) => void;
  deleteOutput: (id: string) => void;
  addCuratedReference?: (id: string) => void;
  removeCuratedReference?: (id: string) => void;
  reorderCuratedReference?: (
    id: string,
    targetId: string | null,
    placement: "before" | "after" | "end"
  ) => void;
  restoreArchivedOutput?: (id: string) => void;
  restoreAllArchivedOutputs?: () => void;
  selectedTool: ToolId | null;
};

/**
 * @deprecated Use `UseAiStudioReferenceGridPropsParams`.
 */
export type UseAiStudioReferenceCanvasPropsParams = UseAiStudioReferenceGridPropsParams;

/**
 * Returns the reference-grid props consumed by `AiStudioPageContent`.
 */
export const useAiStudioReferenceGridProps = ({
  outputs,
  archivedOutputs = [],
  activeOutputId,
  curatedReferenceIds = [],
  removedFromAllRefsIds = [],
  onReferenceOutputMediaLoaded,
  linkedPromptReferenceIds,
  handleSelectOutput,
  setDetailOutputId,
  handleSaveReference,
  handleDownloadReference,
  handlePasteTextReference,
  handlePasteMediaReference,
  retryOutputStatus,
  handleRerollOutput,
  deleteOutput,
  addCuratedReference,
  removeCuratedReference,
  reorderCuratedReference,
  restoreArchivedOutput,
  restoreAllArchivedOutputs,
  selectedTool,
}: UseAiStudioReferenceGridPropsParams): AiStudioReferenceGridContract =>
  useMemo(
    () => ({
      outputs,
      archivedOutputs,
      activeOutputId,
      curatedReferenceIds,
      removedFromAllRefsIds,
      showHeader: true,
      onOutputMediaLoaded: onReferenceOutputMediaLoaded,
      linkedPromptReferenceIds,
      onSelectOutput: handleSelectOutput,
      onOpenDetails: setDetailOutputId,
      onSaveToLibrary: (output) => handleSaveReference(output.id),
      onDownload: (output) => handleDownloadReference(output.id),
      onPasteTextReference: handlePasteTextReference,
      onPasteMediaReference: handlePasteMediaReference,
      onRetryStatus: (output) => retryOutputStatus(output.id),
      onRerollOutput: handleRerollOutput
        ? (output) => {
            handleRerollOutput(output.id);
          }
        : undefined,
      onDeleteOutput: deleteOutput,
      onAddCuratedReference: addCuratedReference,
      onRemoveCuratedReference: removeCuratedReference,
      onReorderCuratedReference: reorderCuratedReference,
      onRestoreArchivedOutput: restoreArchivedOutput,
      onRestoreAllArchivedOutputs: restoreAllArchivedOutputs,
      selectedTool,
    }),
    [
      activeOutputId,
      addCuratedReference,
      archivedOutputs,
      curatedReferenceIds,
      removedFromAllRefsIds,
      deleteOutput,
      handleDownloadReference,
      handlePasteMediaReference,
      handlePasteTextReference,
      handleRerollOutput,
      handleSaveReference,
      handleSelectOutput,
      linkedPromptReferenceIds,
      onReferenceOutputMediaLoaded,
      outputs,
      removeCuratedReference,
      reorderCuratedReference,
      restoreAllArchivedOutputs,
      restoreArchivedOutput,
      retryOutputStatus,
      selectedTool,
      setDetailOutputId,
    ]
  );

/**
 * @deprecated Use `useAiStudioReferenceGridProps`.
 */
export const useAiStudioReferenceCanvasProps = useAiStudioReferenceGridProps;
