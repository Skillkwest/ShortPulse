/**
 * Inpaint submission override contract propagated from Expert Edit UI to submit handlers.
 */
export const INPAINT_FLUX_FILL_MODEL_ID = "fal-ai/flux-pro/v1/fill";
export const INPAINT_FLUX_FILL_MODEL_LABEL = "Pulse Fill v1";
export const MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID = "fal-ai/nano-banana-pro/edit";
export const MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL = "Pulse Markup v1";
export const MARKUP_MODEL_LOCK_ENV_KEY = "NEXT_PUBLIC_AI_STUDIO_MARKUP_MODEL_LOCK_ENABLED";
export const MARKUP_COLLAPSED_OPEN_MODAL_ENV_KEY =
  "NEXT_PUBLIC_AI_STUDIO_MARKUP_COLLAPSED_OPEN_MODAL_ENABLED";

export const isMarkupModelLockEnabled = (
  rawValue: string | undefined = process.env[MARKUP_MODEL_LOCK_ENV_KEY]
): boolean => rawValue === "true";

export const isMarkupCollapsedOpenModalEnabled = (
  rawValue: string | undefined = process.env[MARKUP_COLLAPSED_OPEN_MODAL_ENV_KEY]
): boolean => rawValue === "true";

export type InpaintSubmissionOverride = {
  modelId?: string | null;
  baseImageInput: string;
  maskInput: string;
  outputFormat?: "png" | "jpeg";
};
