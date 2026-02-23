import { useCallback, type Dispatch, type SetStateAction } from "react";
import { randomId } from "../logic/ids";
import { resolveModelLabel } from "../logic/stateParsers";
import type { StudioMode, StudioOutput, ToolId } from "../types";

type UseAiStudioOptimisticPlaceholderActionsArgs = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  isCharacterModeEnabled: boolean;
  aspect: string;
  model: string | null;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  characterModePendingModelLabel: string;
};

type UseAiStudioOptimisticPlaceholderActionsResult = {
  insertOptimisticGenerationPlaceholder: (args: {
    prompt: string;
    modeOverride?: StudioMode;
    selectedToolOverride?: ToolId | null;
  }) => string | null;
  removeOptimisticGenerationPlaceholder: (outputId: string) => void;
};

export const useAiStudioOptimisticPlaceholderActions = ({
  mode,
  selectedTool,
  isCharacterModeEnabled,
  aspect,
  model,
  setOutputs,
  setSaved,
  characterModePendingModelLabel,
}: UseAiStudioOptimisticPlaceholderActionsArgs): UseAiStudioOptimisticPlaceholderActionsResult => {
  const insertOptimisticGenerationPlaceholder = useCallback(
    ({
      prompt: promptText,
      modeOverride,
      selectedToolOverride,
    }: {
      prompt: string;
      modeOverride?: StudioMode;
      selectedToolOverride?: ToolId | null;
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
      const isCharacterModeCreateRun =
        isCharacterModeEnabled && (effectiveTool === "create" || effectiveTool === "text");
      const id = `out-${randomId()}`;
      const nextOutput: StudioOutput = {
        id,
        prompt: cleanedPrompt,
        mode: outputMode,
        aspect,
        model: isCharacterModeCreateRun
          ? characterModePendingModelLabel
          : resolveModelLabel(model ?? undefined),
        modelId: model ?? undefined,
        status: "ready",
        taskState: "pending",
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
    [
      aspect,
      characterModePendingModelLabel,
      isCharacterModeEnabled,
      mode,
      model,
      selectedTool,
      setOutputs,
      setSaved,
    ]
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
