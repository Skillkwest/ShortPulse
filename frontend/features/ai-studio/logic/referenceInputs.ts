/**
 * Reference input ordering helpers shared by generate/regenerate flows.
 */
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";
import { FAL_OMNIHUMAN_V15_MODEL_ID } from "../../../lib/model-runtime/falModelIds";
import { isSeedance2UiEnabled } from "./seedance2Availability";
import type { ToolId, VideoReferenceMode } from "../types";

export type ResolvedVideoGenerationLane =
  | "text"
  | "single-image"
  | "first-last"
  | "motion"
  | "lip-sync";

const isImageTool = (tool: ToolId | null): boolean => tool === "image" || tool === "edit";
const isVideoTool = (tool: ToolId | null): boolean => tool === "video" || tool === "kling";

const collectOrderedDistinctVideoFrameInputs = (
  primary: string | null,
  extras: readonly (string | null)[]
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
  extras: readonly (string | null)[];
  referenceMode: VideoReferenceMode;
}): ResolvedVideoGenerationLane => {
  if (referenceMode === "motion") return "motion";
  if (referenceMode === "lip-sync") return "lip-sync";
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
  if (referenceMode === "lip-sync") return "lip-sync";
  if (imageInputs.length >= 2) return "first-last";
  if (imageInputs.length === 1) return "single-image";
  return "text";
};

const isTextCompatibleVideoModel = (modelId: string | null | undefined): boolean =>
  modelId === KIE_VEO_31_FAST_I2V_MODEL_ID ||
  modelId === KIE_KLING_30_MODEL_ID ||
  (isSeedance2UiEnabled() &&
    (modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID));

const isSingleImageCompatibleVideoModel = (modelId: string | null | undefined): boolean =>
  modelId === KIE_KLING_30_MODEL_ID ||
  modelId === KIE_VEO_31_FAST_I2V_MODEL_ID ||
  (isSeedance2UiEnabled() &&
    (modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID));

const isFirstLastCompatibleVideoModel = (modelId: string | null | undefined): boolean =>
  modelId === KIE_VEO_31_FAST_I2V_MODEL_ID ||
  modelId === KIE_KLING_30_MODEL_ID ||
  (isSeedance2UiEnabled() &&
    (modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID));

export const resolveAutoVideoModelForLane = ({
  currentModel,
  lane,
}: {
  currentModel: string | null;
  lane: ResolvedVideoGenerationLane;
}): string | null => {
  if (lane === "motion") {
    if (currentModel === KIE_SEEDANCE_2_MODEL_ID || currentModel === KIE_SEEDANCE_2_FAST_MODEL_ID) {
      return KIE_KLING_30_MODEL_ID;
    }
    if (currentModel === KIE_KLING_30_MODEL_ID) return currentModel;
    return KIE_KLING_30_MODEL_ID;
  }

  if (lane === "lip-sync") {
    return FAL_OMNIHUMAN_V15_MODEL_ID;
  }

  if (lane === "text") {
    if (isTextCompatibleVideoModel(currentModel)) return currentModel;
    return KIE_VEO_31_FAST_I2V_MODEL_ID;
  }

  if (lane === "single-image") {
    if (isSingleImageCompatibleVideoModel(currentModel)) return currentModel;
    return KIE_VEO_31_FAST_I2V_MODEL_ID;
  }

  if (isFirstLastCompatibleVideoModel(currentModel)) return currentModel;
  return KIE_VEO_31_FAST_I2V_MODEL_ID;
};

/**
 * Builds ordered image references, with optional duplicate-slot preservation.
 */
export const buildImageReferenceInputs = (
  primary: string | null,
  extras: readonly (string | null)[],
  options?: {
    preserveDuplicateExtras?: boolean;
  }
): string[] => {
  const preserveDuplicateExtras = options?.preserveDuplicateExtras === true;
  const orderedExtras = extras.filter((url): url is string =>
    preserveDuplicateExtras ? Boolean(url) : Boolean(url && url !== primary)
  );
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
  extras: readonly (string | null)[],
  referenceMode: VideoReferenceMode,
  modelId?: string | null
): string[] => {
  if (referenceMode === "motion") {
    return primary ? [primary] : [];
  }
  if (referenceMode === "lip-sync") {
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
  extraUrls: readonly (string | null)[];
  videoReferenceMode: VideoReferenceMode;
  videoModelId?: string | null;
}): string[] => {
  if (isImageTool(selectedTool)) {
    return buildImageReferenceInputs(referenceUrl, extraUrls, {
      preserveDuplicateExtras: true,
    });
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
