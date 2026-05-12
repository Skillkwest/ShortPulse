/**
 * Seedance 2.x product-availability policy for AI Studio.
 * Seedance 2 is now the canonical public lane, so this module remains only as a
 * compatibility shim for older call sites.
 */
import {
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";

/**
 * Returns whether Seedance 2.x should be exposed in product UI.
 * The old rollout gate is retired; Seedance 2.x is always public now.
 */
export const isSeedance2UiEnabled = (): boolean => true;

/**
 * Returns whether the provided model id is one of the Seedance 2.x public model ids.
 */
export const isSeedance2ModelId = (modelId: string | null | undefined): boolean =>
  modelId === KIE_SEEDANCE_2_MODEL_ID || modelId === KIE_SEEDANCE_2_FAST_MODEL_ID;

/**
 * Preserves normalized Seedance 2.x ids.
 */
export const normalizeSeedance2UiModelId = (
  modelId: string | null | undefined
): string | null | undefined => modelId;
