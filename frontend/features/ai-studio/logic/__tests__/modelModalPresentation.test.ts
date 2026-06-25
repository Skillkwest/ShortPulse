import { describe, expect, it } from "vitest";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_SEEDREAM_45_TEXT_MODEL_ID,
} from "../../../../lib/model-runtime/falModelIds";
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";
import {
  MODEL_MODAL_FAMILY_META,
  MODEL_MODAL_PRESENTATION_META,
  resolveModelModalContextTooltipTag,
  resolveModelModalFallbackLogo,
  resolveModelModalFamilyKey,
  resolveModelModalLogo,
  resolveModelModalTooltipTags,
} from "../modelModalPresentation";

describe("modelModalPresentation", () => {
  it("maps the active model families to the expected modal family keys", () => {
    expect(resolveModelModalFamilyKey("gpt-image-2")).toBe("other");
    expect(resolveModelModalFamilyKey(KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID)).toBe("gpt-image");
    expect(resolveModelModalFamilyKey(FAL_SEEDREAM_45_TEXT_MODEL_ID)).toBe("seedream");
    expect(resolveModelModalFamilyKey(FAL_NANO_BANANA_2_MODEL_ID)).toBe("nano-banana");
    expect(resolveModelModalFamilyKey(FAL_FLUX_2_KLEIN_9B_MODEL_ID)).toBe("flux");
    expect(resolveModelModalFamilyKey(KIE_VEO_31_FAST_I2V_MODEL_ID)).toBe("veo");
    expect(resolveModelModalFamilyKey(KIE_KLING_30_MODEL_ID)).toBe("kling");
    expect(resolveModelModalFamilyKey(KIE_SEEDANCE_2_MODEL_ID)).toBe("seedance");
    expect(resolveModelModalFamilyKey("custom/provider-model")).toBe("other");
  });

  it("keeps the canonical family labels stable for the modal columns", () => {
    expect(MODEL_MODAL_FAMILY_META.seedream.label).toBe("Seedream");
    expect(MODEL_MODAL_FAMILY_META["nano-banana"].label).toBe("Nano Banana");
    expect(MODEL_MODAL_FAMILY_META["gpt-image"].label).toBe("GPT Image");
    expect(MODEL_MODAL_FAMILY_META.flux.label).toBe("FLUX");
    expect(MODEL_MODAL_FAMILY_META.veo.label).toBe("Veo");
  });

  it("maps provider and section names to the expected fallback logos", () => {
    expect(resolveModelModalFallbackLogo("ByteDance")).toBe("/seedream-logo.png");
    expect(resolveModelModalFallbackLogo("Google")).toBe("/google-logo.png");
    expect(resolveModelModalFallbackLogo("Black Forest Labs")).toBe("/flux-logo.png");
    expect(resolveModelModalFallbackLogo("Kling AI")).toBe("/kling-logo.png");
    expect(resolveModelModalFallbackLogo("Unknown Provider")).toBeUndefined();
  });

  it("keeps the shared tooltip presentation metadata stable for active picker models", () => {
    expect(MODEL_MODAL_PRESENTATION_META[FAL_SEEDREAM_45_TEXT_MODEL_ID]?.provider).toBe(
      "ByteDance"
    );
    expect(MODEL_MODAL_PRESENTATION_META[FAL_SEEDREAM_45_TEXT_MODEL_ID]?.description).toMatch(
      /automatic 2K and 4K upscale modes/i
    );
    expect(MODEL_MODAL_PRESENTATION_META[KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID]).toMatchObject({
      provider: "Kie AI",
      tags: ["Image", "Image-to-Image", "1K-4K", "Queued"],
      verified: true,
    });
    expect(MODEL_MODAL_PRESENTATION_META[KIE_VEO_31_FAST_I2V_MODEL_ID]?.provider).toBe("Kie AI");
  });

  it("resolves tooltip context tags and keeps tooltip tags ordered with the five-tag cap", () => {
    expect(resolveModelModalContextTooltipTag("reference-keyframes")).toBe("First/Last Frame");
    expect(resolveModelModalContextTooltipTag("text-image")).toBe("Text-to-Image");
    expect(resolveModelModalTooltipTags(FAL_SEEDREAM_45_TEXT_MODEL_ID, "Text-to-Image")).toEqual([
      "Image",
      "Text-to-Image",
      "Native/2K/4K",
    ]);
    expect(resolveModelModalTooltipTags(KIE_VEO_31_FAST_I2V_MODEL_ID, "First/Last Frame")).toEqual([
      "Video",
      "First/Last Frame",
      "Image-to-Video",
      "Text-to-Video",
      "720p/1080p",
    ]);
  });

  it("resolves explicit and fallback logos through the shared presentation helper", () => {
    expect(resolveModelModalLogo(FAL_SEEDREAM_45_TEXT_MODEL_ID)).toBe("/seedream-logo.png");
    expect(resolveModelModalLogo(KIE_KLING_30_MODEL_ID)).toBe("/kling-logo.png");
    expect(resolveModelModalLogo("custom/provider-model")).toBeUndefined();
  });
});
