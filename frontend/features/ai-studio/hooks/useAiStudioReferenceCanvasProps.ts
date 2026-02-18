/**
 * AI Studio reference-canvas prop composition hook.
 * Keeps reference grid action wiring out of the page orchestrator.
 */
import { useMemo } from "react";
import type { AiStudioPageContentProps } from "../components/AiStudioPageContent";
import type { StudioOutput, ToolId } from "../types";

type UseAiStudioReferenceCanvasPropsParams = {
  outputs?: StudioOutput[];
  archivedOutputs?: StudioOutput[];
  activeOutputId: string | null;
  curatedReferenceIds?: string[];
  onReferenceOutputMediaLoaded: (id: string) => void;
  linkedPromptReferenceIds: string[];
  showReferencePromptGenerate: boolean;
  disableReferencePromptGenerate: boolean;
  handleSelectOutput: (id: string) => void;
  setDetailOutputId: (id: string | null) => void;
  handleDescribeReference: (id: string) => void;
  handleSaveReference: (id: string) => void;
  handleDownloadReference: (id: string) => void;
  handleGenerateFromPromptReference: (id: string) => void;
  handlePasteTextReference: (text: string) => void;
  handlePasteMediaReference: (reference: { url: string; mimeType?: string | null }) => void;
  retryOutputStatus: (id: string) => void;
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
  currentCostCredits: number | null;
  selectedTool: ToolId | null;
};

/**
 * Returns the reference-canvas props consumed by `AiStudioPageContent`.
 */
export const useAiStudioReferenceCanvasProps = ({
  outputs,
  archivedOutputs = [],
  activeOutputId,
  curatedReferenceIds = [],
  onReferenceOutputMediaLoaded,
  linkedPromptReferenceIds,
  showReferencePromptGenerate,
  disableReferencePromptGenerate,
  handleSelectOutput,
  setDetailOutputId,
  handleDescribeReference,
  handleSaveReference,
  handleDownloadReference,
  handleGenerateFromPromptReference,
  handlePasteTextReference,
  handlePasteMediaReference,
  retryOutputStatus,
  deleteOutput,
  addCuratedReference,
  removeCuratedReference,
  reorderCuratedReference,
  restoreArchivedOutput,
  restoreAllArchivedOutputs,
  currentCostCredits,
  selectedTool,
}: UseAiStudioReferenceCanvasPropsParams): AiStudioPageContentProps["referenceCanvasProps"] =>
  useMemo(
    () => ({
      outputs,
      archivedOutputs,
      activeOutputId,
      curatedReferenceIds,
      showHeader: true,
      onOutputMediaLoaded: onReferenceOutputMediaLoaded,
      linkedPromptReferenceIds,
      showPromptGenerate: showReferencePromptGenerate,
      disablePromptGenerate: disableReferencePromptGenerate,
      onSelectOutput: handleSelectOutput,
      onOpenDetails: setDetailOutputId,
      onDescribeImage: (output) => handleDescribeReference(output.id),
      onSaveToLibrary: (output) => handleSaveReference(output.id),
      onDownload: (output) => handleDownloadReference(output.id),
      onGeneratePrompt: (output) => handleGenerateFromPromptReference(output.id),
      onPasteTextReference: handlePasteTextReference,
      onPasteMediaReference: handlePasteMediaReference,
      onRetryStatus: (output) => retryOutputStatus(output.id),
      onDeleteOutput: deleteOutput,
      onAddCuratedReference: addCuratedReference,
      onRemoveCuratedReference: removeCuratedReference,
      onReorderCuratedReference: reorderCuratedReference,
      onRestoreArchivedOutput: restoreArchivedOutput,
      onRestoreAllArchivedOutputs: restoreAllArchivedOutputs,
      generateCostCredits: currentCostCredits,
      selectedTool,
    }),
    [
      activeOutputId,
      addCuratedReference,
      archivedOutputs,
      curatedReferenceIds,
      currentCostCredits,
      deleteOutput,
      disableReferencePromptGenerate,
      handleDescribeReference,
      handleDownloadReference,
      handleGenerateFromPromptReference,
      handlePasteMediaReference,
      handlePasteTextReference,
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
      showReferencePromptGenerate,
    ]
  );
