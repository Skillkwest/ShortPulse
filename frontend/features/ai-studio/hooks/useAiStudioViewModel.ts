/**
 * View-model helper for AI Studio page.
 * Computes pricing, guardrails, and derived flags to keep the page lean.
 */
import { useCallback, useMemo } from "react";
import { computeCostForModel, getModelConfig } from "../logic/pricing";
import type { PricingParams } from "../logic/pricingTypes";
import { estimateDescribeTokens, estimatePromptTokens } from "../logic/tokenEstimates";
import { TEXT_PROMPT_MODEL_ID } from "../logic/promptGeneration";
import { normalizeImageResolutionForPricing } from "../logic/imageResolution";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import { resolveVideoGenerationLaneFromFrameInputs } from "../logic/referenceInputs";
import {
  resolveEffectiveEditSubmitModelId,
  type EditSubmitIntent,
} from "../logic/editSubmitIntent";
import { isCreateWorkflow, isEditWorkflow, isVideoWorkflow } from "../logic/workflowIdentity";
import type { StudioMode, StudioOutput, ToolId } from "../types";

const FAL_VEO_FIRST_LAST_MODEL_ID = "fal-ai/veo3.1/first-last-frame-to-video";

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
  videoReferenceMode: "standard" | "modify" | "keyframes" | "kling3" | "motion";
  motionReferenceVideoUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  imageResolution: string;
  videoGenerateAudio: boolean;
  klingWorkflowMode?: "single" | "multi" | "custom";
  klingMultiPrompts?: { id: string; prompt: string; duration: number }[];
  balanceCredits: number | null;
  editSubmitIntent?: EditSubmitIntent;
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
  klingWorkflowMode = "single",
  klingMultiPrompts = [],
  balanceCredits,
  editSubmitIntent,
  costParamsForModel,
}: ViewModelInput) => {
  const isCreateWorkflowSelected = isCreateWorkflow(selectedTool);
  const isEditWorkflowSelected = isEditWorkflow(selectedTool);
  const isVideoWorkflowSelected = isVideoWorkflow(selectedTool);
  const selectedModelConfig = useMemo(() => (model ? getModelConfig(model) : null), [model]);
  const effectiveEditSubmitModelId = useMemo(
    () =>
      resolveEffectiveEditSubmitModelId({
        selectedTool,
        selectedModelId: model,
        editSubmitIntent,
      }),
    [editSubmitIntent, model, selectedTool]
  );
  const isDescribeMode = isCreateWorkflowSelected && mode === "text" && useReferenceImageIndicator;
  const requiresModelSelection =
    (isCreateWorkflowSelected && mode !== "text") ||
    isVideoWorkflowSelected ||
    isEditWorkflowSelected;
  const isModelSelected = Boolean(effectiveEditSubmitModelId);
  const hasDescribeImage = Boolean(referenceImageUrl || activeOutput?.previewUrl);
  const isVideoTool = isVideoWorkflowSelected;
  const isImageTool = (isCreateWorkflowSelected && mode === "image") || isEditWorkflowSelected;
  const resolvedVideoLane = useMemo(
    () =>
      resolveVideoGenerationLaneFromFrameInputs({
        primary: referenceImageUrl,
        extras: extraImageUrls,
        referenceMode: videoReferenceMode,
      }),
    [extraImageUrls, referenceImageUrl, videoReferenceMode]
  );
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
    if (isCreateWorkflowSelected) {
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

    if (isEditWorkflowSelected) {
      if (!effectiveEditSubmitModelId) return null;
      return computeCostForModel(
        effectiveEditSubmitModelId,
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
    effectiveEditSubmitModelId,
    isCreateWorkflowSelected,
    isEditWorkflowSelected,
    isVideoTool,
    videoDurationSeconds,
    videoResolution,
    pricingImageResolution,
    videoGenerateAudio,
  ]);

  const currentCostCredits = currentCost?.credits ?? null;
  // Cost shown in the model picker (also used by agent-output generation affordances).
  const modelPickerCostCredits = useMemo(() => {
    if (!effectiveEditSubmitModelId) return null;
    const breakdown = computeCostForModel(
      effectiveEditSubmitModelId,
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
    effectiveEditSubmitModelId,
    isVideoTool,
    isImageTool,
    pricingImageResolution,
    videoDurationSeconds,
    videoGenerateAudio,
    videoResolution,
  ]);

  const resolveModelPickerCredits = useCallback(
    (modelIdForChip: string): number | null => {
      if (!modelIdForChip) return null;
      const breakdown = computeCostForModel(
        modelIdForChip,
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
    },
    [
      costParamsForModel,
      isImageTool,
      isVideoTool,
      pricingImageResolution,
      videoDurationSeconds,
      videoGenerateAudio,
      videoResolution,
    ]
  );

  const promptGenerateCostCredits = useMemo(() => {
    if (!effectiveEditSubmitModelId || !isImageTool) return null;
    const breakdown = computeCostForModel(
      effectiveEditSubmitModelId,
      costParamsForModel({
        aspect,
        ...(pricingImageResolution ? { resolution: pricingImageResolution } : {}),
      })
    );
    return breakdown?.credits ?? null;
  }, [aspect, costParamsForModel, effectiveEditSubmitModelId, isImageTool, pricingImageResolution]);
  const createTextImageGenerateCostCredits = useMemo(() => {
    if (!isCreateWorkflowSelected || mode !== "text" || !effectiveEditSubmitModelId) return null;
    const breakdown = computeCostForModel(
      effectiveEditSubmitModelId,
      costParamsForModel({
        aspect,
        ...(pricingImageResolution ? { resolution: pricingImageResolution } : {}),
      })
    );
    return breakdown?.credits ?? null;
  }, [
    aspect,
    costParamsForModel,
    effectiveEditSubmitModelId,
    isCreateWorkflowSelected,
    mode,
    pricingImageResolution,
  ]);
  const promptReferenceGenerateCostCredits =
    (isImageTool ? promptGenerateCostCredits : null) ??
    (isCreateWorkflowSelected && mode === "text" ? createTextImageGenerateCostCredits : null) ??
    modelPickerCostCredits ??
    currentCostCredits;
  const hasSufficientCreditsForPromptReferenceGenerate =
    balanceCredits == null || promptReferenceGenerateCostCredits == null
      ? true
      : balanceCredits >= promptReferenceGenerateCostCredits;

  const costedFlow =
    (isCreateWorkflowSelected && (mode === "image" || mode === "video")) ||
    isVideoTool ||
    isEditWorkflowSelected;

  const hasSufficientCreditsForCost =
    !costedFlow || balanceCredits == null || currentCostCredits == null
      ? true
      : balanceCredits >= currentCostCredits;
  const isCreditGuardrail = costedFlow && !hasSufficientCreditsForCost;

  const generationGuardrail = useMemo(() => {
    if (isCreateWorkflowSelected && mode === "text") return null;
    if (requiresModelSelection && !isModelSelected)
      return "Select a model before running a generation.";
    if (isEditWorkflowSelected) {
      if (!referenceImageUrl) return "Add a reference image before generating.";
    }
    if (isDescribeMode && !hasDescribeImage) return "Add or select an image to describe.";
    const isDedicatedVeoFirstLastModel = model === FAL_VEO_FIRST_LAST_MODEL_ID;
    const isKeyframeCapableVeoModel =
      isDedicatedVeoFirstLastModel || model === KIE_VEO_31_FAST_I2V_MODEL_ID;
    const hasBothVeoFrames = Boolean(referenceImageUrl && extraImageUrls[0]);
    if (
      isVideoTool &&
      (resolvedVideoLane === "first-last" || isDedicatedVeoFirstLastModel) &&
      isKeyframeCapableVeoModel &&
      !hasBothVeoFrames
    ) {
      return "Add both first and last frame images before generating.";
    }
    if (isVideoTool && resolvedVideoLane === "motion") {
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
    if (
      isVideoTool &&
      videoReferenceMode === "standard" &&
      model === KIE_KLING_30_MODEL_ID &&
      !referenceImageUrl &&
      !extraImageUrls[0]
    ) {
      return "Add a first frame image before generating with Kling 3.0.";
    }
    if (
      isVideoTool &&
      videoReferenceMode === "standard" &&
      model === KIE_KLING_30_MODEL_ID &&
      klingWorkflowMode === "custom" &&
      !klingMultiPrompts.some((shot) => shot.prompt.trim().length > 0)
    ) {
      return "Add at least one custom Kling shot prompt before generating.";
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
    referenceImageUrl,
    requiresModelSelection,
    selectedModelConfig,
    klingMultiPrompts,
    klingWorkflowMode,
    mode,
    isCreateWorkflowSelected,
    isEditWorkflowSelected,
    resolvedVideoLane,
    videoReferenceMode,
  ]);

  const isGenerateDisabled = Boolean(generationGuardrail);
  const modelConfig = selectedModelConfig;

  // Warning when user hasn't provided reference image for image-to-image or image-to-video models
  const referenceImageWarning = useMemo(() => {
    if (!model || !modelConfig) return null;

    // Check if using image tool with image-to-image model but no reference
    if (isEditWorkflowSelected) {
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
      if (resolvedVideoLane === "motion") {
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
      if (
        model === KIE_KLING_30_MODEL_ID &&
        videoReferenceMode === "standard" &&
        !hasReference &&
        !extraImageUrls[0]
      ) {
        return "Kling 3.0 requires a first frame image in Standard mode.";
      }
    }

    return null;
  }, [
    model,
    modelConfig,
    isEditWorkflowSelected,
    referenceImageUrl,
    isVideoTool,
    resolvedVideoLane,
    motionReferenceVideoUrl,
    extraImageUrls,
    videoReferenceMode,
  ]);

  return {
    currentCost,
    currentCostCredits,
    modelPickerCostCredits,
    resolveModelPickerCredits,
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
