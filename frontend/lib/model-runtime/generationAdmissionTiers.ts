/**
 * Generation admission tier mapping shared by server admission control.
 * Resolves a model id to a conservative concurrency tier.
 */
import { getModelConfig } from "./pricing";
import { getModelCatalogEntry } from "./modelCatalog";

export type GenerationAdmissionTier = "video_long" | "image_heavy" | "image_standard";

export const DEFAULT_GENERATION_ADMISSION_TIER: GenerationAdmissionTier = "image_standard";

const IMAGE_HEAVY_MODEL_IDS = new Set<string>([
  "fal/flux-2-pro",
  "fal/flux-2-pro/edit",
  "fal-ai/nano-banana-pro",
  "fal-ai/nano-banana-pro/edit",
  "fal-ai/bytedance/seedream/v4.5/text-to-image",
  "fal-ai/bytedance/seedream/v4.5/edit",
]);

const isVideoLikeModel = (modelId: string): boolean => {
  const modelConfig = getModelConfig(modelId);
  if (modelConfig?.mediaType === "video" || modelConfig?.mediaType === "image-to-video") {
    return true;
  }

  const catalogEntry = getModelCatalogEntry(modelId);
  if (catalogEntry?.defaultDurationSeconds) return true;
  if ((catalogEntry?.allowedDurations?.length ?? 0) > 0) return true;

  const lowered = modelId.toLowerCase();
  return (
    lowered.includes("video") ||
    lowered.includes("kling") ||
    lowered.includes("veo") ||
    lowered.includes("seedance") ||
    lowered.includes("sora")
  );
};

/**
 * Resolves the generation admission tier for a model id.
 */
export const resolveGenerationAdmissionTier = (modelId: string): GenerationAdmissionTier => {
  if (isVideoLikeModel(modelId)) return "video_long";
  if (IMAGE_HEAVY_MODEL_IDS.has(modelId)) return "image_heavy";
  return DEFAULT_GENERATION_ADMISSION_TIER;
};
