import { describe, expect, it } from "vitest";

import { KIE_KLING_30_MOTION_CONTROL_VARIANT_ID } from "../klingMotionControlPricing";
import {
  ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
} from "../elevenLabsModels";
import { KIE_KLING_30_MODEL_ID } from "../providerModelIds";
import { buildModelPricingVariantId, resolveModelPricingVariantId } from "../modelPricingVariants";

describe("modelPricingVariants", () => {
  it("encodes Create edit-specific dimensions into variant ids", () => {
    expect(
      buildModelPricingVariantId({
        baseVariantId: "edit",
        aspect: "16:9",
        resolution: "medium",
        inputImageCount: 3,
        inputFidelity: "high",
        maskPresent: true,
      })
    ).toBe("edit|res:medium|aspect:16:9|input_images:3|input_fidelity:high|mask:yes");
  });

  it("collapses non-input-priced edit models onto one canonical edit row", () => {
    expect(
      resolveModelPricingVariantId({
        modelId: "fal-ai/nano-banana-2/edit",
        aspect: "16:9",
        resolution: "2K",
        inputImageCount: 3,
        inputFidelity: "high",
        maskPresent: false,
      })
    ).toBe("edit|res:2K|aspect:16:9");
  });

  it("omits standard aspect dimensions for Kling Motion Control pricing rows", () => {
    expect(
      resolveModelPricingVariantId({
        modelId: KIE_KLING_30_MODEL_ID,
        variantBaseId: KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
        aspect: "16:9",
        resolution: "720p",
        audio: true,
      })
    ).toBe("motion_control|res:720p|audio:on");
  });

  it("keeps sound effect Auto and explicit duration on separate rows", () => {
    expect(
      resolveModelPricingVariantId({
        modelId: "eleven_text_to_sound_v2",
        generationCount: 1,
      })
    ).toBe(`${ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID}|aspect:audio`);

    expect(
      resolveModelPricingVariantId({
        modelId: "eleven_text_to_sound_v2",
        durationSeconds: 10,
      })
    ).toBe(`${ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID}|aspect:audio`);
  });
});
