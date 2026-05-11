import { useCallback, type Dispatch, type SetStateAction } from "react";
import { randomId } from "../logic/ids";
import { resolveModelLabel } from "../logic/stateParsers";
import type { StudioMode, StudioOutput, StudioOutputSubmissionMode, ToolId } from "../types";

type UseAiStudioOptimisticPlaceholderActionsArgs = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  aspect: string;
  model: string | null;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
};

type UseAiStudioOptimisticPlaceholderActionsResult = {
  insertOptimisticGenerationPlaceholder: (args: {
    prompt: string;
    modeOverride?: StudioMode;
    selectedToolOverride?: ToolId | null;
    modelLabelOverride?: string | null;
    modelIdOverride?: string | null;
    providerOverride?: string | null;
    submissionModeOverride?: StudioOutputSubmissionMode;
  }) => string | null;
  removeOptimisticGenerationPlaceholder: (outputId: string) => void;
};

export const useAiStudioOptimisticPlaceholderActions = ({
  mode,
  selectedTool,
  aspect,
  model,
  setOutputs,
  setSaved,
}: UseAiStudioOptimisticPlaceholderActionsArgs): UseAiStudioOptimisticPlaceholderActionsResult => {
  const insertOptimisticGenerationPlaceholder = useCallback(
    ({
      prompt: promptText,
      modeOverride,
      selectedToolOverride,
      modelLabelOverride,
      modelIdOverride,
      providerOverride,
      submissionModeOverride,
    }: {
      prompt: string;
      modeOverride?: StudioMode;
      selectedToolOverride?: ToolId | null;
      modelLabelOverride?: string | null;
      modelIdOverride?: string | null;
      providerOverride?: string | null;
      submissionModeOverride?: StudioOutputSubmissionMode;
    }) => {
      const cleanedPrompt = promptText.trim();
      if (!cleanedPrompt) return null;
      const effectiveMode = modeOverride ?? mode;
      const effectiveTool = selectedToolOverride ?? selectedTool;
      const outputMode: StudioMode =
        effectiveTool === "video" || effectiveTool === "kling"
          ? "video"
          : effectiveTool === "image" || effectiveTool === "edit"
            ? "image"
            : effectiveMode;
      const id = `out-${randomId()}`;
      const resolvedModelLabel =
        typeof modelLabelOverride === "string" && modelLabelOverride.trim().length > 0
          ? modelLabelOverride.trim()
          : resolveModelLabel(model ?? undefined);
      const resolvedProvider =
        typeof providerOverride === "string" && providerOverride.trim().length > 0
          ? providerOverride.trim()
          : undefined;
      const nextOutput: StudioOutput = {
        id,
        prompt: cleanedPrompt,
        mode: outputMode,
        aspect,
        model: resolvedModelLabel,
        modelId: modelIdOverride === null ? undefined : (modelIdOverride ?? model ?? undefined),
        provider: resolvedProvider,
        status: "ready",
        taskState: "pending",
        submissionMode: submissionModeOverride ?? "provider-task",
        timestamp: "Submitting...",
        errorMessage: null,
        errorMessageShort: null,
        errorDetail: null,
        mediaSource: "generated",
        previewTier: outputMode === "video" ? "preview_loop" : "full",
        archivedAt: null,
        archiveReason: null,
        saveState: "idle",
        saveError: null,
      };
      setOutputs((prev) => [nextOutput, ...prev]);
      setSaved(false);
      return id;
    },
    [aspect, mode, model, selectedTool, setOutputs, setSaved]
  );

  const removeOptimisticGenerationPlaceholder = useCallback(
    (outputId: string) => {
      if (!outputId) return;
      setOutputs((prev) => prev.filter((item) => item.id !== outputId));
    },
    [setOutputs]
  );

  return {
    insertOptimisticGenerationPlaceholder,
    removeOptimisticGenerationPlaceholder,
  };
};
