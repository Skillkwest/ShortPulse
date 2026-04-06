/**
 * Derived page configuration hook for AI Studio.
 * Centralizes model filtering, prompt routing, pricing param shaping, and template-view detection.
 */
import { useCallback, useMemo } from "react";
import { modelOptions } from "../constants";
import { buildDefaultPricingParams, getModelConfig } from "../logic/pricing";
import type { PricingParams } from "../logic/pricingTypes";
import { resolveAiStudioAllowedModelOptions } from "../logic/modelSelectionPolicy";
import { resolveVideoGenerationLaneFromFrameInputs } from "../logic/referenceInputs";
import { KIE_KLING_30_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";
import type { StudioMode, ToolId } from "../types";

type UseAiStudioPageDerivationsParams = {
  mode: StudioMode;
  selectedTool: ToolId | null;
  model: string | null;
  aspect: string;
  prompt: string;
  editReferenceText: string;
  videoReferenceText: string;
  videoReferenceMode: string;
  referenceImageUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  isCharacterModeEnabled?: boolean;
};

/**
 * Returns shared derived values used by the page composition layer.
 */
export const useAiStudioPageDerivations = ({
  mode,
  selectedTool,
  model,
  aspect,
  prompt,
  editReferenceText,
  videoReferenceText,
  videoReferenceMode,
  referenceImageUrl,
  extraImageUrls,
  isCharacterModeEnabled = false,
}: UseAiStudioPageDerivationsParams) => {
  const isTemplateView =
    selectedTool === "templates" ||
    selectedTool === "workflows" ||
    selectedTool === "my-generations" ||
    selectedTool === "community";

  const defaultPricingParams = useMemo(
    () => (model ? buildDefaultPricingParams(model) : {}),
    [model]
  );

  const costParamsForModel = useCallback(
    (overrides: Omit<PricingParams, "modelId"> = {}) => ({
      modelId: model ?? "",
      ...defaultPricingParams,
      aspect,
      ...overrides,
    }),
    [aspect, defaultPricingParams, model]
  );

  const filteredModelOptions = useMemo(() => {
    const normalizedVideoReferenceMode =
      videoReferenceMode === "keyframes" ||
      videoReferenceMode === "kling3" ||
      videoReferenceMode === "motion"
        ? videoReferenceMode
        : "standard";
    const resolvedVideoLane =
      selectedTool === "video" || selectedTool === "kling"
        ? resolveVideoGenerationLaneFromFrameInputs({
            primary: referenceImageUrl,
            extras: extraImageUrls,
            referenceMode: normalizedVideoReferenceMode,
          })
        : undefined;
    const allowedOptions = resolveAiStudioAllowedModelOptions({
      selectedTool,
      mode,
      videoReferenceMode: normalizedVideoReferenceMode,
      resolvedVideoLane,
      isCharacterModeEnabled,
      options: modelOptions,
      getModelConfig,
    });
    if (selectedTool === "video" && model === KIE_KLING_30_MODEL_ID) {
      const nonFalOptions = allowedOptions.filter((option) => !option.value.startsWith("fal-ai/"));
      if (nonFalOptions.some((option) => option.value === model)) {
        return nonFalOptions;
      }
      const activeModelOption = modelOptions.find((option) => option.value === model);
      return activeModelOption ? [activeModelOption, ...nonFalOptions] : nonFalOptions;
    }
    return allowedOptions;
  }, [
    extraImageUrls,
    getModelConfig,
    isCharacterModeEnabled,
    mode,
    model,
    referenceImageUrl,
    selectedTool,
    videoReferenceMode,
  ]);

  const resolveDefaultPromptForTool = useCallback(
    (tool: ToolId | null) => {
      if (tool === "video" || tool === "kling") return videoReferenceText;
      if (tool === "image" || tool === "edit") return editReferenceText;
      return prompt;
    },
    [editReferenceText, prompt, videoReferenceText]
  );

  const promptForViewModel = useMemo(
    () => resolveDefaultPromptForTool(selectedTool),
    [resolveDefaultPromptForTool, selectedTool]
  );

  return {
    isTemplateView,
    costParamsForModel,
    filteredModelOptions,
    resolveDefaultPromptForTool,
    promptForViewModel,
  };
};
