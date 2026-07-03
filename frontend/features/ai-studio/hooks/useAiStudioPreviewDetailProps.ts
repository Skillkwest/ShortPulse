/**
 * AI Studio preview and detail-modal prop composition hook.
 * Centralizes preview text routing and detail action wiring for page orchestration.
 */
import { useMemo } from "react";
import type { SharedMediaDetailSelectionTarget } from "../components/detail-modal/detailModalPlatformTypes";
import type { StudioOutput, ToolId } from "../types";
import { resolveActiveOutputPreviewUrl } from "../logic/activeOutputPreviewAuthority";
import type {
  AiStudioDetailNavigationContract,
  AiStudioPreviewDetailContracts,
} from "./contracts/pageContentContracts";

type UseAiStudioPreviewDetailPropsParams = {
  activeOutput: StudioOutput | null;
  referenceGridReadyOutputIds: ReadonlySet<string>;
  referenceImageUrl: string | null;
  selectedTool: ToolId | null;
  videoReferenceText: string;
  editReferenceText: string;
  setReferenceImageUrl: (url: string | null) => void;
  handleManualPromptChange: (value: string) => void;
  handleRegenerateWithDebit: () => void;
  detailOutput: StudioOutput | null;
  detailNavigation?: AiStudioDetailNavigationContract | null;
  setDetailSelectionTarget?: (target: SharedMediaDetailSelectionTarget | null) => void;
  setDetailOutputId: (id: string | null) => void;
  updateOutputPrompt: (id: string, prompt: string) => void;
  deleteOutput: (id: string) => void;
  handleSaveReference: (id: string) => void;
  handleDownloadReference: (id: string) => void;
  isMediaStorageFull?: boolean;
  savePromptToLibrary?: (customPrompt?: string) => void | boolean | Promise<boolean>;
  handleOpenMediaLibrary: () => void;
};

/**
 * Returns preview + detail-modal props consumed by `AiStudioPageContent`.
 */
export const useAiStudioPreviewDetailProps = ({
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
  detailNavigation = null,
  setDetailSelectionTarget,
  setDetailOutputId,
  updateOutputPrompt,
  deleteOutput,
  handleSaveReference,
  handleDownloadReference,
  isMediaStorageFull = false,
  savePromptToLibrary,
  handleOpenMediaLibrary,
}: UseAiStudioPreviewDetailPropsParams): AiStudioPreviewDetailContracts =>
  useMemo(() => {
    const activeOutputPreviewUrl = resolveActiveOutputPreviewUrl({
      activeOutput,
      referenceGridReadyOutputIds,
    });

    return {
      studioPreviewProps: {
        activeOutput,
        activeOutputPreviewUrl,
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
      detailNavigation,
      onDetailClose: () => {
        setDetailSelectionTarget?.(null);
        setDetailOutputId(null);
      },
      onUpdateOutputPrompt: updateOutputPrompt,
      onDeleteOutput: deleteOutput,
      onDetailDownload: handleDownloadReference,
      onDetailSaveReference: handleSaveReference,
      isMediaStorageFull,
      onDetailSavePrompt: savePromptToLibrary ?? (() => false),
      onOpenMediaLibrary: handleOpenMediaLibrary,
    };
  }, [
    activeOutput,
    deleteOutput,
    detailOutput,
    detailNavigation,
    editReferenceText,
    handleDownloadReference,
    handleManualPromptChange,
    handleOpenMediaLibrary,
    handleRegenerateWithDebit,
    handleSaveReference,
    isMediaStorageFull,
    referenceGridReadyOutputIds,
    referenceImageUrl,
    savePromptToLibrary,
    selectedTool,
    setDetailSelectionTarget,
    setDetailOutputId,
    setReferenceImageUrl,
    updateOutputPrompt,
    videoReferenceText,
  ]);
