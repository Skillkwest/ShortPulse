import { describe, expect, it } from "vitest";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_SEEDREAM_45_EDIT_MODEL_ID,
  FAL_SEEDREAM_45_TEXT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
} from "../../../../../lib/model-runtime/falModelIds";
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
} from "../../../../../lib/model-runtime/providerModelIds";
import { resolveImageSubmissionSafetyPayload } from "../safetyPolicy";

describe("resolveImageSubmissionSafetyPayload", () => {
  it("keeps non-Seedream image safety-checker defaults disabled", () => {
    expect(resolveImageSubmissionSafetyPayload(FAL_FLUX_2_KLEIN_9B_MODEL_ID)).toEqual({
      enable_safety_checker: false,
    });
  });

  it("enables the provider safety checker for Seedream image models", () => {
    expect(resolveImageSubmissionSafetyPayload(FAL_SEEDREAM_45_TEXT_MODEL_ID)).toEqual({
      enable_safety_checker: true,
    });
    expect(resolveImageSubmissionSafetyPayload(FAL_SEEDREAM_45_EDIT_MODEL_ID)).toEqual({
      enable_safety_checker: true,
    });
    expect(resolveImageSubmissionSafetyPayload(FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID)).toEqual({
      enable_safety_checker: true,
    });
    expect(resolveImageSubmissionSafetyPayload(FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID)).toEqual({
      enable_safety_checker: true,
    });
  });

  it("uses maximum tolerance where supported by fill lanes", () => {
    expect(resolveImageSubmissionSafetyPayload("fal-ai/flux-pro/v1/fill")).toEqual({
      safety_tolerance: "5",
    });
  });

  it("disables Kie GPT Image 2 safety checker and uses maximum tolerance", () => {
    expect(resolveImageSubmissionSafetyPayload(KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID)).toEqual({
      enable_safety_checker: false,
      safety_tolerance: 5,
    });
    expect(resolveImageSubmissionSafetyPayload(KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID)).toEqual({
      enable_safety_checker: false,
      safety_tolerance: 5,
    });
  });

  it("returns empty payload for models without explicit safety policy overrides", () => {
    expect(resolveImageSubmissionSafetyPayload(FAL_NANO_BANANA_2_MODEL_ID)).toEqual({});
    expect(resolveImageSubmissionSafetyPayload("unknown-model")).toEqual({});
  });
});
