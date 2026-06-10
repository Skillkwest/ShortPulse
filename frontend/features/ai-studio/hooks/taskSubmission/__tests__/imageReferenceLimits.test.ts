import { describe, expect, it } from "vitest";

import {
  FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
  FAL_SEEDREAM_45_EDIT_MODEL_ID,
} from "../../../../../lib/model-runtime/falModelIds";
import { KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID } from "../../../../../lib/model-runtime/providerModelIds";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../../../../../lib/model-runtime/openAiImage2";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../../../logic/editPromptPolicy";
import { resolveImageReferenceInputLimitForModel } from "../imageReferenceLimits";

describe("imageReferenceLimits", () => {
  it("allows primary plus ten secondary references for GPT Image 2-capable edit lanes", () => {
    expect(resolveImageReferenceInputLimitForModel(OPENAI_GPT_IMAGE_2_MODEL_ID)).toBe(16);
    expect(resolveImageReferenceInputLimitForModel(KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID)).toBe(
      16
    );
  });

  it("keeps provider-specific lower limits for edit models with narrower image arrays", () => {
    expect(resolveImageReferenceInputLimitForModel(FAL_NANO_BANANA_PRO_EDIT_MODEL_ID)).toBe(10);
    expect(resolveImageReferenceInputLimitForModel(FAL_SEEDREAM_45_EDIT_MODEL_ID)).toBe(10);
    expect(resolveImageReferenceInputLimitForModel(BRIA_BACKGROUND_REMOVE_MODEL_ID)).toBe(1);
  });
});
