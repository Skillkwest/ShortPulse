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
import {
  resolveVideoBilledCreditLookup,
  resolveVideoBilledCredits,
  supportsCanonicalVideoBilledPricing,
} from "../../../lib/model-runtime/videoBilledCredits";
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
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../../lib/model-runtime/falModelIds";
import { normalizeDurationForModel } from "../../../lib/model-runtime/modelDurationConstraints";
import { needsVideoUpload } from "../utils/videoUpload";
import {
  resolveKieKlingElementsValidationMessage,
  resolveSeedanceElementProviderEligibility,
  type AiStudioKlingElement,
} from "../logic/klingElements";
import {
  resolveAutoVideoModelForLane,
  resolveVideoGenerationLaneFromFrameInputs,
} from "../logic/referenceInputs";
import {
  resolveEffectiveEditSubmitModelId,
  normalizeEditSubmitIntent,
  type EditSubmitIntent,
} from "../logic/editSubmitIntent";
import { resolveCreatePricingTarget } from "../logic/createPricingTarget";
import { isCreateWorkflow, isEditWorkflow, isVideoWorkflow } from "../logic/workflowIdentity";
import { analyzeExpertEditPromptTokens } from "../logic/expertEditPromptReferences";
import { resolveLipSyncAudioDurationGuardrail } from "../logic/lipSyncDuration";
import {
  createEmptyLipSyncAudioState,
  isLipSyncAudioReadyForSubmit,
} from "../logic/lipSyncAudioState";
import type { CharacterModeInjectionBundle } from "./useAiStudioCharacterModeController";
import type {
  LipSyncAudioState,
  StudioMode,
  StudioOutput,
  ToolId,
  VideoReferenceMode,
} from "../types";

const TEXT_PROMPT_MODEL_ID = resolveRequiredAiStudioTextPromptModelId();

const resolveLipSyncPricingDurationSeconds = ({
  audioDurationMs,
  fallbackDurationSeconds,
}: {
  audioDurationMs?: number | null;
  fallbackDurationSeconds: number;
}): number => {
  const audioDurationSeconds =
    typeof audioDurationMs === "number" && Number.isFinite(audioDurationMs) && audioDurationMs > 0
      ? audioDurationMs / 1000
      : null;
  const rawDurationSeconds = audioDurationSeconds ?? fallbackDurationSeconds;
  return (
    normalizeDurationForModel(rawDurationSeconds, FAL_OMNIHUMAN_V15_MODEL_ID) ?? rawDurationSeconds
  );
};

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
  videoReferenceMode: VideoReferenceMode;
  lipSyncAudio?: LipSyncAudioState;
  motionReferenceVideoPending?: boolean;
  motionReferenceVideoError?: string | null;
  motionReferenceVideoUrl: string | null;
  extraImageUrls: readonly (string | null)[];
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
  lipSyncAudio = createEmptyLipSyncAudioState(),
  motionReferenceVideoPending = false,
  motionReferenceVideoError = null,
  motionReferenceVideoUrl,
  extraImageUrls,
  imageResolution,
  videoGenerateAudio,
  klingWorkflowMode = "single",
  klingMultiPrompts = [],
  klingElements = [],
  seedance2InputMode = "multimodal",
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
  const effectiveVideoPricingModelId = useMemo(
    () =>
      isVideoTool
        ? resolveAutoVideoModelForLane({
            currentModel: model,
            lane: resolvedVideoLane,
          })
        : null,
    [isVideoTool, model, resolvedVideoLane]
  );
  const pricingImageResolution = useMemo(
    () => normalizeImageResolutionForCanonicalBilledPricing(model, imageResolution),
    [imageResolution, model]
  );
  const isSeedance2Model =
    model === KIE_SEEDANCE_2_MODEL_ID || model === KIE_SEEDANCE_2_FAST_MODEL_ID;
  const isSeedance2PricingModel =
    effectiveVideoPricingModelId === KIE_SEEDANCE_2_MODEL_ID ||
    effectiveVideoPricingModelId === KIE_SEEDANCE_2_FAST_MODEL_ID;
  const hasSeedance2MultimodalReferences =
    seedance2ReferenceImageUrls.length > 0 ||
    seedance2ReferenceVideoUrls.length > 0 ||
    seedance2ReferenceAudioUrls.length > 0;
  const seedanceLinkedElementEligibilities = useMemo(
    () => klingElements.map((element) => resolveSeedanceElementProviderEligibility(element)),
    [klingElements]
  );
  const seedance2VideoInputCount = useMemo(
    () =>
      seedance2ReferenceVideoUrls.filter((value) => value.trim().length > 0).length +
      seedanceLinkedElementEligibilities.reduce(
        (count, eligibility) => count + eligibility.videoUrls.length,
        0
      ),
    [seedance2ReferenceVideoUrls, seedanceLinkedElementEligibilities]
  );
  const hasSeedance2LinkedAssetReferences = seedanceLinkedElementEligibilities.some(
    (eligibility) => eligibility.isSubmittable
  );
  const videoPricingResolution = useMemo(() => {
    if (!effectiveVideoPricingModelId) return videoResolution;
    const config = getModelConfig(effectiveVideoPricingModelId);
    const allowedResolutions = config?.allowedResolutions ?? [];
    if (!allowedResolutions.length || allowedResolutions.includes(videoResolution)) {
      return videoResolution;
    }
    return config?.defaultResolution ?? allowedResolutions[0] ?? videoResolution;
  }, [effectiveVideoPricingModelId, videoResolution]);
  const klingElementProviderGuardrail = useMemo(
    () =>
      isVideoTool &&
      (videoReferenceMode === "standard" || videoReferenceMode === "motion") &&
      model === KIE_KLING_30_MODEL_ID
        ? resolveKieKlingElementsValidationMessage(klingElements)
        : null,
    [isVideoTool, klingElements, model, videoReferenceMode]
  );
  const seedance2UsesMultimodalReferences =
    seedance2InputMode === "multimodal" || hasSeedance2LinkedAssetReferences;
  const videoPricingParams = useMemo(
    () => ({
      durationSeconds:
        resolvedVideoLane === "lip-sync"
          ? resolveLipSyncPricingDurationSeconds({
              audioDurationMs: lipSyncAudio.durationMs,
              fallbackDurationSeconds: videoDurationSeconds,
            })
          : videoDurationSeconds,
      resolution: videoPricingResolution,
      audio: resolvedVideoLane === "lip-sync" ? true : videoGenerateAudio,
      ...(isSeedance2PricingModel ? { inputVideoCount: seedance2VideoInputCount } : {}),
    }),
    [
      isSeedance2PricingModel,
      lipSyncAudio.durationMs,
      resolvedVideoLane,
      seedance2VideoInputCount,
      videoDurationSeconds,
      videoGenerateAudio,
      videoPricingResolution,
    ]
  );
  const requiresResolvedPricingPolicy =
    isVideoTool || isEditWorkflowSelected || isCreateWorkflowSelected;
  const isPricingPolicyUnavailable = requiresResolvedPricingPolicy && !pricingPolicyReady;
  const canUseStandardCreatePricingGrid =
    isCreateWorkflowSelected && Boolean(model) && !isPricingPolicyUnavailable;
  const canResolveStandardEditPricingGrid = isEditWorkflowSelected && !isPricingPolicyUnavailable;
  const canResolveVideoPricingGrid = isVideoTool && !isPricingPolicyUnavailable;
  const canUseCurrentEditPricingGrid =
    canResolveStandardEditPricingGrid &&
    normalizedEditSubmitIntent === "standard" &&
    supportsCanonicalEditImageBilledPricing(effectiveEditSubmitModelId);
  const createReferenceImageUrls = useMemo(
    () => [referenceImageUrl, ...extraImageUrls],
    [extraImageUrls, referenceImageUrl]
  );
  const currentEditReferenceImageCount = useMemo(() => {
    const populatedSecondaryCount = extraImageUrls.filter(
      (value): value is string => typeof value === "string" && value.trim().length > 0
    ).length;
    const tokenAnalysis = analyzeExpertEditPromptTokens(prompt, extraImageUrls);
    const referencedSecondaryCount =
      !tokenAnalysis.hasInvalidTokens && tokenAnalysis.referencedSlotIndexes.length > 0
        ? tokenAnalysis.referencedSlotIndexes.filter((slotIndex) =>
            Boolean(extraImageUrls[slotIndex]?.trim())
          ).length
        : populatedSecondaryCount;
    const primaryCount = referenceImageUrl?.trim() ? 1 : 0;
    return Math.max(1, primaryCount + referencedSecondaryCount);
  }, [extraImageUrls, prompt, referenceImageUrl]);
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
  const currentVideoPricingLookup = useMemo(
    () =>
      canResolveVideoPricingGrid && effectiveVideoPricingModelId
        ? resolveVideoBilledCreditLookup({
            modelId: effectiveVideoPricingModelId,
            params: costParamsForModel(effectiveVideoPricingModelId, videoPricingParams),
            pricingPolicy,
          })
        : null,
    [
      canResolveVideoPricingGrid,
      costParamsForModel,
      effectiveVideoPricingModelId,
      pricingPolicy,
      videoPricingParams,
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
        if (isPricingPolicyUnavailable) return null;
        return resolveVideoBilledCreditLookup({
          modelId: model,
          params: costParamsForModel(model, { durationSeconds: getDefaultDurationSeconds(model) }),
          pricingPolicy,
        }).breakdown;
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
      if (!effectiveVideoPricingModelId) return null;
      return currentVideoPricingLookup?.breakdown ?? null;
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
    effectiveVideoPricingModelId,
    effectiveEditSubmitModelId,
    canUseCurrentEditPricingGrid,
    isCreateWorkflowSelected,
    isEditWorkflowSelected,
    isVideoTool,
    currentCreatePricingLookup,
    currentEditPricingLookup,
    currentVideoPricingLookup,
    pricingPolicy,
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
    if (isVideoTool) {
      const pricingModelId = effectiveVideoPricingModelId ?? effectiveEditSubmitModelId;
      if (!pricingModelId || isPricingPolicyUnavailable) return null;
      return resolveVideoBilledCredits({
        modelId: pricingModelId,
        params: costParamsForModel(pricingModelId, videoPricingParams),
        pricingPolicy,
      });
    }
    return resolveClientBilledCredits({
      modelId: isVideoTool
        ? (effectiveVideoPricingModelId ?? effectiveEditSubmitModelId)
        : effectiveEditSubmitModelId,
      params: costParamsForModel(
        isVideoTool
          ? (effectiveVideoPricingModelId ?? effectiveEditSubmitModelId)
          : effectiveEditSubmitModelId,
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
    effectiveVideoPricingModelId,
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
      if (isVideoTool) {
        const pricingModelId = resolveAutoVideoModelForLane({
          currentModel: modelIdForChip,
          lane: resolvedVideoLane,
        });
        if (!pricingModelId || isPricingPolicyUnavailable) return null;
        return resolveVideoBilledCredits({
          modelId: pricingModelId,
          params: costParamsForModel(pricingModelId, videoPricingParams),
          pricingPolicy,
        });
      }
      return resolveClientBilledCredits({
        modelId: modelIdForChip,
        params: costParamsForModel(
          modelIdForChip,
          isImageTool && candidatePricingImageResolution
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
      resolvedVideoLane,
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
  const missingCanonicalVideoPricingAuthorityGuardrail = useMemo(() => {
    if (!isVideoTool || !isPricingPolicyUnavailable) return null;
    return supportsCanonicalVideoBilledPricing(effectiveVideoPricingModelId)
      ? "Unable to load pricing. Retry in a moment."
      : null;
  }, [effectiveVideoPricingModelId, isPricingPolicyUnavailable, isVideoTool]);
  const missingCanonicalVideoBilledCreditsGuardrail = useMemo(() => {
    if (!canResolveVideoPricingGrid) return null;
    return supportsCanonicalVideoBilledPricing(effectiveVideoPricingModelId) &&
      currentCostCredits == null
      ? "Pricing is unavailable for this configuration. Retry in a moment."
      : null;
  }, [canResolveVideoPricingGrid, currentCostCredits, effectiveVideoPricingModelId]);
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
    if (isVideoTool && resolvedVideoLane === "lip-sync") {
      const hasCharacterReference = Boolean(referenceImageUrl);
      const hasVoiceAudio = isLipSyncAudioReadyForSubmit(lipSyncAudio) || Boolean(lipSyncAudio.url);
      const hasPreviewOrError =
        Boolean(lipSyncAudio.previewUrl) || lipSyncAudio.status === "failed";
      if (!hasCharacterReference && !hasVoiceAudio) {
        return "Add a character reference and voice audio before generating Lip Sync.";
      }
      if (!hasCharacterReference) {
        return "Add a character reference before generating Lip Sync.";
      }
      if (!hasVoiceAudio && !hasPreviewOrError) {
        return "Add voice audio before generating Lip Sync.";
      }
      if (lipSyncAudio.status === "uploading") {
        return "Voice audio is still uploading. Wait for it to finish before generating Lip Sync.";
      }
      if (lipSyncAudio.status === "failed") {
        return (
          lipSyncAudio.error ?? "Voice audio upload failed. Re-add the audio file and try again."
        );
      }
      if (!isLipSyncAudioReadyForSubmit(lipSyncAudio)) {
        return "Voice audio is not ready. Re-add it and wait for upload before generating Lip Sync.";
      }
      const lipSyncDurationGuardrail = resolveLipSyncAudioDurationGuardrail({
        durationMs: lipSyncAudio.durationMs,
        resolution: videoResolution,
      });
      if (lipSyncDurationGuardrail) return lipSyncDurationGuardrail;
    }
    if (
      isVideoTool &&
      videoReferenceMode === "standard" &&
      model === KIE_KLING_30_MODEL_ID &&
      !referenceImageUrl
    ) {
      return "Add a first frame image before generating with Kling 3.0.";
    }
    if (klingElementProviderGuardrail) {
      return klingElementProviderGuardrail;
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
    if (isVideoTool && isSeedance2Model) {
      if (seedance2UsesMultimodalReferences) {
        if (!hasSeedance2MultimodalReferences && !hasSeedance2LinkedAssetReferences) {
          return "Add at least one image, video, or audio reference before generating with Seedance 2.0.";
        }
      }
      if (
        !seedance2UsesMultimodalReferences &&
        seedance2InputMode === "first-frame" &&
        !referenceImageUrl
      ) {
        return "Add a first frame image before generating with Seedance 2.0.";
      }
      if (
        !seedance2UsesMultimodalReferences &&
        seedance2InputMode === "first-last" &&
        !(referenceImageUrl && extraImageUrls[0])
      ) {
        return "Add both first and last frame images before generating with Seedance 2.0.";
      }
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
    if (missingCanonicalVideoPricingAuthorityGuardrail) {
      return missingCanonicalVideoPricingAuthorityGuardrail;
    }
    if (missingCanonicalVideoBilledCreditsGuardrail) {
      return missingCanonicalVideoBilledCreditsGuardrail;
    }
    return null;
  }, [
    extraImageUrls,
    hasDescribeImage,
    hasSeedance2LinkedAssetReferences,
    hasSeedance2MultimodalReferences,
    klingElementProviderGuardrail,
    seedance2UsesMultimodalReferences,
    isVideoTool,
    isDescribeMode,
    isModelSelected,
    model,
    motionReferenceVideoPending,
    motionReferenceVideoError,
    motionReferenceVideoUrl,
    lipSyncAudio,
    referenceImageUrl,
    requiresModelSelection,
    klingMultiPrompts,
    klingWorkflowMode,
    isEditWorkflowSelected,
    isSeedance2Model,
    resolvedVideoLane,
    seedance2InputMode,
    videoResolution,
    videoReferenceMode,
    missingCanonicalCreatePricingAuthorityGuardrail,
    missingCanonicalCreateBilledCreditsGuardrail,
    missingCanonicalEditPricingAuthorityGuardrail,
    missingCanonicalEditBilledCreditsGuardrail,
    missingCanonicalVideoPricingAuthorityGuardrail,
    missingCanonicalVideoBilledCreditsGuardrail,
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
        if (seedance2UsesMultimodalReferences) {
          if (!hasSeedance2MultimodalReferences && !hasSeedance2LinkedAssetReferences) {
            return "Seedance 2.0 multimodal mode requires at least one image, video, or audio reference.";
          }
        }
        if (
          !seedance2UsesMultimodalReferences &&
          seedance2InputMode === "first-frame" &&
          !hasReference
        ) {
          return "Seedance 2.0 requires a first frame image in first-frame mode.";
        }
        if (
          !seedance2UsesMultimodalReferences &&
          seedance2InputMode === "first-last" &&
          !(hasReference && extraImageUrls[0])
        ) {
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
    seedance2UsesMultimodalReferences,
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
