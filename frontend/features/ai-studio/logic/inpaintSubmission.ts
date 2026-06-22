/**
 * Inpaint submission override contract propagated from Expert Edit UI to submit handlers.
 */
import { FAL_NANO_BANANA_PRO_EDIT_MODEL_ID } from "../../../lib/model-runtime/falModelIds";
import type { InternalMediaRef } from "../../../lib/media/internalMediaRefs";
import { analyzeExpertEditPromptTokens } from "./expertEditPromptReferences";

const PUBLIC_ADVANCED_EXPERT_EDIT_MODES_ENABLED = false;
const INPAINT_GENERATION_ENABLED = false;
const MARKUP_GENERATION_ENABLED = false;

export const INPAINT_FLUX_FILL_MODEL_ID = "fal-ai/flux-pro/v1/fill";
export const INPAINT_FLUX_FILL_MODEL_LABEL = "Pulse Fill v1";
export const INPAINT_REFERENCE_MODEL_ID = "fal-ai/flux-kontext-lora/inpaint";
export const INPAINT_REFERENCE_MODEL_LABEL = "Pulse Reference Inpaint v1";
export const MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID = FAL_NANO_BANANA_PRO_EDIT_MODEL_ID;
export const MARKUP_NANO_BANANA_PRO_EDIT_MODEL_LABEL = "Pulse Markup v1";
export const isMarkupGenerationEnabled = (): boolean => MARKUP_GENERATION_ENABLED;
export const isMarkupModelLockEnabled = (): boolean => isMarkupGenerationEnabled();

export const areAdvancedExpertEditModesPubliclyAccessible = (): boolean =>
  PUBLIC_ADVANCED_EXPERT_EDIT_MODES_ENABLED;

export const isMarkupCollapsedOpenModalEnabled = (): boolean => false;

export const isMarkupStrokeSecondaryReferenceEnabled = (): boolean => isMarkupGenerationEnabled();

export const isEditGenerationModeToggleEnabled = (): boolean =>
  areAdvancedExpertEditModesPubliclyAccessible();

export const isInpaintGenerationEnabled = (): boolean => INPAINT_GENERATION_ENABLED;

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
  extraImageUrls: readonly (string | null)[];
}): ResolvedInpaintPromptReferencePolicy => {
  if (!isInpaintGenerationEnabled()) {
    return {
      modelId: INPAINT_FLUX_FILL_MODEL_ID,
      modelLabel: INPAINT_FLUX_FILL_MODEL_LABEL,
      usesReferenceModel: false,
      allowSecondaryReferenceTokens: false,
      maxSecondaryReferenceTokens: 0,
    };
  }
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
  baseImageInternalMediaRef?: InternalMediaRef | null;
  maskInternalMediaRef?: InternalMediaRef | null;
  referenceImageInternalMediaRef?: InternalMediaRef | null;
  outputFormat?: "png" | "jpeg";
  imageWidth?: number | null;
  imageHeight?: number | null;
};
