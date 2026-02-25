/**
 * Derived page configuration hook for AI Studio.
 * Centralizes model filtering, prompt routing, pricing param shaping, and template-view detection.
 */
import { useCallback, useMemo } from "react";
import { modelOptions } from "../constants";
import { buildDefaultPricingParams, getModelConfig } from "../logic/pricing";
import type { PricingParams } from "../logic/pricingTypes";
import { resolveAiStudioAllowedModelOptions } from "../logic/modelSelectionPolicy";
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
    return resolveAiStudioAllowedModelOptions({
      selectedTool,
      mode,
      videoReferenceMode: normalizedVideoReferenceMode,
      isCharacterModeEnabled,
      options: modelOptions,
      getModelConfig,
    });
  }, [isCharacterModeEnabled, mode, selectedTool, videoReferenceMode]);

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
