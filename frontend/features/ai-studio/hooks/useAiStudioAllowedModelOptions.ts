import { useMemo } from "react";
import { modelOptions } from "../constants";
import { getModelConfig } from "../logic/pricing";
import type { StudioMode, ToolId } from "../types";
import { resolveAiStudioAllowedModelOptions } from "../logic/modelSelectionPolicy";
import { resolveVideoGenerationLaneFromFrameInputs } from "../logic/referenceInputs";

type UseAiStudioAllowedModelOptionsArgs = {
  selectedTool: ToolId | null;
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  mode: StudioMode;
  referenceImageUrl?: string | null;
  extraImageUrls?: [string | null, string | null, string | null];
  isCharacterModeEnabled?: boolean;
};

export const useAiStudioAllowedModelOptions = ({
  selectedTool,
  videoReferenceMode,
  mode,
  referenceImageUrl = null,
  extraImageUrls = [null, null, null],
  isCharacterModeEnabled = false,
}: UseAiStudioAllowedModelOptionsArgs) => {
  const resolvedVideoLane =
    selectedTool === "video" || selectedTool === "kling"
      ? resolveVideoGenerationLaneFromFrameInputs({
          primary: referenceImageUrl,
          extras: extraImageUrls,
          referenceMode: videoReferenceMode,
        })
      : undefined;

  return useMemo(
    () =>
      resolveAiStudioAllowedModelOptions({
        selectedTool,
        mode,
        videoReferenceMode,
        resolvedVideoLane,
        isCharacterModeEnabled,
        options: modelOptions,
        getModelConfig,
      }),
    [
      extraImageUrls,
      isCharacterModeEnabled,
      mode,
      referenceImageUrl,
      resolvedVideoLane,
      selectedTool,
      videoReferenceMode,
    ]
  );
};
