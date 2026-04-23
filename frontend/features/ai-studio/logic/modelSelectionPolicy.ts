/**
 * Shared model-selection policy for AI Studio workflows.
 * Centralizes allowed-option filtering and Create startup default-model resolution.
 */
import type { ModelOption } from "../constants";
import { modelOptions } from "../constants";
import { isSeedance2ModelId, isSeedance2UiEnabled } from "./seedance2Availability";
import type { StudioMode, ToolId } from "../types";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import type { ResolvedVideoGenerationLane } from "./referenceInputs";
import {
  CREATE_DEFAULT_MODEL_ID,
  CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID,
  getCreateCharacterModeAllowedModels,
} from "./createCharacterModeModelMapping";

export { CREATE_DEFAULT_MODEL_ID };
export const EDIT_DEFAULT_MODEL_ID = CREATE_CHARACTER_MODE_DEFAULT_MODEL_ID;

export type ModelSelectionVideoReferenceMode =
  | "standard"
  | "modify"
  | "keyframes"
  | "kling3"
  | "motion";

const FAL_VEO_FIRST_LAST_MODEL_ID = "fal-ai/veo3.1/first-last-frame-to-video";
const BLOCKED_VIDEO_SELECTOR_MODEL_IDS = new Set([
  "fal-ai/veo3.1",
  "fal-ai/veo3.1/image-to-video",
  FAL_VEO_FIRST_LAST_MODEL_ID,
  "fal-ai/kling-video/v3/pro/text-to-video",
  "fal-ai/kling-video/v3/pro/image-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
]);

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
  return (
    !option.mediaType ||
    option.mediaType === "video" ||
    option.mediaType === "image-to-video" ||
    option.mediaType === "multi"
  );
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
  resolvedVideoLane,
  isCharacterModeEnabled = false,
  options = modelOptions,
  getModelConfig,
}: {
  selectedTool: ToolId | null;
  mode: StudioMode;
  videoReferenceMode: ModelSelectionVideoReferenceMode;
  resolvedVideoLane?: ResolvedVideoGenerationLane;
  isCharacterModeEnabled?: boolean;
  options?: ModelOption[];
  getModelConfig: (id: string) => ModelConfigLike | null;
}): ModelOption[] => {
  const selectableOptions = options.filter((option) =>
    isOptionProviderSelectable({ option, getModelConfig })
  );

  if (selectedTool === "video" || selectedTool === "kling") {
    const selectorVideoOptions = selectableOptions.filter(
      (option) =>
        !BLOCKED_VIDEO_SELECTOR_MODEL_IDS.has(option.value) &&
        (isSeedance2UiEnabled() || !isSeedance2ModelId(option.value))
    );
    if (videoReferenceMode === "keyframes") {
      return selectorVideoOptions.filter((option) => option.value === KIE_VEO_31_FAST_I2V_MODEL_ID);
    }
    if (videoReferenceMode === "motion") {
      return selectorVideoOptions.filter((option) => option.value === KIE_KLING_30_MODEL_ID);
    }
    if (selectedTool === "kling" || videoReferenceMode === "kling3") {
      return selectorVideoOptions.filter((option) => option.value === KIE_KLING_30_MODEL_ID);
    }
    if (resolvedVideoLane === "text") {
      return selectorVideoOptions.filter(
        (option) =>
          option.value === KIE_VEO_31_FAST_I2V_MODEL_ID ||
          option.value === KIE_KLING_30_MODEL_ID ||
          option.value === KIE_SEEDANCE_15_PRO_MODEL_ID ||
          (isSeedance2UiEnabled() &&
            (option.value === KIE_SEEDANCE_2_MODEL_ID ||
              option.value === KIE_SEEDANCE_2_FAST_MODEL_ID))
      );
    }
    if (resolvedVideoLane === "single-image") {
      return selectorVideoOptions.filter(
        (option) =>
          option.value === KIE_KLING_30_MODEL_ID ||
          option.value === KIE_VEO_31_FAST_I2V_MODEL_ID ||
          option.value === KIE_SEEDANCE_15_PRO_MODEL_ID ||
          (isSeedance2UiEnabled() &&
            (option.value === KIE_SEEDANCE_2_MODEL_ID ||
              option.value === KIE_SEEDANCE_2_FAST_MODEL_ID))
      );
    }
    if (resolvedVideoLane === "first-last") {
      return selectorVideoOptions.filter(
        (option) =>
          option.value === KIE_VEO_31_FAST_I2V_MODEL_ID ||
          option.value === KIE_KLING_30_MODEL_ID ||
          option.value === KIE_SEEDANCE_15_PRO_MODEL_ID ||
          (isSeedance2UiEnabled() &&
            (option.value === KIE_SEEDANCE_2_MODEL_ID ||
              option.value === KIE_SEEDANCE_2_FAST_MODEL_ID))
      );
    }
    return selectorVideoOptions.filter(
      (option) => option.mediaType === "image-to-video" || option.mediaType === "video"
    );
  }

  if (isCreateTool(selectedTool) && mode === "video") {
    return selectableOptions.filter((option) => isVideoMediaOption(option));
  }

  // Create defaults to "text" mode on initial load; keep model picker behavior aligned with
  // Create/Image so we never fall through to an unfiltered full-catalog list.
  if (isCreateTool(selectedTool) && (mode === "image" || mode === "text")) {
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

  if ((mode === "image" || mode === "text") && allowedValues.has(CREATE_DEFAULT_MODEL_ID)) {
    return CREATE_DEFAULT_MODEL_ID;
  }

  return null;
};

/**
 * Resolves Edit workflow startup model using saved-value precedence and policy defaults.
 */
export const resolveEditWorkflowStartupModel = ({
  savedModelId,
  getModelConfig,
}: {
  savedModelId: string | null;
  getModelConfig: (id: string) => ModelConfigLike | null;
}): string | null => {
  const allowedValues = new Set(
    resolveAiStudioAllowedModelOptions({
      selectedTool: "edit",
      mode: "image",
      videoReferenceMode: "standard",
      getModelConfig,
    }).map((option) => option.value)
  );

  if (savedModelId && allowedValues.has(savedModelId)) {
    return savedModelId;
  }

  if (allowedValues.has(EDIT_DEFAULT_MODEL_ID)) {
    return EDIT_DEFAULT_MODEL_ID;
  }

  return null;
};
