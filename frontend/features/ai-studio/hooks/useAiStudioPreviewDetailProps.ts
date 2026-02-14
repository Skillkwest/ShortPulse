/**
 * AI Studio preview and detail-modal prop composition hook.
 * Centralizes preview text routing and detail action wiring for page orchestration.
 */
import type { AiStudioPageContentProps } from "../components/AiStudioPageContent";
import type { StudioOutput, ToolId } from "../types";

type UseAiStudioPreviewDetailPropsParams = {
  activeOutput: StudioOutput | null;
  referenceImageUrl: string | null;
  selectedTool: ToolId | null;
  videoReferenceText: string;
  editReferenceText: string;
  setReferenceImageUrl: (url: string | null) => void;
  handleManualPromptChange: (value: string) => void;
  handleRegenerateWithDebit: () => void;
  detailOutput: StudioOutput | null;
  setDetailOutputId: (id: string | null) => void;
  updateOutputPrompt: (id: string, prompt: string) => void;
  deleteOutput: (id: string) => void;
  handleDownloadReference: (id: string) => void;
  savePromptReference: (customPrompt?: string) => void;
  handleOpenMediaLibrary: () => void;
};

/**
 * Returns preview + detail-modal props consumed by `AiStudioPageContent`.
 */
export const useAiStudioPreviewDetailProps = ({
  activeOutput,
  referenceImageUrl,
  selectedTool,
  videoReferenceText,
  editReferenceText,
  setReferenceImageUrl,
  handleManualPromptChange,
  handleRegenerateWithDebit,
  detailOutput,
  setDetailOutputId,
  updateOutputPrompt,
  deleteOutput,
  handleDownloadReference,
  savePromptReference,
  handleOpenMediaLibrary,
}: UseAiStudioPreviewDetailPropsParams): Pick<
  AiStudioPageContentProps,
  | "studioPreviewProps"
  | "detailModalOutput"
  | "onDetailClose"
  | "onUpdateOutputPrompt"
  | "onDeleteOutput"
  | "onDetailDownload"
  | "onDetailSavePrompt"
  | "onOpenMediaLibrary"
> => ({
  studioPreviewProps: {
    activeOutput,
    referenceImageUrl,
    referenceText:
      selectedTool === "video" || selectedTool === "kling" ? videoReferenceText : editReferenceText,
    onReferenceImageChange: setReferenceImageUrl,
    onReferenceTextChange: handleManualPromptChange,
    onRegenerate: handleRegenerateWithDebit,
  },
  detailModalOutput: detailOutput,
  onDetailClose: () => setDetailOutputId(null),
  onUpdateOutputPrompt: updateOutputPrompt,
  onDeleteOutput: deleteOutput,
  onDetailDownload: handleDownloadReference,
  onDetailSavePrompt: savePromptReference,
  onOpenMediaLibrary: handleOpenMediaLibrary,
});
