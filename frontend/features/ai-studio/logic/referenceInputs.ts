/**
 * Reference input ordering helpers shared by generate/regenerate flows.
 */
import { KIE_VEO_31_FAST_I2V_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";
import type { ToolId } from "../types";

type VideoReferenceMode = "standard" | "modify" | "keyframes" | "kling3" | "motion";
export type ResolvedVideoGenerationLane = "text" | "single-image" | "first-last" | "motion";

const FAL_VEO_TEXT_MODEL_ID = "fal-ai/veo3.1";
const FAL_VEO_IMAGE_MODEL_ID = "fal-ai/veo3.1/image-to-video";
const FAL_VEO_FIRST_LAST_MODEL_ID = "fal-ai/veo3.1/first-last-frame-to-video";

const isImageTool = (tool: ToolId | null): boolean => tool === "image" || tool === "edit";
const isVideoTool = (tool: ToolId | null): boolean => tool === "video" || tool === "kling";

const collectOrderedDistinctVideoFrameInputs = (
  primary: string | null,
  extras: (string | null)[]
): string[] => {
  const ordered = [primary, ...extras].filter((url): url is string => Boolean(url));
  return Array.from(new Set(ordered));
};

export const resolveVideoGenerationLaneFromFrameInputs = ({
  primary,
  extras,
  referenceMode,
}: {
  primary: string | null;
  extras: (string | null)[];
  referenceMode: VideoReferenceMode;
}): ResolvedVideoGenerationLane => {
  if (referenceMode === "motion") return "motion";
  const frameInputs = collectOrderedDistinctVideoFrameInputs(primary, extras);
  if (frameInputs.length >= 2) return "first-last";
  if (frameInputs.length === 1) return "single-image";
  return "text";
};

export const resolveVideoGenerationLaneFromInputs = ({
  imageInputs,
  referenceMode,
}: {
  imageInputs: string[];
  referenceMode: VideoReferenceMode;
}): ResolvedVideoGenerationLane => {
  if (referenceMode === "motion") return "motion";
  if (imageInputs.length >= 2) return "first-last";
  if (imageInputs.length === 1) return "single-image";
  return "text";
};

const isTextCompatibleVideoModel = (modelId: string | null | undefined): boolean =>
  modelId === FAL_VEO_TEXT_MODEL_ID ||
  modelId === "fal-ai/kling-video/v3/pro/text-to-video" ||
  modelId === "fal-ai/bytedance/seedance/v1.5/pro/text-to-video" ||
  modelId === "fal-ai/sora-2/text-to-video/pro" ||
  modelId === KIE_VEO_31_FAST_I2V_MODEL_ID;

const isSingleImageCompatibleVideoModel = (modelId: string | null | undefined): boolean =>
  modelId === FAL_VEO_IMAGE_MODEL_ID ||
  modelId === "fal-ai/kling-video/v3/pro/image-to-video" ||
  modelId === "fal-ai/bytedance/seedance/v1.5/pro/image-to-video" ||
  modelId === "kie-ai/kling-3.0" ||
  modelId === KIE_VEO_31_FAST_I2V_MODEL_ID;

const isFirstLastCompatibleVideoModel = (modelId: string | null | undefined): boolean =>
  modelId === FAL_VEO_FIRST_LAST_MODEL_ID || modelId === KIE_VEO_31_FAST_I2V_MODEL_ID;

export const resolveAutoVideoModelForLane = ({
  currentModel,
  lane,
}: {
  currentModel: string | null;
  lane: ResolvedVideoGenerationLane;
}): string | null => {
  if (lane === "motion") {
    return currentModel;
  }

  if (lane === "text") {
    if (isTextCompatibleVideoModel(currentModel)) return currentModel;
    return FAL_VEO_TEXT_MODEL_ID;
  }

  if (lane === "single-image") {
    if (isSingleImageCompatibleVideoModel(currentModel)) return currentModel;
    return FAL_VEO_IMAGE_MODEL_ID;
  }

  if (isFirstLastCompatibleVideoModel(currentModel)) return currentModel;
  return FAL_VEO_FIRST_LAST_MODEL_ID;
};

/**
 * Builds ordered image references (primary first, then non-duplicate extras).
 */
export const buildImageReferenceInputs = (
  primary: string | null,
  extras: (string | null)[]
): string[] => {
  const orderedExtras = extras.filter((url): url is string => Boolean(url && url !== primary));
  if (primary) {
    return [primary, ...orderedExtras];
  }
  return orderedExtras;
};

/**
 * Builds ordered video references based on mode constraints.
 */
export const buildVideoReferenceInputs = (
  primary: string | null,
  extras: (string | null)[],
  referenceMode: VideoReferenceMode,
  modelId?: string | null
): string[] => {
  if (referenceMode === "motion") {
    return primary ? [primary] : [];
  }
  const orderedFrames = collectOrderedDistinctVideoFrameInputs(primary, extras);
  const resolvedLane = resolveVideoGenerationLaneFromFrameInputs({
    primary,
    extras,
    referenceMode,
  });

  if (resolvedLane === "text") return [];
  if (resolvedLane === "single-image") return orderedFrames.slice(0, 1);
  if (resolvedLane === "first-last") return orderedFrames.slice(0, 2);

  void modelId;
  return orderedFrames.slice(0, 1);
};

/**
 * Builds regenerate inputs while preventing active-output leakage into video pipelines.
 */
export const buildRegenerateReferencePool = ({
  selectedTool,
  useReferenceImageIndicator,
  activeOutputPreviewUrl,
  referenceUrl,
  extraUrls,
  videoReferenceMode,
  videoModelId,
}: {
  selectedTool: ToolId | null;
  useReferenceImageIndicator: boolean;
  activeOutputPreviewUrl: string | null | undefined;
  referenceUrl: string | null;
  extraUrls: (string | null)[];
  videoReferenceMode: VideoReferenceMode;
  videoModelId?: string | null;
}): string[] => {
  if (isImageTool(selectedTool)) {
    return buildImageReferenceInputs(referenceUrl, extraUrls);
  }

  if (isVideoTool(selectedTool)) {
    return buildVideoReferenceInputs(referenceUrl, extraUrls, videoReferenceMode, videoModelId);
  }

  const includeActiveOutputReference =
    useReferenceImageIndicator && Boolean(activeOutputPreviewUrl);
  return [
    ...(includeActiveOutputReference && activeOutputPreviewUrl ? [activeOutputPreviewUrl] : []),
    referenceUrl,
    ...extraUrls,
  ].filter((url): url is string => Boolean(url));
};
