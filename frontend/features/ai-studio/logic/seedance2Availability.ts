/**
 * Seedance 2.x product-availability policy for AI Studio.
 * Centralizes the public UI gate and safe fallback behavior while keeping backend routes intact.
 */
import {
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

/**
 * Returns whether Seedance 2.x should be exposed in product UI.
 */
export const isSeedance2UiEnabled = (): boolean =>
  parseBooleanEnv(process.env.NEXT_PUBLIC_AI_STUDIO_SEEDANCE_2_ENABLED, true);

/**
 * Returns whether the provided model id is one of the Seedance 2.x public model ids.
 */
export const isSeedance2ModelId = (modelId: string | null | undefined): boolean =>
  modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID;

/**
 * Remaps Seedance 2.x model ids onto the public Seedance 1.5 fallback when the UI flag is disabled.
 */
export const normalizeSeedance2UiModelId = (
  modelId: string | null | undefined
): string | null | undefined => {
  if (!isSeedance2ModelId(modelId)) return modelId;
  return isSeedance2UiEnabled() ? modelId : KIE_SEEDANCE_15_PRO_MODEL_ID;
};
