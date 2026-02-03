/**
 * View-model helper for AI Studio page.
 * Computes pricing, guardrails, and derived flags to keep the page lean.
 */
import { useMemo } from "react";
import { computeCostForModel, getModelConfig } from "../logic/pricing";
import type { PricingParams } from "../logic/pricingTypes";
import { estimateDescribeTokens, estimatePromptTokens } from "../logic/tokenEstimates";
import { TEXT_PROMPT_MODEL_ID } from "../logic/promptGeneration";
import type { StudioMode, StudioOutput, ToolId } from "../types";

type ViewModelInput = {
  mode: StudioMode;
  model: string | null;
  aspect: string;
  prompt: string;
  referenceImageUrl: string | null;
  activeOutput: StudioOutput | null;
  extraImageUrls: (string | null)[];
  selectedTool: ToolId | null;
  useReferenceImageIndicator: boolean;
  getDefaultDurationSeconds: (modelId: string | null) => number;
  balanceCredits: number | null;
  costParamsForModel: (overrides?: Omit<PricingParams, "modelId">) => PricingParams;
};

export const useAiStudioViewModel = ({
  mode,
  model,
  aspect,
  prompt,
  referenceImageUrl,
  activeOutput,
  extraImageUrls,
  selectedTool,
  useReferenceImageIndicator,
  getDefaultDurationSeconds,
  balanceCredits,
  costParamsForModel,
}: ViewModelInput) => {
  const isDescribeMode = (selectedTool === "create" || selectedTool === "text") && mode === "text" && useReferenceImageIndicator;
  const requiresModelSelection =
    ((selectedTool === "create" || selectedTool === "text") && mode !== "text") || selectedTool === "video";
  const isModelSelected = Boolean(model);
  const hasDescribeImage = Boolean(referenceImageUrl || activeOutput?.previewUrl);

  const estimatedTextTokens = useMemo(() => estimatePromptTokens(prompt), [prompt]);
  const estimatedDescribeTokens = useMemo(
    () => (prompt ? estimatePromptTokens(prompt) : estimateDescribeTokens()),
    [prompt],
  );

  const currentCost = useMemo(() => {
    if (selectedTool === "create" || selectedTool === "text") {
      if (mode === "image") {
        if (!model) return null;
        return computeCostForModel(model, costParamsForModel());
      }
      if (mode === "video") {
        if (!model) return null;
        return computeCostForModel(model, costParamsForModel({ durationSeconds: getDefaultDurationSeconds(model) }));
      }
      if (mode === "text") {
        if (isDescribeMode) {
          return computeCostForModel(TEXT_PROMPT_MODEL_ID, estimatedDescribeTokens);
        }
        return computeCostForModel(TEXT_PROMPT_MODEL_ID, estimatedTextTokens);
      }
      return null;
    }

    if (selectedTool === "image") {
      if (!model) return null;
      return computeCostForModel(model, costParamsForModel());
    }

    if (selectedTool === "video") {
      if (!model) return null;
      return computeCostForModel(model, costParamsForModel({ durationSeconds: getDefaultDurationSeconds(model) }));
    }

    return null;
  }, [
    estimatedDescribeTokens,
    estimatedTextTokens,
    isDescribeMode,
    costParamsForModel,
    getDefaultDurationSeconds,
    mode,
    model,
    selectedTool,
  ]);

  const currentCostCredits = currentCost?.credits ?? null;
  // Cost shown in the model picker (and what we also want on prompt-card Generate pills)
  const modelPickerCostCredits = useMemo(() => {
    if (!model) return null;
    const breakdown = computeCostForModel(model, costParamsForModel());
    return breakdown?.credits ?? null;
  }, [model, costParamsForModel]);

  const promptGenerateCostCredits = useMemo(() => {
    if (!model) return null;
    const breakdown = computeCostForModel(model, costParamsForModel({ aspect }));
    return breakdown?.credits ?? null;
  }, [aspect, costParamsForModel, model]);

  const costedFlow =
    ((selectedTool === "create" || selectedTool === "text") && (mode === "image" || mode === "video")) || selectedTool === "video";
  const hasReferenceImages = [referenceImageUrl, ...extraImageUrls].some((url) => Boolean(url));

  const requiresVideoReference =
    selectedTool === "video" &&
    model === "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";
  const hasVideoReference = hasReferenceImages;
  const isPulseImageToolActive = selectedTool === "image" && mode === "image";
  const requiresReferenceModel =
    model === "fal-ai/nano-banana/edit" ||
    model === "fal-ai/nano-banana-pro/edit" ||
    model === "fal/flux-2/edit" ||
    model === "fal/flux-2-pro/edit";

  const hasSufficientCreditsForCost =
    !costedFlow || balanceCredits == null || currentCostCredits == null
      ? true
      : balanceCredits >= currentCostCredits;

  const generationGuardrail = useMemo(() => {
    if ((selectedTool === "create" || selectedTool === "text") && mode === "text") return null;
    if (requiresModelSelection && !isModelSelected) return "Select a model before running a generation.";
    if (isDescribeMode && !hasDescribeImage) return "Add or select an image to describe.";
    // Removed reference image guardrails - system will automatically fallback to text-to-image/text-to-video when no references exist
    if (costedFlow && !hasSufficientCreditsForCost) return "You do not have enough credits for this run.";
    return null;
  }, [
    costedFlow,
    hasDescribeImage,
    hasSufficientCreditsForCost,
    isDescribeMode,
    isModelSelected,
    requiresModelSelection,
    mode,
    selectedTool,
  ]);

  const isGenerateDisabled = Boolean(generationGuardrail);
  const describeCostCredits = useMemo(() => {
    const breakdown = computeCostForModel(TEXT_PROMPT_MODEL_ID, estimateDescribeTokens());
    return breakdown?.credits ?? null;
    // estimateDescribeTokens is stable; no dependencies needed
  }, []);

  const modelConfig = useMemo(() => (model ? getModelConfig(model) : null), [model]);

  return {
    currentCost,
    currentCostCredits,
    modelPickerCostCredits,
    promptGenerateCostCredits,
    describeCostCredits,
    hasSufficientCreditsForCost,
    generationGuardrail,
    isGenerateDisabled,
    modelConfig,
  };
};
