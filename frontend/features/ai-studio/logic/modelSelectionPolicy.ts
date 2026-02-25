/**
 * Shared model-selection policy for AI Studio workflows.
 * Centralizes allowed-option filtering and Create startup default-model resolution.
 */
import type { ModelOption } from "../constants";
import { modelOptions } from "../constants";
import type { StudioMode, ToolId } from "../types";
import {
  CREATE_DEFAULT_MODEL_ID,
  getCreateCharacterModeAllowedModels,
} from "./createCharacterModeModelMapping";

export { CREATE_DEFAULT_MODEL_ID };

export type ModelSelectionVideoReferenceMode = "standard" | "keyframes" | "kling3" | "motion";

type ModelConfigLike = {
  supportsImageToImage?: boolean;
  supportsTextToImage?: boolean;
};

const isCreateTool = (tool: ToolId | null): boolean => tool === "create" || tool === "text";

const isImageMediaOption = (option: ModelOption): boolean => {
  return !option.mediaType || option.mediaType === "image" || option.mediaType === "multi";
};

const isVideoMediaOption = (option: ModelOption): boolean => {
  return !option.mediaType || option.mediaType === "video" || option.mediaType === "multi";
};

/**
 * Returns the policy-approved model options for the current workflow selector state.
 * `isCharacterModeEnabled` is a UI-option filter knob for Create/Image model lists.
 */
export const resolveAiStudioAllowedModelOptions = ({
  selectedTool,
  mode,
  videoReferenceMode,
  isCharacterModeEnabled = false,
  options = modelOptions,
  getModelConfig,
}: {
  selectedTool: ToolId | null;
  mode: StudioMode;
  videoReferenceMode: ModelSelectionVideoReferenceMode;
  isCharacterModeEnabled?: boolean;
  options?: ModelOption[];
  getModelConfig: (id: string) => ModelConfigLike | null;
}): ModelOption[] => {
  if (selectedTool === "video" || selectedTool === "kling") {
    if (videoReferenceMode === "keyframes") {
      return options.filter((option) => option.value === "fal-ai/veo3.1/first-last-frame-to-video");
    }
    if (videoReferenceMode === "motion") {
      return options.filter(
        (option) => option.value === "fal-ai/kling-video/v3/pro/image-to-video"
      );
    }
    if (selectedTool === "kling" || videoReferenceMode === "kling3") {
      return options.filter(
        (option) => option.value === "fal-ai/kling-video/v3/pro/image-to-video"
      );
    }
    return options.filter(
      (option) => option.mediaType === "image-to-video" && !option.value.includes("kling-video")
    );
  }

  if (isCreateTool(selectedTool) && mode === "video") {
    return options.filter((option) => isVideoMediaOption(option));
  }

  if (isCreateTool(selectedTool) && mode === "image") {
    if (isCharacterModeEnabled) {
      const allowedCharacterModeModelIds = new Set(getCreateCharacterModeAllowedModels());
      return options.filter((option) => {
        if (!allowedCharacterModeModelIds.has(option.value)) return false;
        if (!isImageMediaOption(option)) return false;
        const config = getModelConfig(option.value);
        return Boolean(config?.supportsImageToImage);
      });
    }
    return options.filter((option) => {
      if (!isImageMediaOption(option)) return false;
      if (option.value === "fal/flux-2-pro") return false;
      const config = getModelConfig(option.value);
      return Boolean(config?.supportsTextToImage);
    });
  }

  if (selectedTool === "image" || selectedTool === "edit") {
    return options.filter((option) => {
      if (!isImageMediaOption(option)) return false;
      const config = getModelConfig(option.value);
      return Boolean(config?.supportsImageToImage);
    });
  }

  return options;
};

/**
 * Resolves Create workflow startup model using saved-value precedence and policy defaults.
 */
export const resolveCreateWorkflowStartupModel = ({
  mode,
  savedModelId,
  getModelConfig,
}: {
  mode: StudioMode;
  savedModelId: string | null;
  getModelConfig: (id: string) => ModelConfigLike | null;
}): string | null => {
  const allowedValues = new Set(
    resolveAiStudioAllowedModelOptions({
      selectedTool: "create",
      mode,
      videoReferenceMode: "standard",
      getModelConfig,
    }).map((option) => option.value)
  );

  if (savedModelId && allowedValues.has(savedModelId)) {
    return savedModelId;
  }

  if (mode === "image" && allowedValues.has(CREATE_DEFAULT_MODEL_ID)) {
    return CREATE_DEFAULT_MODEL_ID;
  }

  return null;
};
