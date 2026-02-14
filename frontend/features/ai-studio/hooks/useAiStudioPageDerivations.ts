/**
 * Derived page configuration hook for AI Studio.
 * Centralizes model filtering, prompt routing, pricing param shaping, and template-view detection.
 */
import { useCallback, useMemo } from "react";
import { modelOptions } from "../constants";
import { buildDefaultPricingParams, getModelConfig } from "../logic/pricing";
import type { PricingParams } from "../logic/pricingTypes";
import { filterModelOptions } from "../logic/stateParsers";
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
    const base = filterModelOptions(mode, selectedTool, modelOptions, getModelConfig);
    if (selectedTool === "video" && videoReferenceMode === "standard") {
      return base.filter(
        (opt) => opt.mediaType === "image-to-video" && !opt.value.includes("kling")
      );
    }
    if (selectedTool === "video" && videoReferenceMode === "keyframes") {
      return base.filter((opt) => opt.value === "fal-ai/veo3.1/first-last-frame-to-video");
    }
    if (selectedTool === "video" && videoReferenceMode === "kling3") {
      return base.filter((opt) => opt.value === "fal-ai/kling-video/v3/pro/image-to-video");
    }
    return base;
  }, [mode, selectedTool, videoReferenceMode]);

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
