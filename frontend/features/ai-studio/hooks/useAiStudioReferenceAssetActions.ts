/**
 * Reference asset actions hook for AI Studio.
 * Encapsulates download/save/generate-from-reference handlers used by reference cards and detail modal.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
import {
  downloadBlobToFile,
  downloadReferenceProviderBlob,
  REFERENCE_PROVIDER_DOWNLOAD_ERROR_MESSAGE,
  resolveReferenceDownloadFilename,
  resolveReferenceDownloadTarget,
} from "../logic/referenceDownload";
import type { StudioMode, StudioOutput, ToolId } from "../types";

type UseAiStudioReferenceAssetActionsParams = {
  findOutputById: (id: string) => StudioOutput | null;
  selectedTool: ToolId | null;
  currentCostCredits: number | null;
  setVideoReferenceText: (value: string) => void;
  setEditReferenceText: (value: string) => void;
  setSharedPrompt: (value: string) => void;
  setSelectedTool: (tool: ToolId | null) => void;
  setMode: Dispatch<SetStateAction<StudioMode>>;
  setPromptOrigin: Dispatch<SetStateAction<PromptOrigin>>;
  handleGenerate: (
    promptOverride?: string | null,
    options?: {
      modeOverride?: StudioMode;
      toolOverride?: ToolId | null;
      costOverrideCredits?: number | null;
    }
  ) => Promise<void>;
  saveReferenceToLibrary: (outputId: string) => void;
  setUiError: Dispatch<SetStateAction<string | null>>;
};

/**
 * Returns reference asset handlers for card/detail interactions.
 */
export const useAiStudioReferenceAssetActions = ({
  findOutputById,
  selectedTool,
  currentCostCredits,
  setVideoReferenceText,
  setEditReferenceText,
  setSharedPrompt,
  setSelectedTool,
  setMode,
  setPromptOrigin,
  handleGenerate,
  saveReferenceToLibrary,
  setUiError,
}: UseAiStudioReferenceAssetActionsParams) => {
  const handleDownloadReference = useCallback(
    async (outputId: string) => {
      const target = findOutputById(outputId);
      if (!target || typeof window === "undefined") return;
      try {
        const supabase = ensureSupabaseClient();
        const resolvedTarget = await resolveReferenceDownloadTarget({
          output: target,
          supabase,
        });
        const downloadFilename = resolveReferenceDownloadFilename({
          preferredFilename: resolvedTarget.fileRecord?.filename ?? null,
          prompt: target.prompt,
          outputId: target.id,
          previewUrl: target.previewUrl ?? null,
        });

        if (resolvedTarget.fileRecord?.storagePath) {
          const { data, error } = await supabase.storage
            .from("media_library")
            .download(resolvedTarget.fileRecord.storagePath);
          if (error) throw error;
          if (!data) {
            throw new Error("Unable to download media.");
          }
          const blob = data as Blob;
          downloadBlobToFile(blob, downloadFilename);
          return;
        }

        if (target.previewUrl) {
          const isGeneratedReference =
            target.mediaSource === "generated" || Boolean(target.generationId || target.taskId);
          if (isGeneratedReference) {
            const blob = await downloadReferenceProviderBlob({
              url: target.previewUrl,
            });
            downloadBlobToFile(blob, downloadFilename);
            return;
          }

          const link = document.createElement("a");
          link.href = target.previewUrl;
          link.rel = "noreferrer";
          link.download = downloadFilename;
          link.click();
          return;
        }
        throw new Error("No media available to download.");
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : target?.mediaSource === "generated"
              ? REFERENCE_PROVIDER_DOWNLOAD_ERROR_MESSAGE
              : "Unable to download media.";
        setUiError(message);
      }
    },
    [findOutputById, setUiError]
  );

  const handleSaveReference = useCallback(
    (outputId: string) => {
      if (!outputId) return;
      saveReferenceToLibrary(outputId);
    },
    [saveReferenceToLibrary]
  );

  const handleGenerateFromPromptReference = useCallback(
    async (outputId: string) => {
      const target = findOutputById(outputId);
      const promptText = target?.prompt ?? target?.previewText ?? "";
      if (!promptText.trim()) return;

      const isVideoWorkflow = selectedTool === "video" || selectedTool === "kling";
      const isEditWorkflow = selectedTool === "edit" || selectedTool === "image";
      const workflowTool: ToolId = isVideoWorkflow ? "video" : isEditWorkflow ? "edit" : "create";
      const workflowMode: StudioMode = isVideoWorkflow ? "video" : "image";

      if (workflowTool === "video") {
        setVideoReferenceText(promptText);
      } else if (workflowTool === "edit") {
        setEditReferenceText(promptText);
      } else {
        setSharedPrompt(promptText);
        if (selectedTool !== "create" && selectedTool !== "text") {
          setSelectedTool("create");
        }
        setMode("image");
      }

      setPromptOrigin("reference");
      await handleGenerate(promptText, {
        modeOverride: workflowMode,
        toolOverride: workflowTool,
        costOverrideCredits: currentCostCredits,
      });
    },
    [
      currentCostCredits,
      findOutputById,
      handleGenerate,
      selectedTool,
      setEditReferenceText,
      setMode,
      setPromptOrigin,
      setSelectedTool,
      setSharedPrompt,
      setVideoReferenceText,
    ]
  );

  return {
    handleDownloadReference,
    handleSaveReference,
    handleGenerateFromPromptReference,
  };
};
