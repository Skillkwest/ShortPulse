/**
 * Inpaint submission override contract propagated from Expert Edit UI to submit handlers.
 */
export type InpaintSubmissionOverride = {
  modelId?: string | null;
  baseImageInput: string;
  maskInput: string;
  outputFormat?: "png" | "jpeg";
};
