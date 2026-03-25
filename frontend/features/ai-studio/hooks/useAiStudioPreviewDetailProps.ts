/**
 * AI Studio preview and detail-modal prop composition hook.
 * Centralizes preview text routing and detail action wiring for page orchestration.
 */
import { useMemo } from "react";
import type { StudioOutput, ToolId } from "../types";
import type { AiStudioPreviewDetailContracts } from "./contracts/pageContentContracts";

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
  handleSaveReference: (id: string) => void;
  handleDownloadReference: (id: string) => void;
  savePromptToLibrary: (customPrompt?: string) => void;
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
  handleSaveReference,
  handleDownloadReference,
  savePromptToLibrary,
  handleOpenMediaLibrary,
}: UseAiStudioPreviewDetailPropsParams): AiStudioPreviewDetailContracts =>
  useMemo(
    () => ({
      studioPreviewProps: {
        activeOutput,
        referenceImageUrl,
        referenceText:
          selectedTool === "video" || selectedTool === "kling"
            ? videoReferenceText
            : editReferenceText,
        onReferenceImageChange: setReferenceImageUrl,
        onReferenceTextChange: handleManualPromptChange,
        onRegenerate: handleRegenerateWithDebit,
      },
      detailModalOutput: detailOutput,
      onDetailClose: () => setDetailOutputId(null),
      onUpdateOutputPrompt: updateOutputPrompt,
      onDeleteOutput: deleteOutput,
      onDetailDownload: handleDownloadReference,
      onDetailSaveReference: handleSaveReference,
      onDetailSavePrompt: savePromptToLibrary,
      onOpenMediaLibrary: handleOpenMediaLibrary,
    }),
    [
      activeOutput,
      deleteOutput,
      detailOutput,
      editReferenceText,
      handleDownloadReference,
      handleManualPromptChange,
      handleOpenMediaLibrary,
      handleRegenerateWithDebit,
      handleSaveReference,
      referenceImageUrl,
      savePromptToLibrary,
      selectedTool,
      setDetailOutputId,
      setReferenceImageUrl,
      updateOutputPrompt,
      videoReferenceText,
    ]
  );
