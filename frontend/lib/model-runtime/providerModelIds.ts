/**
 * Canonical provider model-id constants shared across runtime catalog/registry
 * and server provider-integration boundaries.
 */

export const KIE_VEO_31_FAST_I2V_MODEL_ID = "kie-ai/veo-3.1-fast-i2v";
export const KIE_KLING_30_MODEL_ID = "kie-ai/kling-3.0";
export const KIE_SEEDANCE_15_PRO_MODEL_ID = "kie-ai/seedance-1.5-pro";
export const KIE_SEEDANCE_2_MODEL_ID = "kie-ai/seedance-2";
export const KIE_SEEDANCE_2_FAST_MODEL_ID = "kie-ai/seedance-2-fast";

export const KIE_SUPPORTED_MODEL_IDS = [
  KIE_VEO_31_FAST_I2V_MODEL_ID,
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
] as const;

export type SupportedKieModelId = (typeof KIE_SUPPORTED_MODEL_IDS)[number];

const supportedKieModelIdSet = new Set<string>(KIE_SUPPORTED_MODEL_IDS);

/**
 * Returns true when the model id is part of the canonical Kie model set.
 */
export const isKnownKieModelId = (modelId: string): modelId is SupportedKieModelId => {
  return supportedKieModelIdSet.has(modelId);
};
