/**
 * Inpaint submission override contract propagated from Expert Edit UI to submit handlers.
 */
import { analyzeExpertEditPromptTokens } from "./expertEditPromptReferences";

export const INPAINT_FLUX_FILL_MODEL_ID = "fal-ai/flux-pro/v1/fill";
export const INPAINT_FLUX_FILL_MODEL_LABEL = "Pulse Fill v1";
export const INPAINT_REFERENCE_MODEL_ID = "fal-ai/flux-kontext-lora/inpaint";
export const INPAINT_REFERENCE_MODEL_LABEL = "Pulse Reference Inpaint v1";
export const MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID = "fal-ai/nano-banana-pro/edit";
export const MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL = "Pulse Markup v1";
export const MARKUP_MODEL_LOCK_ENV_KEY = "NEXT_PUBLIC_AI_STUDIO_MARKUP_MODEL_LOCK_ENABLED";
export const MARKUP_COLLAPSED_OPEN_MODAL_ENV_KEY =
  "NEXT_PUBLIC_AI_STUDIO_MARKUP_COLLAPSED_OPEN_MODAL_ENABLED";
export const MARKUP_STROKE_SECONDARY_REFERENCE_ENV_KEY =
  "NEXT_PUBLIC_AI_STUDIO_MARKUP_STROKE_SECONDARY_REFERENCE_ENABLED";
export const EDIT_GENERATION_MODE_TOGGLE_ENV_KEY =
  "NEXT_PUBLIC_AI_STUDIO_EDIT_GENERATION_MODE_TOGGLE_ENABLED";

export const isMarkupModelLockEnabled = (
  rawValue: string | undefined = process.env[MARKUP_MODEL_LOCK_ENV_KEY]
): boolean => rawValue === "true";

export const isMarkupCollapsedOpenModalEnabled = (
  rawValue: string | undefined = process.env[MARKUP_COLLAPSED_OPEN_MODAL_ENV_KEY]
): boolean => rawValue === "true";

export const isMarkupStrokeSecondaryReferenceEnabled = (
  rawValue: string | undefined = process.env[MARKUP_STROKE_SECONDARY_REFERENCE_ENV_KEY]
): boolean => rawValue === "true";

export const isEditGenerationModeToggleEnabled = (
  rawValue: string | undefined = process.env[EDIT_GENERATION_MODE_TOGGLE_ENV_KEY]
): boolean => rawValue === "true";

export const MAX_INPAINT_SECONDARY_REFERENCE_IMAGES = 1;

export type ResolvedInpaintPromptReferencePolicy = {
  modelId: string;
  modelLabel: string;
  usesReferenceModel: boolean;
  allowSecondaryReferenceTokens: boolean;
  maxSecondaryReferenceTokens: number;
};

export const resolveInpaintPromptReferencePolicy = ({
  promptText,
  extraImageUrls,
}: {
  promptText: string;
  extraImageUrls: [string | null, string | null, string | null];
}): ResolvedInpaintPromptReferencePolicy => {
  const analysis = analyzeExpertEditPromptTokens(promptText, extraImageUrls, {
    allowSecondaryTokens: true,
    maxSecondaryReferences: MAX_INPAINT_SECONDARY_REFERENCE_IMAGES,
  });
  const usesReferenceModel =
    !analysis.hasInvalidTokens &&
    analysis.referencedSlotIndexes.length === MAX_INPAINT_SECONDARY_REFERENCE_IMAGES;

  return {
    modelId: usesReferenceModel ? INPAINT_REFERENCE_MODEL_ID : INPAINT_FLUX_FILL_MODEL_ID,
    modelLabel: usesReferenceModel ? INPAINT_REFERENCE_MODEL_LABEL : INPAINT_FLUX_FILL_MODEL_LABEL,
    usesReferenceModel,
    allowSecondaryReferenceTokens: true,
    maxSecondaryReferenceTokens: MAX_INPAINT_SECONDARY_REFERENCE_IMAGES,
  };
};

export type InpaintSubmissionOverride = {
  modelId?: string | null;
  baseImageInput: string;
  maskInput: string;
  referenceImageInput?: string | null;
  outputFormat?: "png" | "jpeg";
};
