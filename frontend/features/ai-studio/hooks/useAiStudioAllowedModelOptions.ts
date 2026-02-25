import { useMemo } from "react";
import { modelOptions } from "../constants";
import { getModelConfig } from "../logic/pricing";
import type { StudioMode, ToolId } from "../types";
import { resolveAiStudioAllowedModelOptions } from "../logic/modelSelectionPolicy";

type UseAiStudioAllowedModelOptionsArgs = {
  selectedTool: ToolId | null;
  videoReferenceMode: "standard" | "keyframes" | "kling3" | "motion";
  mode: StudioMode;
};

export const useAiStudioAllowedModelOptions = ({
  selectedTool,
  videoReferenceMode,
  mode,
}: UseAiStudioAllowedModelOptionsArgs) => {
  return useMemo(
    () =>
      resolveAiStudioAllowedModelOptions({
        selectedTool,
        mode,
        videoReferenceMode,
        options: modelOptions,
        getModelConfig,
      }),
    [mode, selectedTool, videoReferenceMode]
  );
};
