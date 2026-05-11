/**
 * Restore-time model normalization policy for AI Studio.
 * Centralizes compatibility remaps for saved workflow/session model ids.
 */
import {
  getModelCatalogEntry,
  getReplacementModelId,
} from "../../../lib/model-runtime/modelCatalog";
import { normalizeSeedance2UiModelId } from "./seedance2Availability";

/**
 * Normalizes a persisted model id for UI restore without changing current behavior.
 * Applies existing Seedance UI compatibility first, then follows any future
 * replacement-model metadata for non-active models.
 */
export const normalizeAiStudioRestoredModelId = (
  modelId: string | null | undefined
): string | null | undefined => {
  const normalizedModelId = normalizeSeedance2UiModelId(modelId);
  if (!normalizedModelId) return normalizedModelId;

  let currentModelId = normalizedModelId;
  const visited = new Set<string>();

  while (!visited.has(currentModelId)) {
    visited.add(currentModelId);
    const entry = getModelCatalogEntry(currentModelId);
    if (!entry) return currentModelId;
    if (entry.lifecycle === "active") return currentModelId;
    const replacementModelId = getReplacementModelId(currentModelId);
    if (!replacementModelId) return currentModelId;
    currentModelId = replacementModelId;
  }

  return currentModelId;
};
