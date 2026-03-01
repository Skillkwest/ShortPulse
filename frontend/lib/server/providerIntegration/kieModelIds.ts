/**
 * Canonical Kie model id constants for provider-integration boundaries.
 * Keeps dark-path contract modules aligned on one model-id source of truth.
 */

export const KIE_VEO_31_FAST_I2V_MODEL_ID = "kie-ai/veo-3.1-fast-i2v";
export const KIE_KLING_30_MODEL_ID = "kie-ai/kling-3.0";

export const KIE_SUPPORTED_MODEL_IDS = [
  KIE_VEO_31_FAST_I2V_MODEL_ID,
  KIE_KLING_30_MODEL_ID,
] as const;

export type SupportedKieModelId = (typeof KIE_SUPPORTED_MODEL_IDS)[number];

const supportedKieModelIdSet = new Set<string>(KIE_SUPPORTED_MODEL_IDS);

/**
 * Returns true when the model id is part of the canonical Kie dark-path model set.
 */
export const isKnownKieModelId = (modelId: string): modelId is SupportedKieModelId => {
  return supportedKieModelIdSet.has(modelId);
};
