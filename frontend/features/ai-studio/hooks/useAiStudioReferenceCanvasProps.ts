/**
 * AI Studio reference-canvas prop composition hook.
 * Keeps reference grid action wiring out of the page orchestrator.
 */
import type { AiStudioPageContentProps } from "../components/AiStudioPageContent";
import type { StudioOutput, ToolId } from "../types";

type UseAiStudioReferenceCanvasPropsParams = {
  outputs: StudioOutput[];
  archivedOutputs?: StudioOutput[];
  activeOutputId: string | null;
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
  restoreArchivedOutput,
  restoreAllArchivedOutputs,
  currentCostCredits,
  selectedTool,
}: UseAiStudioReferenceCanvasPropsParams): AiStudioPageContentProps["referenceCanvasProps"] => ({
  outputs,
  archivedOutputs,
  activeOutputId,
  showHeader: false,
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
  onRestoreArchivedOutput: restoreArchivedOutput,
  onRestoreAllArchivedOutputs: restoreAllArchivedOutputs,
  generateCostCredits: currentCostCredits,
  selectedTool,
});
