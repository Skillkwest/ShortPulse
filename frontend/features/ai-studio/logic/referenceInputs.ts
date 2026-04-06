/**
 * Reference input ordering helpers shared by generate/regenerate flows.
 */
import { KIE_VEO_31_FAST_I2V_MODEL_ID } from "../../../lib/model-runtime/providerModelIds";
import type { ToolId } from "../types";

type VideoReferenceMode = "standard" | "modify" | "keyframes" | "kling3" | "motion";
const FAL_KLING_V3_IMAGE_MODEL_ID = "fal-ai/kling-video/v3/pro/image-to-video";

const isImageTool = (tool: ToolId | null): boolean => tool === "image" || tool === "edit";
const isVideoTool = (tool: ToolId | null): boolean => tool === "video" || tool === "kling";

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
  if (!primary) return [];
  const orderedExtras = extras.filter((url): url is string => Boolean(url && url !== primary));
  const shouldUseStandardSecondaryFrame =
    orderedExtras.length > 0 &&
    referenceMode === "standard" &&
    (modelId === KIE_VEO_31_FAST_I2V_MODEL_ID || modelId === FAL_KLING_V3_IMAGE_MODEL_ID);

  if (referenceMode === "motion") {
    return [primary];
  }
  if (referenceMode === "standard") {
    return shouldUseStandardSecondaryFrame ? [primary, orderedExtras[0]] : [primary];
  }
  return [primary, ...orderedExtras];
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
