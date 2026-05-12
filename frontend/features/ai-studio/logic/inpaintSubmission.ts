/**
 * Inpaint submission override contract propagated from Expert Edit UI to submit handlers.
 */
import { FAL_NANO_BANANA_PRO_EDIT_MODEL_ID } from "../../../lib/model-runtime/falModelIds";
import { analyzeExpertEditPromptTokens } from "./expertEditPromptReferences";

export const INPAINT_FLUX_FILL_MODEL_ID = "fal-ai/flux-pro/v1/fill";
export const INPAINT_FLUX_FILL_MODEL_LABEL = "Pulse Fill v1";
export const INPAINT_REFERENCE_MODEL_ID = "fal-ai/flux-kontext-lora/inpaint";
export const INPAINT_REFERENCE_MODEL_LABEL = "Pulse Reference Inpaint v1";
export const MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID = FAL_NANO_BANANA_PRO_EDIT_MODEL_ID;
export const MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL = "Pulse Markup v1";
export const isMarkupModelLockEnabled = (): boolean => true;

export const isMarkupCollapsedOpenModalEnabled = (): boolean => false;

export const isMarkupStrokeSecondaryReferenceEnabled = (): boolean => true;

export const isEditGenerationModeToggleEnabled = (): boolean => true;

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
  imageWidth?: number | null;
  imageHeight?: number | null;
};
