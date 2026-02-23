import { useMemo } from "react";
import { modelOptions } from "../constants";
import { getModelConfig } from "../logic/pricing";
import type { StudioMode, ToolId } from "../types";

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
  return useMemo(() => {
    if (selectedTool === "video" || selectedTool === "kling") {
      const isKeyframesMode = videoReferenceMode === "keyframes";
      const isMotionMode = videoReferenceMode === "motion";
      const isKling3Mode = videoReferenceMode === "kling3";
      return modelOptions.filter((opt) => {
        if (isKeyframesMode) {
          return opt.value === "fal-ai/veo3.1/first-last-frame-to-video";
        }
        if (isMotionMode) {
          return opt.value === "fal-ai/kling-video/v3/pro/image-to-video";
        }
        if (selectedTool === "kling" || isKling3Mode) {
          return opt.value === "fal-ai/kling-video/v3/pro/image-to-video";
        }
        return opt.mediaType === "image-to-video" && !opt.value.includes("kling-video");
      });
    }
    if ((selectedTool === "create" || selectedTool === "text") && mode === "video") {
      return modelOptions.filter(
        (opt) => !opt.mediaType || opt.mediaType === "video" || opt.mediaType === "multi"
      );
    }
    if ((selectedTool === "create" || selectedTool === "text") && mode === "image") {
      return modelOptions.filter((opt) => {
        const matchesMedia =
          !opt.mediaType || opt.mediaType === "image" || opt.mediaType === "multi";
        if (!matchesMedia) return false;
        const config = getModelConfig(opt.value);
        return Boolean(config?.supportsTextToImage);
      });
    }
    if (selectedTool === "image" || selectedTool === "edit") {
      return modelOptions.filter((opt) => {
        const matchesMedia =
          !opt.mediaType || opt.mediaType === "image" || opt.mediaType === "multi";
        if (!matchesMedia) return false;
        const config = getModelConfig(opt.value);
        return Boolean(config?.supportsImageToImage);
      });
    }
    return modelOptions;
  }, [mode, selectedTool, videoReferenceMode]);
};
