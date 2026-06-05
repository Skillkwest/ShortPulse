/**
 * View-model helper for AI Studio page.
 * Computes pricing, guardrails, and derived flags to keep the page lean.
 */
import { useCallback, useMemo } from "react";
import { resolveRequiredAiStudioTextPromptModelId } from "../../../lib/model-runtime/modelCatalog";
import {
  resolveCreateImageBilledCreditLookup,
  resolveCreateImageBilledCredits,
} from "../../../lib/model-runtime/createImageBilledCredits";
import {
  resolveEditImageBilledCreditLookup,
  resolveEditImageBilledCredits,
  supportsCanonicalEditImageBilledPricing,
} from "../../../lib/model-runtime/editImageBilledCredits";
import { getModelConfig } from "../logic/pricing";
import type { PricingParams } from "../logic/pricingTypes";
import { estimateDescribeTokens, estimatePromptTokens } from "../logic/tokenEstimates";
import { normalizeImageResolutionForCanonicalBilledPricing } from "../logic/imageResolution";
import {
  resolveClientBilledCredits,
  resolveClientPricingBreakdown,
} from "../logic/clientPricingDisplay";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import { needsVideoUpload } from "../utils/videoUpload";
import {
  getAiStudioKlingElementReferenceUrls,
  type AiStudioKlingElement,
} from "../logic/klingElements";
import { resolveVideoGenerationLaneFromFrameInputs } from "../logic/referenceInputs";
import {
  resolveEffectiveEditSubmitModelId,
  normalizeEditSubmitIntent,
  type EditSubmitIntent,
} from "../logic/editSubmitIntent";
import { resolveCreatePricingTarget } from "../logic/createPricingTarget";
import { isCreateWorkflow, isEditWorkflow, isVideoWorkflow } from "../logic/workflowIdentity";
import type { CharacterModeInjectionBundle } from "./useAiStudioCharacterModeController";
import type { StudioMode, StudioOutput, ToolId } from "../types";

const TEXT_PROMPT_MODEL_ID = resolveRequiredAiStudioTextPromptModelId();

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
  motionReferenceVideoPending?: boolean;
  motionReferenceVideoError?: string | null;
  motionReferenceVideoUrl: string | null;
  extraImageUrls: [string | null, string | null, string | null];
  imageResolution: string;
  videoGenerateAudio: boolean;
  klingWorkflowMode?: "single" | "multi" | "custom";
  klingMultiPrompts?: { id: string; prompt: string; duration: number }[];
  klingElements?: AiStudioKlingElement[];
  seedance2InputMode?: "text" | "first-frame" | "first-last" | "multimodal";
  seedance2ReferenceImageUrls?: string[];
  seedance2ReferenceVideoUrls?: string[];
  seedance2ReferenceAudioUrls?: string[];
  isCreateCharacterModeEnabled?: boolean;
  createCharacterModeInjectionBundle?: CharacterModeInjectionBundle | null;
  balanceCredits: number | null;
  balanceLoading?: boolean;
  balanceError?: string | null;
  editSubmitIntent?: EditSubmitIntent;
  costParamsForModel: (
    modelId: string,
    overrides?: Omit<PricingParams, "modelId">
  ) => PricingParams;
  pricingPolicy?: PricingParams["pricingPolicy"];
  pricingPolicyReady?: boolean;
  pricingPolicyLoading?: boolean;
  pricingPolicyError?: string | null;
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
  motionReferenceVideoPending = false,
  motionReferenceVideoError = null,
  motionReferenceVideoUrl,
  extraImageUrls,
  imageResolution,
  videoGenerateAudio,
  klingWorkflowMode = "single",
  klingMultiPrompts = [],
  klingElements = [],
  seedance2InputMode = "text",
  seedance2ReferenceImageUrls = [],
  seedance2ReferenceVideoUrls = [],
  seedance2ReferenceAudioUrls = [],
  isCreateCharacterModeEnabled = false,
  createCharacterModeInjectionBundle = null,
  balanceCredits,
  balanceLoading = false,
  balanceError = null,
  editSubmitIntent,
  costParamsForModel,
  pricingPolicy = null,
  pricingPolicyReady = true,
  pricingPolicyLoading = false,
  pricingPolicyError = null,
}: ViewModelInput) => {
  void pricingPolicyLoading;
  void pricingPolicyError;
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
        promptText: prompt,
        extraImageUrls,
      }),
    [editSubmitIntent, extraImageUrls, model, prompt, selectedTool]
  );
  const effectiveEditModelConfig = useMemo(
    () => (effectiveEditSubmitModelId ? getModelConfig(effectiveEditSubmitModelId) : null),
    [effectiveEditSubmitModelId]
  );
  const normalizedEditSubmitIntent = useMemo(
    () => normalizeEditSubmitIntent(editSubmitIntent),
    [editSubmitIntent]
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
    () => normalizeImageResolutionForCanonicalBilledPricing(model, imageResolution),
    [imageResolution, model]
  );
  const isSeedance2Model =
    model === KIE_SEEDANCE_2_MODEL_ID || model === KIE_SEEDANCE_2_FAST_MODEL_ID;
  const hasSeedance2MultimodalReferences =
    seedance2ReferenceImageUrls.length > 0 ||
    seedance2ReferenceVideoUrls.length > 0 ||
    seedance2ReferenceAudioUrls.length > 0;
  const seedance2VideoInputCount = useMemo(
    () =>
      seedance2ReferenceVideoUrls.filter((value) => value.trim().length > 0).length +
      klingElements.filter((element) => element.videoUrl.trim().length > 0).length,
    [klingElements, seedance2ReferenceVideoUrls]
  );
  const hasSeedance2LinkedAssetReferences = klingElements.some(
    (element) => element.videoUrl.trim() || getAiStudioKlingElementReferenceUrls(element).length > 0
  );
  const videoPricingParams = useMemo(
    () => ({
      durationSeconds: videoDurationSeconds,
      resolution: videoResolution,
      audio: videoGenerateAudio,
      ...(isSeedance2Model ? { inputVideoCount: seedance2VideoInputCount } : {}),
    }),
    [
      isSeedance2Model,
      seedance2VideoInputCount,
      videoDurationSeconds,
      videoGenerateAudio,
      videoResolution,
    ]
  );
  const requiresResolvedPricingPolicy =
    isVideoTool || isEditWorkflowSelected || isCreateWorkflowSelected;
  const isPricingPolicyUnavailable = requiresResolvedPricingPolicy && !pricingPolicyReady;
  const canUseStandardCreatePricingGrid =
    isCreateWorkflowSelected && Boolean(model) && !isPricingPolicyUnavailable;
  const canResolveStandardEditPricingGrid = isEditWorkflowSelected && !isPricingPolicyUnavailable;
  const canUseCurrentEditPricingGrid =
    canResolveStandardEditPricingGrid &&
    normalizedEditSubmitIntent === "standard" &&
    supportsCanonicalEditImageBilledPricing(effectiveEditSubmitModelId);
  const createReferenceImageUrls = useMemo(
    () => [referenceImageUrl, ...extraImageUrls],
    [extraImageUrls, referenceImageUrl]
  );
  const currentEditReferenceImageCount = useMemo(
    () =>
      Math.max(
        1,
        [referenceImageUrl, ...extraImageUrls].filter(
          (value): value is string => typeof value === "string" && value.trim().length > 0
        ).length
      ),
    [extraImageUrls, referenceImageUrl]
  );
  const buildEditPricingParams = useCallback(
    (resolutionOverride?: string | null): Omit<PricingParams, "modelId"> => ({
      aspect,
      ...(resolutionOverride ? { resolution: resolutionOverride } : {}),
      inputImageCount: currentEditReferenceImageCount,
      inputFidelity: "high",
      maskPresent: false,
    }),
    [aspect, currentEditReferenceImageCount]
  );
  const currentCreatePricingTarget = useMemo(
    () =>
      resolveCreatePricingTarget({
        modelId: model,
        aspect,
        resolution: pricingImageResolution,
        isCharacterModeEnabled: isCreateCharacterModeEnabled,
        userReferenceImageUrls: createReferenceImageUrls,
        characterModeInjectionBundle: createCharacterModeInjectionBundle,
        costParamsForModel,
      }),
    [
      aspect,
      createCharacterModeInjectionBundle,
      costParamsForModel,
      createReferenceImageUrls,
      isCreateCharacterModeEnabled,
      model,
      pricingImageResolution,
    ]
  );
  const currentCreatePricingLookup = useMemo(
    () =>
      currentCreatePricingTarget
        ? resolveCreateImageBilledCreditLookup({
            modelId: currentCreatePricingTarget.modelId,
            params: currentCreatePricingTarget.params,
            pricingPolicy,
          })
        : null,
    [currentCreatePricingTarget, pricingPolicy]
  );
  const currentEditPricingLookup = useMemo(
    () =>
      canUseCurrentEditPricingGrid && effectiveEditSubmitModelId
        ? resolveEditImageBilledCreditLookup({
            modelId: effectiveEditSubmitModelId,
            params: buildEditPricingParams(pricingImageResolution),
            pricingPolicy,
          })
        : null,
    [
      buildEditPricingParams,
      canUseCurrentEditPricingGrid,
      effectiveEditSubmitModelId,
      pricingImageResolution,
      pricingPolicy,
    ]
  );

  const estimatedTextTokens = useMemo(() => estimatePromptTokens(prompt), [prompt]);
  const estimatedDescribeTokens = useMemo(
    () => (prompt ? estimatePromptTokens(prompt) : estimateDescribeTokens()),
    [prompt]
  );

  const currentCost = useMemo(() => {
    if (isCreateWorkflowSelected) {
      if (mode === "image") {
        if (!currentCreatePricingTarget) return null;
        if (canUseStandardCreatePricingGrid) {
          return currentCreatePricingLookup?.breakdown ?? null;
        }
        return resolveClientPricingBreakdown({
          modelId: currentCreatePricingTarget.modelId,
          params: currentCreatePricingTarget.params,
          pricingPolicy,
          pricingPolicyReady: !isPricingPolicyUnavailable,
        });
      }
      if (mode === "video") {
        if (!model) return null;
        return resolveClientPricingBreakdown({
          modelId: model,
          params: costParamsForModel(model, { durationSeconds: getDefaultDurationSeconds(model) }),
          pricingPolicy,
          pricingPolicyReady: !isPricingPolicyUnavailable,
        });
      }
      if (mode === "text") {
        if (isDescribeMode) {
          return resolveClientPricingBreakdown({
            modelId: TEXT_PROMPT_MODEL_ID,
            params: estimatedDescribeTokens,
            pricingPolicy,
            pricingPolicyReady: !isPricingPolicyUnavailable,
          });
        }
        return resolveClientPricingBreakdown({
          modelId: TEXT_PROMPT_MODEL_ID,
          params: estimatedTextTokens,
          pricingPolicy,
          pricingPolicyReady: !isPricingPolicyUnavailable,
        });
      }
      return null;
    }

    if (isEditWorkflowSelected) {
      if (!effectiveEditSubmitModelId) return null;
      if (canUseCurrentEditPricingGrid) {
        return currentEditPricingLookup?.breakdown ?? null;
      }
      return resolveClientPricingBreakdown({
        modelId: effectiveEditSubmitModelId,
        params: costParamsForModel(
          effectiveEditSubmitModelId,
          pricingImageResolution ? { resolution: pricingImageResolution } : {}
        ),
        pricingPolicy,
        pricingPolicyReady: !isPricingPolicyUnavailable,
      });
    }

    if (isVideoTool) {
      if (!model) return null;
      return resolveClientPricingBreakdown({
        modelId: model,
        params: costParamsForModel(model, videoPricingParams),
        pricingPolicy,
        pricingPolicyReady: !isPricingPolicyUnavailable,
      });
    }

    return null;
  }, [
    estimatedDescribeTokens,
    estimatedTextTokens,
    canUseStandardCreatePricingGrid,
    currentCreatePricingTarget,
    isDescribeMode,
    costParamsForModel,
    getDefaultDurationSeconds,
    mode,
    model,
    effectiveEditSubmitModelId,
    canUseCurrentEditPricingGrid,
    isCreateWorkflowSelected,
    isEditWorkflowSelected,
    isVideoTool,
    currentCreatePricingLookup,
    currentEditPricingLookup,
    pricingPolicy,
    videoPricingParams,
    pricingImageResolution,
    isPricingPolicyUnavailable,
  ]);

  const currentCostCredits = currentCost?.credits ?? null;
  // Cost shown in the model picker (also used by agent-output generation affordances).
  const modelPickerCostCredits = useMemo(() => {
    if (!effectiveEditSubmitModelId) return null;
    if (canUseStandardCreatePricingGrid && isCreateWorkflowSelected) {
      const pricingTarget = resolveCreatePricingTarget({
        modelId: effectiveEditSubmitModelId,
        aspect,
        resolution: pricingImageResolution,
        isCharacterModeEnabled: isCreateCharacterModeEnabled,
        userReferenceImageUrls: createReferenceImageUrls,
        characterModeInjectionBundle: createCharacterModeInjectionBundle,
        costParamsForModel,
      });
      if (!pricingTarget) return null;
      return resolveCreateImageBilledCredits({
        modelId: pricingTarget.modelId,
        params: pricingTarget.params,
        pricingPolicy,
      });
    }
    if (canUseCurrentEditPricingGrid) {
      return resolveEditImageBilledCredits({
        modelId: effectiveEditSubmitModelId,
        params: buildEditPricingParams(pricingImageResolution),
        pricingPolicy,
      });
    }
    return resolveClientBilledCredits({
      modelId: effectiveEditSubmitModelId,
      params: costParamsForModel(
        effectiveEditSubmitModelId,
        isVideoTool
          ? videoPricingParams
          : isImageTool && pricingImageResolution
            ? { resolution: pricingImageResolution }
            : {}
      ),
      pricingPolicy,
      pricingPolicyReady: !isPricingPolicyUnavailable,
    });
  }, [
    aspect,
    buildEditPricingParams,
    canUseCurrentEditPricingGrid,
    canUseStandardCreatePricingGrid,
    createCharacterModeInjectionBundle,
    costParamsForModel,
    createReferenceImageUrls,
    effectiveEditSubmitModelId,
    isCreateCharacterModeEnabled,
    isCreateWorkflowSelected,
    isVideoTool,
    isImageTool,
    isPricingPolicyUnavailable,
    pricingPolicy,
    pricingImageResolution,
    videoPricingParams,
  ]);

  const resolveModelPickerCredits = useCallback(
    (modelIdForChip: string): number | null => {
      const candidatePricingImageResolution = normalizeImageResolutionForCanonicalBilledPricing(
        modelIdForChip,
        imageResolution
      );
      if (canUseStandardCreatePricingGrid && isCreateWorkflowSelected) {
        const pricingTarget = resolveCreatePricingTarget({
          modelId: modelIdForChip,
          aspect,
          resolution: candidatePricingImageResolution,
          isCharacterModeEnabled: isCreateCharacterModeEnabled,
          userReferenceImageUrls: createReferenceImageUrls,
          characterModeInjectionBundle: createCharacterModeInjectionBundle,
          costParamsForModel,
        });
        if (!pricingTarget) return null;
        return resolveCreateImageBilledCredits({
          modelId: pricingTarget.modelId,
          params: pricingTarget.params,
          pricingPolicy,
        });
      }
      if (
        canResolveStandardEditPricingGrid &&
        isEditWorkflowSelected &&
        supportsCanonicalEditImageBilledPricing(modelIdForChip)
      ) {
        return resolveEditImageBilledCredits({
          modelId: modelIdForChip,
          params: buildEditPricingParams(candidatePricingImageResolution),
          pricingPolicy,
        });
      }
      return resolveClientBilledCredits({
        modelId: modelIdForChip,
        params: costParamsForModel(
          modelIdForChip,
          isVideoTool
            ? videoPricingParams
            : isImageTool && candidatePricingImageResolution
              ? { resolution: candidatePricingImageResolution }
              : {}
        ),
        pricingPolicy,
        pricingPolicyReady: !isPricingPolicyUnavailable,
      });
    },
    [
      costParamsForModel,
      buildEditPricingParams,
      canResolveStandardEditPricingGrid,
      canUseStandardCreatePricingGrid,
      isCreateWorkflowSelected,
      isEditWorkflowSelected,
      isImageTool,
      isPricingPolicyUnavailable,
      isVideoTool,
      pricingPolicy,
      aspect,
      createCharacterModeInjectionBundle,
      createReferenceImageUrls,
      imageResolution,
      isCreateCharacterModeEnabled,
      videoPricingParams,
    ]
  );

  const promptGenerateCostCredits = useMemo(() => {
    if (!effectiveEditSubmitModelId || !isImageTool) return null;
    if (canUseStandardCreatePricingGrid && isCreateWorkflowSelected) {
      const pricingTarget = resolveCreatePricingTarget({
        modelId: effectiveEditSubmitModelId,
        aspect,
        resolution: pricingImageResolution,
        isCharacterModeEnabled: isCreateCharacterModeEnabled,
        userReferenceImageUrls: createReferenceImageUrls,
        characterModeInjectionBundle: createCharacterModeInjectionBundle,
        costParamsForModel,
      });
      if (!pricingTarget) return null;
      return resolveCreateImageBilledCredits({
        modelId: pricingTarget.modelId,
        params: pricingTarget.params,
        pricingPolicy,
      });
    }
    if (canUseCurrentEditPricingGrid && isEditWorkflowSelected) {
      return resolveEditImageBilledCredits({
        modelId: effectiveEditSubmitModelId,
        params: buildEditPricingParams(pricingImageResolution),
        pricingPolicy,
      });
    }
    return resolveClientBilledCredits({
      modelId: effectiveEditSubmitModelId,
      params: costParamsForModel(effectiveEditSubmitModelId, {
        aspect,
        ...(pricingImageResolution ? { resolution: pricingImageResolution } : {}),
      }),
      pricingPolicy,
      pricingPolicyReady: !isPricingPolicyUnavailable,
    });
  }, [
    aspect,
    buildEditPricingParams,
    canUseCurrentEditPricingGrid,
    createCharacterModeInjectionBundle,
    costParamsForModel,
    canUseStandardCreatePricingGrid,
    createReferenceImageUrls,
    effectiveEditSubmitModelId,
    isCreateCharacterModeEnabled,
    isCreateWorkflowSelected,
    isEditWorkflowSelected,
    isImageTool,
    isPricingPolicyUnavailable,
    pricingImageResolution,
    pricingPolicy,
  ]);
  const createTextImageGenerateCostCredits = useMemo(() => {
    if (!isCreateWorkflowSelected || mode !== "text" || !effectiveEditSubmitModelId) return null;
    if (canUseStandardCreatePricingGrid) {
      const pricingTarget = resolveCreatePricingTarget({
        modelId: effectiveEditSubmitModelId,
        aspect,
        resolution: pricingImageResolution,
        isCharacterModeEnabled: isCreateCharacterModeEnabled,
        userReferenceImageUrls: createReferenceImageUrls,
        characterModeInjectionBundle: createCharacterModeInjectionBundle,
        costParamsForModel,
      });
      if (!pricingTarget) return null;
      return resolveCreateImageBilledCredits({
        modelId: pricingTarget.modelId,
        params: pricingTarget.params,
        pricingPolicy,
      });
    }
    return resolveClientBilledCredits({
      modelId: effectiveEditSubmitModelId,
      params: costParamsForModel(effectiveEditSubmitModelId, {
        aspect,
        ...(pricingImageResolution ? { resolution: pricingImageResolution } : {}),
      }),
      pricingPolicy,
      pricingPolicyReady: !isPricingPolicyUnavailable,
    });
  }, [
    aspect,
    createCharacterModeInjectionBundle,
    costParamsForModel,
    canUseStandardCreatePricingGrid,
    createReferenceImageUrls,
    effectiveEditSubmitModelId,
    isCreateCharacterModeEnabled,
    isCreateWorkflowSelected,
    isPricingPolicyUnavailable,
    mode,
    pricingImageResolution,
    pricingPolicy,
  ]);
  const usesCanonicalCreatePromptPricing =
    canUseStandardCreatePricingGrid && isCreateWorkflowSelected && (isImageTool || mode === "text");
  const missingCanonicalCreatePricingAuthorityGuardrail = useMemo(() => {
    if (!isCreateWorkflowSelected || !isPricingPolicyUnavailable) return null;
    if (mode !== "image" && !(mode === "text" && !isDescribeMode)) return null;
    return "Unable to load pricing. Retry in a moment.";
  }, [isCreateWorkflowSelected, isDescribeMode, isPricingPolicyUnavailable, mode]);
  const promptReferenceGenerateCostCredits = usesCanonicalCreatePromptPricing
    ? ((isImageTool ? promptGenerateCostCredits : null) ??
      (mode === "text" ? createTextImageGenerateCostCredits : null) ??
      modelPickerCostCredits)
    : ((isImageTool ? promptGenerateCostCredits : null) ??
      (isCreateWorkflowSelected && mode === "text" ? createTextImageGenerateCostCredits : null) ??
      modelPickerCostCredits ??
      currentCostCredits);
  const missingCanonicalCreateBilledCreditsGuardrail = useMemo(() => {
    if (!canUseStandardCreatePricingGrid || !isCreateWorkflowSelected) return null;
    if (mode !== "image" && !(mode === "text" && !isDescribeMode)) return null;
    return promptReferenceGenerateCostCredits == null
      ? "Pricing is unavailable for this configuration. Retry in a moment."
      : null;
  }, [
    canUseStandardCreatePricingGrid,
    isCreateWorkflowSelected,
    isDescribeMode,
    mode,
    promptReferenceGenerateCostCredits,
  ]);
  const missingCanonicalEditPricingAuthorityGuardrail = useMemo(() => {
    if (!isEditWorkflowSelected || !isPricingPolicyUnavailable) return null;
    if (normalizedEditSubmitIntent !== "standard") return null;
    return supportsCanonicalEditImageBilledPricing(effectiveEditSubmitModelId)
      ? "Unable to load pricing. Retry in a moment."
      : null;
  }, [
    effectiveEditSubmitModelId,
    isEditWorkflowSelected,
    isPricingPolicyUnavailable,
    normalizedEditSubmitIntent,
  ]);
  const missingCanonicalEditBilledCreditsGuardrail = useMemo(() => {
    if (!canUseCurrentEditPricingGrid) return null;
    return currentCostCredits == null
      ? "Pricing is unavailable for this configuration. Retry in a moment."
      : null;
  }, [canUseCurrentEditPricingGrid, currentCostCredits]);
  const hasSufficientCreditsForPromptReferenceGenerate =
    balanceCredits == null || promptReferenceGenerateCostCredits == null
      ? true
      : balanceCredits >= promptReferenceGenerateCostCredits;

  const costedFlow =
    (isCreateWorkflowSelected && (mode === "image" || mode === "video")) ||
    isVideoTool ||
    isEditWorkflowSelected;
  const billableSubmitFlow =
    (isCreateWorkflowSelected &&
      (mode === "image" || mode === "video" || (mode === "text" && !isDescribeMode))) ||
    isVideoTool ||
    isEditWorkflowSelected;
  const creditStateBlocksGenerate = useMemo(() => {
    if (!billableSubmitFlow) return false;
    return balanceLoading || balanceError != null || balanceCredits == null;
  }, [balanceCredits, balanceError, balanceLoading, billableSubmitFlow]);

  const hasSufficientCreditsForCost =
    !costedFlow || balanceCredits == null || currentCostCredits == null
      ? true
      : balanceCredits >= currentCostCredits;
  const isCreditGuardrail = costedFlow && !hasSufficientCreditsForCost;
  const generationGuardrail = useMemo(() => {
    if (requiresModelSelection && !isModelSelected)
      return "Select a model before running a generation.";
    if (isEditWorkflowSelected) {
      if (!referenceImageUrl) return "Add a reference image before generating.";
    }
    if (isDescribeMode && !hasDescribeImage) return "Add or select an image to describe.";
    const isKeyframeCapableVeoModel = model === KIE_VEO_31_FAST_I2V_MODEL_ID;
    const hasBothVeoFrames = Boolean(referenceImageUrl && extraImageUrls[0]);
    if (
      isVideoTool &&
      resolvedVideoLane === "first-last" &&
      isKeyframeCapableVeoModel &&
      !hasBothVeoFrames
    ) {
      return "Add both first and last frame images before generating.";
    }
    if (isVideoTool && resolvedVideoLane === "motion") {
      if (motionReferenceVideoPending) {
        return "Motion clip is still uploading. Retry in a moment.";
      }
      if (motionReferenceVideoError) {
        return motionReferenceVideoError;
      }
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
      if (needsVideoUpload(motionReferenceVideoUrl)) {
        return "Motion clip is not ready yet. Re-add it and wait for upload before generating.";
      }
    }
    if (
      isVideoTool &&
      videoReferenceMode === "standard" &&
      model === KIE_KLING_30_MODEL_ID &&
      !referenceImageUrl
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
    if (missingCanonicalCreatePricingAuthorityGuardrail) {
      return missingCanonicalCreatePricingAuthorityGuardrail;
    }
    if (missingCanonicalCreateBilledCreditsGuardrail) {
      return missingCanonicalCreateBilledCreditsGuardrail;
    }
    if (missingCanonicalEditPricingAuthorityGuardrail) {
      return missingCanonicalEditPricingAuthorityGuardrail;
    }
    if (missingCanonicalEditBilledCreditsGuardrail) {
      return missingCanonicalEditBilledCreditsGuardrail;
    }
    if (isVideoTool && isSeedance2Model) {
      if (
        hasSeedance2LinkedAssetReferences &&
        (referenceImageUrl ||
          extraImageUrls[0] ||
          seedance2InputMode === "first-frame" ||
          seedance2InputMode === "first-last")
      ) {
        return "Remove first/last frame images before generating with Seedance 2.0 linked assets.";
      }
      if (seedance2InputMode === "multimodal") {
        if (!hasSeedance2MultimodalReferences && !hasSeedance2LinkedAssetReferences) {
          return "Add at least one image, video, or audio reference before generating with Seedance 2.0.";
        }
        if (referenceImageUrl || extraImageUrls[0]) {
          return "Remove first/last frame images before generating in Seedance 2.0 multimodal mode.";
        }
      }
      if (seedance2InputMode === "first-frame" && !referenceImageUrl) {
        return "Add a first frame image before generating with Seedance 2.0.";
      }
      if (seedance2InputMode === "first-last" && !(referenceImageUrl && extraImageUrls[0])) {
        return "Add both first and last frame images before generating with Seedance 2.0.";
      }
    }
    return null;
  }, [
    extraImageUrls,
    hasDescribeImage,
    hasSeedance2LinkedAssetReferences,
    hasSeedance2MultimodalReferences,
    isVideoTool,
    isDescribeMode,
    isModelSelected,
    model,
    motionReferenceVideoPending,
    motionReferenceVideoError,
    motionReferenceVideoUrl,
    referenceImageUrl,
    requiresModelSelection,
    klingMultiPrompts,
    klingWorkflowMode,
    isEditWorkflowSelected,
    isSeedance2Model,
    resolvedVideoLane,
    seedance2InputMode,
    videoReferenceMode,
    missingCanonicalCreatePricingAuthorityGuardrail,
    missingCanonicalCreateBilledCreditsGuardrail,
    missingCanonicalEditPricingAuthorityGuardrail,
    missingCanonicalEditBilledCreditsGuardrail,
  ]);

  const isGenerateDisabled = Boolean(generationGuardrail) || creditStateBlocksGenerate;
  const modelConfig = effectiveEditModelConfig ?? selectedModelConfig;

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
      if (model === KIE_KLING_30_MODEL_ID && videoReferenceMode === "standard" && !hasReference) {
        return "Kling 3.0 requires a first frame image in Standard mode.";
      }
      if (isSeedance2Model) {
        if (
          hasSeedance2LinkedAssetReferences &&
          (hasReference ||
            extraImageUrls[0] ||
            seedance2InputMode === "first-frame" ||
            seedance2InputMode === "first-last")
        ) {
          return "Seedance 2.0 linked assets cannot be combined with first/last frame images.";
        }
        if (seedance2InputMode === "multimodal") {
          if (!hasSeedance2MultimodalReferences && !hasSeedance2LinkedAssetReferences) {
            return "Seedance 2.0 multimodal mode requires at least one image, video, or audio reference.";
          }
          if (hasReference || extraImageUrls[0]) {
            return "Seedance 2.0 multimodal mode cannot be combined with first/last frame images.";
          }
        }
        if (seedance2InputMode === "first-frame" && !hasReference) {
          return "Seedance 2.0 requires a first frame image in first-frame mode.";
        }
        if (seedance2InputMode === "first-last" && !(hasReference && extraImageUrls[0])) {
          return "Seedance 2.0 requires both first and last frame images in first/last-frame mode.";
        }
      }
    }

    return null;
  }, [
    model,
    modelConfig,
    hasSeedance2LinkedAssetReferences,
    hasSeedance2MultimodalReferences,
    isEditWorkflowSelected,
    isSeedance2Model,
    referenceImageUrl,
    isVideoTool,
    resolvedVideoLane,
    seedance2InputMode,
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
