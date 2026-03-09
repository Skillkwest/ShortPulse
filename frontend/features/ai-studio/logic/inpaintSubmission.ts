/**
 * Inpaint submission override contract propagated from Expert Edit UI to submit handlers.
 */
export const INPAINT_FLUX_FILL_MODEL_ID = "fal-ai/flux-pro/v1/fill";
export const INPAINT_FLUX_FILL_MODEL_LABEL = "FLUX Pro Fill";

export type InpaintSubmissionOverride = {
  modelId?: string | null;
  baseImageInput: string;
  maskInput: string;
  outputFormat?: "png" | "jpeg";
};
