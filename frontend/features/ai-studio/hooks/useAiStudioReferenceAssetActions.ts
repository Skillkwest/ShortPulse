/**
 * Reference asset actions hook for AI Studio.
 * Encapsulates download/save/generate-from-reference handlers used by reference cards and detail modal.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import type { PromptOrigin } from "../logic/agentPromptOwnership";
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
        let fileRecord: { storage_path: string; filename: string } | null = null;

        if (target.savedMediaIds?.length) {
          const { data } = await supabase
            .from("media_files")
            .select("storage_path, filename, created_at")
            .in("id", target.savedMediaIds)
            .order("created_at", { ascending: false })
            .limit(1);
          fileRecord = data?.[0] ?? null;
        } else if (target.generationId) {
          const { data } = await supabase
            .from("media_files")
            .select("storage_path, filename")
            .eq("source_ref", target.generationId)
            .order("created_at", { ascending: false })
            .limit(1);
          fileRecord = data?.[0] ?? null;
        }

        if (fileRecord?.storage_path) {
          const { data, error } = await supabase.storage
            .from("media_library")
            .download(fileRecord.storage_path);
          if (error) throw error;
          const blob = data as Blob;
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = fileRecord.filename || target.prompt || "reference";
          link.click();
          window.URL.revokeObjectURL(url);
          return;
        }

        if (target.previewUrl) {
          const link = document.createElement("a");
          link.href = target.previewUrl;
          link.target = "_blank";
          link.rel = "noreferrer";
          link.download = target.prompt || "reference";
          link.click();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to download media.";
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
