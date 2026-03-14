/**
 * Derived state for reference properties panel rendering and model-aware option filtering.
 */
import { useMemo } from "react";
import type { AspectOption } from "../types";
import { getModelConfig } from "../logic/modelRegistry";
import { clampImageResolutionForModel, getImageResolutionOptions } from "../logic/imageResolution";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";

type VideoReferenceMode = "standard" | "keyframes" | "kling3" | "motion";

type KlingMultiPrompt = {
  id: string;
  prompt: string;
  duration: number;
};

type KlingElement = {
  id: string;
  frontalImageUrl: string;
  referenceImageUrls: string;
  videoUrl: string;
};

const VIDEO_DURATION_OPTIONS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const VIDEO_RESOLUTION_OPTIONS = [
  { value: "480p", label: "480p (SD)" },
  { value: "720p", label: "720p (HD)" },
  { value: "1080p", label: "1080p (Full HD)" },
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
  const isKling3Mode = isVideoVariant && activeVideoMode === "kling3";
  const isKeyframesMode = isVideoVariant && activeVideoMode === "keyframes";
  const isMotionMode = isVideoVariant && activeVideoMode === "motion";
  const isStandardMode = !isVideoVariant || activeVideoMode === "standard";

  const isVeoImageToVideoModel =
    modelId === "fal-ai/veo3.1/image-to-video" || modelId === KIE_VEO_31_FAST_I2V_MODEL_ID;
  const isVeoImageToVideoStandard = isStandardMode && isVeoImageToVideoModel;
  const isVeoFirstLastModel = modelId === "fal-ai/veo3.1/first-last-frame-to-video";
  const isSeedanceI2VModel = modelId === "fal-ai/bytedance/seedance/v1.5/pro/image-to-video";
  const isVeoModel =
    modelId?.includes("veo3.1") === true ||
    modelId?.includes("veo-3.1") === true ||
    modelId === KIE_VEO_31_FAST_I2V_MODEL_ID;
  const isKling3Model =
    modelId?.includes("kling-video/v3/pro") === true || modelId === KIE_KLING_30_MODEL_ID;

  const referenceStepTitle = isVideoVariant
    ? isKling3Mode
      ? "Add Kling 3.0 References"
      : isKeyframesMode
        ? "Add Reference Frames"
        : isMotionMode
          ? "Add Motion References"
          : "Add Reference Image"
    : "Add Reference Images";
  const referenceStepSubtitle = isVideoVariant
    ? isKling3Mode
      ? "Upload start/end frames plus Kling controls."
      : isKeyframesMode
        ? "Upload or drag and drop images from the reference grid."
        : isMotionMode
          ? "Upload a character image and motion reference video."
          : "Upload or drag and drop a single image for standard image-to-video."
    : "Upload or drag and drop images from the reference grid.";

  const promptOrder = 2;
  const modelOrder = 3;
  const imageSettingsOrder = isVideoVariant ? 0 : 4;
  const referenceOrder = 1;
  const referenceBadge = "1";
  const promptBadge = "2";
  const modelBadge = "3";
  const imageSettingsBadge = "4";
  const videoSettingsOrder = isVideoVariant && !isMotionMode ? 4 : 0;
  const videoSettingsBadge = "4";
  const motionAudioOrder = isVideoVariant && isMotionMode ? 3 : 0;
  const motionAudioBadge = "3";
  const klingAdvancedOrder = isKling3Mode ? 5 : undefined;
  const klingAdvancedBadge = "5";
  const klingAssetsOrder = isKling3Mode ? 6 : undefined;
  const klingAssetsBadge = "6";
  const klingGuidanceOrder = isKling3Mode ? 7 : undefined;
  const klingGuidanceBadge = "7";
  const generateOrder = isVideoVariant ? (isMotionMode ? 4 : isKling3Mode ? 8 : 5) : 5;
  const generateBadge = isVideoVariant ? (isMotionMode ? "4" : isKling3Mode ? "8" : "5") : "4";

  const klingShotSummary = klingMultiPrompts.length
    ? `${klingMultiPrompts.length} shot${klingMultiPrompts.length > 1 ? "s" : ""}`
    : "No shots";
  const klingAssetsSummary = useMemo(() => {
    const elementCount = klingElements.length;
    const voices = klingVoiceIds.filter((value) => value.trim()).length;
    const parts = [];
    parts.push(
      elementCount ? `${elementCount} element${elementCount > 1 ? "s" : ""}` : "No elements"
    );
    parts.push(voices ? `${voices} voice${voices > 1 ? "s" : ""}` : "No voices");
    return parts.join(" · ");
  }, [klingElements, klingVoiceIds]);
  const klingGuidanceSummary = `CFG ${klingCfgScale.toFixed(2)} · ${klingNegativePrompt ? "Neg prompt set" : "Neg prompt empty"}`;

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
      return [];
    }

    return VIDEO_RESOLUTION_OPTIONS.filter((option) =>
      modelConfig.allowedResolutions?.includes(option.value)
    );
  }, [modelConfig]);

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
    isKeyframesMode,
    isMotionMode,
    isStandardMode,
    isVeoImageToVideoStandard,
    isVeoFirstLastModel,
    isSeedanceI2VModel,
    isVeoModel,
    isKling3Model,
    referenceStepTitle,
    referenceStepSubtitle,
    promptOrder,
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
