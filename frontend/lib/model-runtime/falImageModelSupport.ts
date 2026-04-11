/**
 * Shared helpers for active Fal image-model routing.
 * Keeps the hot-path image cutover keyed off one runtime source of truth.
 */
import { getModelConfig, type ModelConfig } from "./modelRegistry";

const readFalImageModelConfig = (modelId: string | null | undefined): ModelConfig | null => {
  if (typeof modelId !== "string") return null;
  const trimmed = modelId.trim();
  if (!trimmed.length) return null;
  const config = getModelConfig(trimmed);
  if (!config) return null;
  if (config.provider !== "fal" || config.mediaType !== "image") return null;
  return config;
};

/**
 * Returns true when the model id belongs to an active Fal image lane.
 */
export const isFalImageModelId = (modelId: string | null | undefined): modelId is string =>
  Boolean(readFalImageModelConfig(modelId));

/**
 * Resolves the configured Fal image model label for user-facing diagnostics.
 */
export const getFalImageModelLabel = (modelId: string): string =>
  readFalImageModelConfig(modelId)?.label ?? modelId;
