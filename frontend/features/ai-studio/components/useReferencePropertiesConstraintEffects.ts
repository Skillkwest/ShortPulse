/**
 * Constraint synchronization effects for reference properties panel model settings.
 */
import { useEffect } from "react";

type ModelConstraintConfig = {
  allowedDurations?: number[];
  allowedResolutions?: string[];
  defaultResolution?: string;
} | null;

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
  useEffect(() => {
    if (!modelConfig || !onVideoDurationChange) return;
    if (modelConfig.allowedDurations?.includes(videoDurationValue)) return;
    if (!modelConfig.allowedDurations?.length) return;

    const closestDuration = modelConfig.allowedDurations.reduce((previous, current) =>
      Math.abs(current - videoDurationValue) < Math.abs(previous - videoDurationValue)
        ? current
        : previous
    );
    onVideoDurationChange(closestDuration);
  }, [modelConfig, onVideoDurationChange, videoDurationValue]);

  useEffect(() => {
    if (!modelConfig || !onVideoResolutionChange) return;
    if (modelConfig.allowedResolutions?.includes(videoResolutionValue)) return;
    if (!modelConfig.allowedResolutions?.length) return;

    const fallbackResolution = modelConfig.defaultResolution ?? modelConfig.allowedResolutions[0];
    if (fallbackResolution) {
      onVideoResolutionChange(fallbackResolution);
    }
  }, [modelConfig, onVideoResolutionChange, videoResolutionValue]);

  useEffect(() => {
    if (isVideoVariant || !onImageResolutionChange) return;
    if (imageResolutionValue !== imageResolution) {
      onImageResolutionChange(imageResolutionValue);
    }
  }, [imageResolution, imageResolutionValue, isVideoVariant, onImageResolutionChange]);
};
