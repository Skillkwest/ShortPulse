/**
 * Generation admission tier mapping shared by server admission control.
 * Resolves a model id to a conservative concurrency tier.
 */
import { getModelConfig } from "./pricing";
import {
  getModelAdmissionTier,
  getModelCatalogEntry,
  type ModelAdmissionTier,
} from "./modelCatalog";

export type GenerationAdmissionTier = ModelAdmissionTier;

export const DEFAULT_GENERATION_ADMISSION_TIER: GenerationAdmissionTier = "image_standard";

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
    lowered.includes("seedance")
  );
};

/**
 * Resolves the generation admission tier for a model id.
 */
export const resolveGenerationAdmissionTier = (modelId: string): GenerationAdmissionTier => {
  const explicitTier = getModelAdmissionTier(modelId);
  if (explicitTier) return explicitTier;
  if (isVideoLikeModel(modelId)) return "video_long";
  return DEFAULT_GENERATION_ADMISSION_TIER;
};
