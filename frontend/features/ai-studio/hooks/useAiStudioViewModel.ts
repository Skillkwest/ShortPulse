/**
 * View-model helper for AI Studio page.
 * Computes pricing, guardrails, and derived flags to keep the page lean.
 */
import { useMemo } from "react";
import { computeCostForModel, getModelConfig } from "../logic/pricing";
import type { PricingParams } from "../logic/pricingTypes";
import { estimateDescribeTokens, estimatePromptTokens } from "../logic/tokenEstimates";
import { TEXT_PROMPT_MODEL_ID } from "../logic/promptGeneration";
import { normalizeImageResolutionForPricing } from "../logic/imageResolution";
import type { StudioMode, StudioOutput, ToolId } from "../types";

type ViewModelInput = {
  mode: StudioMode;
  model: string | null;
  aspect: string;
  prompt: string;
  referenceImageUrl: string | null;
  activeOutput: StudioOutput | null;
  selectedTool: ToolId | null;
  useReferenceImageIndicator: boolean;
  getDefaultDurationSeconds: (modelId: string | null) => number;
  videoDurationSeconds: number;
  videoResolution: string;
  videoReferenceMode: "standard" | "keyframes" | "kling3" | "motion";
  motionReferenceVideoUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  imageResolution: string;
  videoGenerateAudio: boolean;
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
  selectedTool,
  useReferenceImageIndicator,
  getDefaultDurationSeconds,
  videoDurationSeconds,
  videoResolution,
  videoReferenceMode,
  motionReferenceVideoUrl,
  extraImageUrls,
  imageResolution,
  videoGenerateAudio,
  balanceCredits,
  costParamsForModel,
}: ViewModelInput) => {
  const isDescribeMode =
    (selectedTool === "create" || selectedTool === "text") &&
    mode === "text" &&
    useReferenceImageIndicator;
  const requiresModelSelection =
    ((selectedTool === "create" || selectedTool === "text") && mode !== "text") ||
    selectedTool === "video" ||
    selectedTool === "image" ||
    selectedTool === "edit";
  const isModelSelected = Boolean(model);
  const hasDescribeImage = Boolean(referenceImageUrl || activeOutput?.previewUrl);
  const isVideoTool = selectedTool === "video" || selectedTool === "kling";
  const isImageTool =
    ((selectedTool === "create" || selectedTool === "text") && mode === "image") ||
    selectedTool === "image" ||
    selectedTool === "edit";
  const pricingImageResolution = useMemo(
    () => normalizeImageResolutionForPricing(imageResolution),
    [imageResolution]
  );

  const estimatedTextTokens = useMemo(() => estimatePromptTokens(prompt), [prompt]);
  const estimatedDescribeTokens = useMemo(
    () => (prompt ? estimatePromptTokens(prompt) : estimateDescribeTokens()),
    [prompt]
  );

  const currentCost = useMemo(() => {
    if (selectedTool === "create" || selectedTool === "text") {
      if (mode === "image") {
        if (!model) return null;
        return computeCostForModel(
          model,
          costParamsForModel(pricingImageResolution ? { resolution: pricingImageResolution } : {})
        );
      }
      if (mode === "video") {
        if (!model) return null;
        return computeCostForModel(
          model,
          costParamsForModel({ durationSeconds: getDefaultDurationSeconds(model) })
        );
      }
      if (mode === "text") {
        if (isDescribeMode) {
          return computeCostForModel(TEXT_PROMPT_MODEL_ID, estimatedDescribeTokens);
        }
        return computeCostForModel(TEXT_PROMPT_MODEL_ID, estimatedTextTokens);
      }
      return null;
    }

    if (selectedTool === "image" || selectedTool === "edit") {
      if (!model) return null;
      return computeCostForModel(
        model,
        costParamsForModel(pricingImageResolution ? { resolution: pricingImageResolution } : {})
      );
    }

    if (isVideoTool) {
      if (!model) return null;
      return computeCostForModel(
        model,
        costParamsForModel({
          durationSeconds: videoDurationSeconds,
          resolution: videoResolution,
          audio: videoGenerateAudio,
        })
      );
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
    isVideoTool,
    videoDurationSeconds,
    videoResolution,
    pricingImageResolution,
    videoGenerateAudio,
  ]);

  const currentCostCredits = currentCost?.credits ?? null;
  // Cost shown in the model picker (and what we also want on prompt-card Generate pills)
  const modelPickerCostCredits = useMemo(() => {
    if (!model) return null;
    const breakdown = computeCostForModel(
      model,
      costParamsForModel(
        isVideoTool
          ? {
              durationSeconds: videoDurationSeconds,
              resolution: videoResolution,
              audio: videoGenerateAudio,
            }
          : isImageTool && pricingImageResolution
            ? { resolution: pricingImageResolution }
            : {}
      )
    );
    return breakdown?.credits ?? null;
  }, [
    costParamsForModel,
    isVideoTool,
    isImageTool,
    model,
    pricingImageResolution,
    videoDurationSeconds,
    videoGenerateAudio,
    videoResolution,
  ]);

  const promptGenerateCostCredits = useMemo(() => {
    if (!model) return null;
    const breakdown = computeCostForModel(
      model,
      costParamsForModel({
        aspect,
        ...(pricingImageResolution ? { resolution: pricingImageResolution } : {}),
      })
    );
    return breakdown?.credits ?? null;
  }, [aspect, costParamsForModel, model, pricingImageResolution]);
  const promptReferenceGenerateCostCredits =
    promptGenerateCostCredits ?? modelPickerCostCredits ?? currentCostCredits;
  const hasSufficientCreditsForPromptReferenceGenerate =
    balanceCredits == null || promptReferenceGenerateCostCredits == null
      ? true
      : balanceCredits >= promptReferenceGenerateCostCredits;

  const costedFlow =
    ((selectedTool === "create" || selectedTool === "text") &&
      (mode === "image" || mode === "video")) ||
    isVideoTool ||
    selectedTool === "image" ||
    selectedTool === "edit";

  const hasSufficientCreditsForCost =
    !costedFlow || balanceCredits == null || currentCostCredits == null
      ? true
      : balanceCredits >= currentCostCredits;
  const isCreditGuardrail = costedFlow && !hasSufficientCreditsForCost;

  const generationGuardrail = useMemo(() => {
    if ((selectedTool === "create" || selectedTool === "text") && mode === "text") return null;
    if (requiresModelSelection && !isModelSelected)
      return "Select a model before running a generation.";
    if (selectedTool === "edit") {
      if (!referenceImageUrl) return "Add a reference image before generating.";
      if (!prompt.trim()) return 'Add a prompt in "Write Your Prompt" before generating.';
    }
    if (isDescribeMode && !hasDescribeImage) return "Add or select an image to describe.";
    if (isVideoTool && videoReferenceMode === "standard" && !referenceImageUrl) {
      return "Add a reference image before generating.";
    }
    const isVeoFirstLastModel = model === "fal-ai/veo3.1/first-last-frame-to-video";
    const hasBothVeoFrames = Boolean(referenceImageUrl && extraImageUrls[0]);
    if (
      isVideoTool &&
      videoReferenceMode === "keyframes" &&
      isVeoFirstLastModel &&
      !hasBothVeoFrames
    ) {
      return "Add both first and last frame images before generating.";
    }
    if (isVideoTool && videoReferenceMode === "motion") {
      const hasCharacterImage = Boolean(referenceImageUrl);
      const hasMotionVideo = Boolean(motionReferenceVideoUrl);
      if (!hasCharacterImage && !hasMotionVideo) {
        return "Add a character image and motion reference video before generating.";
      }
      if (!hasCharacterImage) {
        return "Add a character image before generating in Motion Control.";
      }
      if (!hasMotionVideo) {
        return "Add a motion reference video before generating in Motion Control.";
      }
    }
    if (isCreditGuardrail) return "You do not have enough credits for this run.";
    return null;
  }, [
    extraImageUrls,
    hasDescribeImage,
    isVideoTool,
    isCreditGuardrail,
    isDescribeMode,
    isModelSelected,
    model,
    motionReferenceVideoUrl,
    prompt,
    referenceImageUrl,
    requiresModelSelection,
    mode,
    selectedTool,
    videoReferenceMode,
  ]);

  const isGenerateDisabled = Boolean(generationGuardrail);
  const modelConfig = useMemo(() => (model ? getModelConfig(model) : null), [model]);

  // Warning when user hasn't provided reference image for image-to-image or image-to-video models
  const referenceImageWarning = useMemo(() => {
    if (!model || !modelConfig) return null;

    // Check if using image tool with image-to-image model but no reference
    if (selectedTool === "image" || selectedTool === "edit") {
      const hasReference = Boolean(referenceImageUrl);
      const isImageToImageOnly =
        modelConfig.supportsImageToImage && !modelConfig.supportsTextToImage;

      if (!hasReference && isImageToImageOnly) {
        return "No reference image detected. Edit workflow requires a reference image and will not fallback to text-to-image.";
      }
    }

    // Check if using video tool with image-to-video model but no reference
    if (isVideoTool) {
      const hasReference = Boolean(referenceImageUrl);
      const hasMotionVideo = Boolean(motionReferenceVideoUrl);
      if (videoReferenceMode === "motion") {
        if (!hasReference && !hasMotionVideo) {
          return "Motion Control requires a character image and motion reference video.";
        }
        if (!hasReference) {
          return "Motion Control requires a character reference image.";
        }
        if (!hasMotionVideo) {
          return "Motion Control requires a motion reference video.";
        }
      }
    }

    return null;
  }, [
    model,
    modelConfig,
    selectedTool,
    referenceImageUrl,
    isVideoTool,
    videoReferenceMode,
    motionReferenceVideoUrl,
  ]);

  return {
    currentCost,
    currentCostCredits,
    modelPickerCostCredits,
    promptGenerateCostCredits,
    promptReferenceGenerateCostCredits,
    hasSufficientCreditsForCost,
    hasSufficientCreditsForPromptReferenceGenerate,
    isCreditGuardrail,
    generationGuardrail,
    isGenerateDisabled,
    modelConfig,
    referenceImageWarning,
  };
};
