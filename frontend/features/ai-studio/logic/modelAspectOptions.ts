import type { AspectOption } from "../types";
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
} from "../../../lib/model-runtime/providerModelIds";

const KIE_GPT_IMAGE_2_HIDDEN_UI_ASPECTS = new Set(["4:5", "5:4"]);

const isKieGptImage2Model = (modelId: string | null | undefined): boolean =>
  modelId === KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID ||
  modelId === KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID;

export const resolveUiAllowedAspectsForModel = ({
  modelId,
  allowedAspects,
}: {
  modelId: string | null | undefined;
  allowedAspects?: readonly string[] | null;
}): string[] => {
  const baseAspects = allowedAspects ? [...allowedAspects] : [];
  if (!isKieGptImage2Model(modelId)) return baseAspects;
  return baseAspects.filter((aspect) => !KIE_GPT_IMAGE_2_HIDDEN_UI_ASPECTS.has(aspect));
};

export const filterAspectOptionsForModel = ({
  modelId,
  allowedAspects,
  options,
}: {
  modelId: string | null | undefined;
  allowedAspects?: readonly string[] | null;
  options: AspectOption[];
}): AspectOption[] => {
  const uiAllowedAspects = resolveUiAllowedAspectsForModel({ modelId, allowedAspects });
  if (!uiAllowedAspects.length) return options;
  return options.filter((option) => uiAllowedAspects.includes(option.value));
};
