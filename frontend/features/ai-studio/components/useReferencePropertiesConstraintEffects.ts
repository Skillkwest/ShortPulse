/**
 * Constraint synchronization effects for reference properties panel model settings.
 */
import { useEffect } from "react";
import { normalizeDurationForModelConfig } from "../../../lib/model-runtime/modelDurationConstraints";
import type { ModelConfig } from "../logic/modelRegistry";

type ModelConstraintConfig = Pick<
  ModelConfig,
  | "allowedDurations"
  | "allowedResolutions"
  | "defaultDurationSeconds"
  | "defaultResolution"
  | "maxDurationSeconds"
  | "mediaType"
  | "minDurationSeconds"
> | null;

type UseReferencePropertiesConstraintEffectsArgs = {
  modelConfig: ModelConstraintConfig;
  videoDurationValue: number;
  onVideoDurationChange?: (value: number) => void;
  videoResolutionValue: string;
  onVideoResolutionChange?: (value: string) => void;
  isVideoVariant: boolean;
  imageResolution?: string;
  imageResolutionValue: string;
  onImageResolutionChange?: (value: string) => void;
};

/**
 * Applies model constraints to duration/resolution values while keeping callbacks centralized.
 */
export const useReferencePropertiesConstraintEffects = ({
  modelConfig,
  videoDurationValue,
  onVideoDurationChange,
  videoResolutionValue,
  onVideoResolutionChange,
  isVideoVariant,
  imageResolution,
  imageResolutionValue,
  onImageResolutionChange,
}: UseReferencePropertiesConstraintEffectsArgs) => {
  const modelSupportsVideoConstraints =
    modelConfig?.mediaType === "video" ||
    modelConfig?.mediaType === "image-to-video" ||
    modelConfig?.mediaType === "multi";
  const modelSupportsImageConstraints =
    modelConfig?.mediaType === "image" || modelConfig?.mediaType === "multi";

  useEffect(() => {
    if (isVideoVariant && !modelSupportsVideoConstraints) return;
    if (!modelConfig || !onVideoDurationChange) return;
    const normalizedDuration = normalizeDurationForModelConfig(videoDurationValue, modelConfig);
    if (normalizedDuration == null || normalizedDuration === videoDurationValue) return;
    onVideoDurationChange(normalizedDuration);
  }, [
    isVideoVariant,
    modelConfig,
    modelSupportsVideoConstraints,
    onVideoDurationChange,
    videoDurationValue,
  ]);

  useEffect(() => {
    if (isVideoVariant && !modelSupportsVideoConstraints) return;
    if (!modelConfig || !onVideoResolutionChange) return;
    if (modelConfig.allowedResolutions?.includes(videoResolutionValue)) return;
    if (!modelConfig.allowedResolutions?.length) return;

    const fallbackResolution = modelConfig.defaultResolution ?? modelConfig.allowedResolutions[0];
    if (fallbackResolution) {
      onVideoResolutionChange(fallbackResolution);
    }
  }, [
    isVideoVariant,
    modelConfig,
    modelSupportsVideoConstraints,
    onVideoResolutionChange,
    videoResolutionValue,
  ]);

  useEffect(() => {
    if (!isVideoVariant && !modelSupportsImageConstraints) return;
    if (isVideoVariant || !onImageResolutionChange) return;
    if (imageResolutionValue !== imageResolution) {
      onImageResolutionChange(imageResolutionValue);
    }
  }, [
    imageResolution,
    imageResolutionValue,
    isVideoVariant,
    modelSupportsImageConstraints,
    onImageResolutionChange,
  ]);
};
