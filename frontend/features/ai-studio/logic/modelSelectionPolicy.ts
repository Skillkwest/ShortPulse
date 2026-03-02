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
  provider?: string;
};

const isCreateTool = (tool: ToolId | null): boolean => tool === "create" || tool === "text";

const isImageMediaOption = (option: ModelOption): boolean => {
  return !option.mediaType || option.mediaType === "image" || option.mediaType === "multi";
};

const isVideoMediaOption = (option: ModelOption): boolean => {
  return !option.mediaType || option.mediaType === "video" || option.mediaType === "multi";
};

const isOptionProviderSelectable = ({
  option,
  getModelConfig,
}: {
  option: ModelOption;
  getModelConfig: (id: string) => ModelConfigLike | null;
}): boolean => {
  // Provider runtime/allowlist guards are enforced server-side; selector policy remains provider-neutral.
  void getModelConfig(option.value)?.provider;
  return true;
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
  const selectableOptions = options.filter((option) =>
    isOptionProviderSelectable({ option, getModelConfig })
  );

  if (selectedTool === "video" || selectedTool === "kling") {
    if (videoReferenceMode === "keyframes") {
      return selectableOptions.filter(
        (option) => option.value === "fal-ai/veo3.1/first-last-frame-to-video"
      );
    }
    if (videoReferenceMode === "motion") {
      return selectableOptions.filter(
        (option) => option.value === "fal-ai/kling-video/v3/pro/image-to-video"
      );
    }
    if (selectedTool === "kling" || videoReferenceMode === "kling3") {
      return selectableOptions.filter(
        (option) => option.value === "fal-ai/kling-video/v3/pro/image-to-video"
      );
    }
    return selectableOptions.filter(
      (option) =>
        option.mediaType === "image-to-video" &&
        !option.value.includes("kling-video") &&
        option.value !== "fal-ai/veo3.1/first-last-frame-to-video"
    );
  }

  if (isCreateTool(selectedTool) && mode === "video") {
    return selectableOptions.filter((option) => isVideoMediaOption(option));
  }

  if (isCreateTool(selectedTool) && mode === "image") {
    if (isCharacterModeEnabled) {
      const allowedCharacterModeModelIds = new Set(getCreateCharacterModeAllowedModels());
      return selectableOptions.filter((option) => {
        if (!allowedCharacterModeModelIds.has(option.value)) return false;
        if (!isImageMediaOption(option)) return false;
        const config = getModelConfig(option.value);
        return Boolean(config?.supportsImageToImage);
      });
    }
    return selectableOptions.filter((option) => {
      if (!isImageMediaOption(option)) return false;
      if (option.value === "fal/flux-2-pro") return false;
      const config = getModelConfig(option.value);
      return Boolean(config?.supportsTextToImage);
    });
  }

  if (selectedTool === "image" || selectedTool === "edit") {
    return selectableOptions.filter((option) => {
      if (!isImageMediaOption(option)) return false;
      const config = getModelConfig(option.value);
      return Boolean(config?.supportsImageToImage);
    });
  }

  return selectableOptions;
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
