/**
 * Provider-integration re-export for canonical Kie model ids.
 * Source of truth lives in model-runtime to prevent cross-layer drift.
 */

export {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SUPPORTED_MODEL_IDS,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
  isKnownKieModelId,
  type SupportedKieModelId,
} from "../../model-runtime/providerModelIds";
