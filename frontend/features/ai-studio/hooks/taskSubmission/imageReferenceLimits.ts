/**
 * Provider input-image limits for AI Studio image/edit submissions.
 * Keeps reference payload truncation and preflight validation aligned.
 */
import {
  FAL_NANO_BANANA_2_EDIT_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
  FAL_NANO_BANANA_PRO_MODEL_ID,
  FAL_SEEDREAM_45_EDIT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
} from "../../../../lib/model-runtime/falModelIds";
import { KIE_GPT_IMAGE_2_MAX_INPUT_IMAGES } from "../../../../lib/model-runtime/kieGptImage2";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../lib/model-runtime/openAiImage2";
import { KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../../logic/editPromptPolicy";

export const DEFAULT_IMAGE_REFERENCE_INPUT_LIMIT = 10;
export const MAX_IMAGE_REFERENCE_INPUT_LIMIT = 16;

export const resolveImageReferenceInputLimitForModel = (
  modelId: string | null | undefined
): number => {
  switch (modelId) {
    case OPENAI_GPT_IMAGE_2_MODEL_ID:
      return MAX_IMAGE_REFERENCE_INPUT_LIMIT;
    case KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID:
      return KIE_GPT_IMAGE_2_MAX_INPUT_IMAGES;
    case BRIA_BACKGROUND_REMOVE_MODEL_ID:
      return 1;
    case FAL_NANO_BANANA_2_MODEL_ID:
    case FAL_NANO_BANANA_2_EDIT_MODEL_ID:
    case FAL_NANO_BANANA_PRO_MODEL_ID:
    case FAL_NANO_BANANA_PRO_EDIT_MODEL_ID:
    case FAL_SEEDREAM_45_EDIT_MODEL_ID:
    case FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID:
      return DEFAULT_IMAGE_REFERENCE_INPUT_LIMIT;
    default:
      return DEFAULT_IMAGE_REFERENCE_INPUT_LIMIT;
  }
};

export const buildTooManyReferenceImagesMessage = ({
  modelLabel,
  limit,
}: {
  modelLabel: string;
  limit: number;
}): string =>
  `${modelLabel} can use up to ${limit} reference image${
    limit === 1 ? "" : "s"
  } at once. Remove one reference or choose a model with a higher reference limit.`;
