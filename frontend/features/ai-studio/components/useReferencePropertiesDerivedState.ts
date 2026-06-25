/**
 * Derived state for reference properties panel rendering and model-aware option filtering.
 */
import { useMemo } from "react";
import type { AspectOption, VideoReferenceMode } from "../types";
import { getModelConfig } from "../logic/modelRegistry";
import { clampImageResolutionForModel, getImageResolutionOptions } from "../logic/imageResolution";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import { isElementSlotVisibleForVideoModel } from "../logic/klingElements";

type KlingMultiPrompt = {
  id: string;
  prompt: string;
  duration: number;
};

type KlingElement = {
  id: string;
  sourceKind?:
    | "element"
    | "character"
    | "reference-image"
    | "reference-video"
    | "reference-audio"
    | null;
  frontalImageUrl: string;
  referenceImageUrls: string;
  videoUrl: string;
  audioUrl?: string;
};

const VIDEO_DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const VIDEO_RESOLUTION_OPTIONS = [
  { value: "480p", label: "480p (SD)" },
  { value: "720p", label: "720p" },
  { value: "1080p", label: "1080p" },
  { value: "1k", label: "1K (1024px wide)" },
  { value: "2k", label: "2K (1440p)" },
  { value: "4k", label: "4K (2160p)" },
];

type UseReferencePropertiesDerivedStateArgs = {
  variant: "image" | "video";
  videoReferenceMode?: VideoReferenceMode;
  modelId: string | null;
  aspectOptions: AspectOption[];
  klingMultiPrompts: KlingMultiPrompt[];
  klingElements: KlingElement[];
  klingVoiceIds: [string, string];
  klingCfgScale: number;
  klingNegativePrompt: string;
  videoDurationSeconds?: number;
  videoResolution?: string;
  imageResolution?: string;
  videoGenerateAudio?: boolean;
};

/**
 * Computes panel-specific flags, labels, and option sets from raw props.
 */
export const useReferencePropertiesDerivedState = ({
  variant,
  videoReferenceMode,
  modelId,
  aspectOptions,
  klingMultiPrompts,
  klingElements,
  klingVoiceIds,
  klingCfgScale,
  klingNegativePrompt,
  videoDurationSeconds,
  videoResolution,
  imageResolution,
  videoGenerateAudio,
}: UseReferencePropertiesDerivedStateArgs) => {
  const isVideoVariant = variant === "video";
  const activeVideoMode = videoReferenceMode ?? "standard";
  const isKling3Mode =
    isVideoVariant && activeVideoMode === "kling3" && modelId === KIE_KLING_30_MODEL_ID;
  const isKeyframesMode = isVideoVariant && activeVideoMode === "keyframes";
  const isMotionMode = isVideoVariant && activeVideoMode === "motion";
  const isLipSyncMode = isVideoVariant && activeVideoMode === "lip-sync";
  const isStandardMode =
    !isVideoVariant || activeVideoMode === "standard" || activeVideoMode === "modify";

  const isVeoImageToVideoModel = modelId === KIE_VEO_31_FAST_I2V_MODEL_ID;
  const isVeoImageToVideoStandard = isStandardMode && isVeoImageToVideoModel;
  const isVeoFirstLastModel = isKeyframesMode && modelId === KIE_VEO_31_FAST_I2V_MODEL_ID;
  const isSeedance2FamilyModel =
    modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID;
  const isVeoModel =
    modelId?.includes("veo3.1") === true ||
    modelId?.includes("veo-3.1") === true ||
    modelId === KIE_VEO_31_FAST_I2V_MODEL_ID;
  const isKling3Model = modelId === KIE_KLING_30_MODEL_ID;
  const isKlingPatternMode =
    isVideoVariant &&
    !isMotionMode &&
    ((activeVideoMode === "kling3" && modelId === KIE_KLING_30_MODEL_ID) || isSeedance2FamilyModel);

  const referenceStepTitle = isVideoVariant
    ? isMotionMode
      ? "Add Motion Inputs"
      : isSeedance2FamilyModel
        ? "Add Frames"
        : isKlingPatternMode
          ? "Add Kling Frames"
          : isKeyframesMode
            ? "Add Reference Frames"
            : "Add Video Frame"
    : "Add Reference Images";
  const referenceStepSubtitle = isVideoVariant
    ? isMotionMode
      ? "Upload one character image and one motion video."
      : isSeedance2FamilyModel
        ? "Use Assets for linked characters, elements, or images; use Frames for start/end images."
        : isKlingPatternMode
          ? "Upload start/end frames, then add assets when needed."
          : isKeyframesMode
            ? "Upload or drag and drop images from the reference grid."
            : "Upload or drag and drop the first frame for standard image-to-video."
    : "Upload or drag and drop images from the reference grid.";

  const promptOrder = 3;
  const multiShotOrder = isVideoVariant && isKlingPatternMode ? 3 : undefined;
  const modelOrder = 3;
  const imageSettingsOrder = isVideoVariant ? 0 : 4;
  const referenceOrder = 2;
  const referenceBadge = "2";
  const promptBadge = "3";
  const modelBadge = "3";
  const imageSettingsBadge = "4";
  const videoSettingsOrder = isVideoVariant && !isMotionMode ? 1 : 0;
  const videoSettingsBadge = "1";
  const motionAudioOrder = isVideoVariant && isMotionMode ? 1 : 0;
  const motionAudioBadge = "1";
  const klingAdvancedOrder = isKlingPatternMode ? 5 : undefined;
  const klingAdvancedBadge = "5";
  const klingAssetsOrder = isKlingPatternMode ? 6 : undefined;
  const klingAssetsBadge = "6";
  const klingGuidanceOrder = isKlingPatternMode ? 7 : undefined;
  const klingGuidanceBadge = "7";
  const effectivePromptOrder = multiShotOrder != null ? 4 : promptOrder;
  const generateOrder = isVideoVariant
    ? isMotionMode
      ? 4
      : isKlingPatternMode
        ? 8
        : multiShotOrder != null
          ? 5
          : 4
    : 5;
  const generateBadge = isVideoVariant
    ? isMotionMode
      ? "4"
      : isKlingPatternMode
        ? "8"
        : multiShotOrder != null
          ? "5"
          : "4"
    : "4";

  const klingShotSummary = klingMultiPrompts.length
    ? `${klingMultiPrompts.length} shot${klingMultiPrompts.length > 1 ? "s" : ""}`
    : "No shots";
  const klingAssetsSummary = useMemo(() => {
    const elementCount = klingElements.filter((element) =>
      isElementSlotVisibleForVideoModel(element, {
        allowSeedanceImageReferences: isSeedance2FamilyModel,
      })
    ).length;
    const voices = klingVoiceIds.filter((value) => value.trim()).length;
    const parts = [];
    parts.push(
      elementCount ? `${elementCount} element${elementCount > 1 ? "s" : ""}` : "No elements"
    );
    if (modelId === KIE_KLING_30_MODEL_ID || isSeedance2FamilyModel) {
      parts.push("Prompt links ready");
    } else {
      parts.push(voices ? `${voices} voice${voices > 1 ? "s" : ""}` : "No voices");
    }
    return parts.join(" · ");
  }, [isSeedance2FamilyModel, klingElements, klingVoiceIds, modelId]);
  const klingGuidanceSummary = isSeedance2FamilyModel
    ? "Storyboard + assets"
    : `CFG ${klingCfgScale.toFixed(2)} · ${klingNegativePrompt ? "Neg prompt set" : "Neg prompt empty"}`;

  const videoDurationValue = videoDurationSeconds ?? 6;
  const videoResolutionValue = videoResolution ?? "1080p";
  const imageResolutionValue = useMemo(
    () => clampImageResolutionForModel(modelId, imageResolution),
    [imageResolution, modelId]
  );
  const imageResolutionOptions = useMemo(() => getImageResolutionOptions(modelId), [modelId]);
  const videoGenerateAudioValue = Boolean(videoGenerateAudio);

  const modelConfig = useMemo(() => (modelId ? getModelConfig(modelId) : null), [modelId]);

  const durationOptions = useMemo(() => {
    if (!modelConfig?.allowedDurations) {
      return VIDEO_DURATION_OPTIONS;
    }
    return modelConfig.allowedDurations;
  }, [modelConfig]);

  const resolutionOptions = useMemo(() => {
    if (!modelConfig?.allowedResolutions?.length) {
      return isVideoVariant
        ? VIDEO_RESOLUTION_OPTIONS.filter(
            (option) => option.value === "720p" || option.value === "1080p"
          )
        : [];
    }

    return VIDEO_RESOLUTION_OPTIONS.filter((option) =>
      modelConfig.allowedResolutions?.includes(option.value)
    );
  }, [isVideoVariant, modelConfig]);

  const aspectOptionsForModel = useMemo(() => {
    if (!modelConfig) return aspectOptions;
    if (modelConfig.allowedAspects?.length) {
      return aspectOptions.filter((option) => modelConfig.allowedAspects?.includes(option.value));
    }
    return aspectOptions;
  }, [aspectOptions, modelConfig]);

  return {
    isVideoVariant,
    activeVideoMode,
    isKling3Mode,
    isKlingPatternMode,
    isKeyframesMode,
    isMotionMode,
    isLipSyncMode,
    isStandardMode,
    isSeedance2FamilyModel,
    isVeoImageToVideoStandard,
    isVeoFirstLastModel,
    isVeoModel,
    isKling3Model,
    referenceStepTitle,
    referenceStepSubtitle,
    promptOrder: effectivePromptOrder,
    multiShotOrder,
    modelOrder,
    imageSettingsOrder,
    referenceOrder,
    referenceBadge,
    promptBadge,
    modelBadge,
    imageSettingsBadge,
    videoSettingsOrder,
    videoSettingsBadge,
    motionAudioOrder,
    motionAudioBadge,
    klingAdvancedOrder,
    klingAdvancedBadge,
    klingAssetsOrder,
    klingAssetsBadge,
    klingGuidanceOrder,
    klingGuidanceBadge,
    generateOrder,
    generateBadge,
    klingShotSummary,
    klingAssetsSummary,
    klingGuidanceSummary,
    videoDurationValue,
    videoResolutionValue,
    imageResolutionValue,
    imageResolutionOptions,
    videoGenerateAudioValue,
    modelConfig,
    durationOptions,
    resolutionOptions,
    aspectOptionsForModel,
  };
};
