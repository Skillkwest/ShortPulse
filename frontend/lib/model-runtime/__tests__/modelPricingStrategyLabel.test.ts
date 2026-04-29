import { describe, expect, it } from "vitest";
import { getAdminPricingStrategyLabel } from "../modelPricingStrategyLabel";
import { KIE_VEO_31_FAST_I2V_MODEL_ID } from "../providerModelIds";

describe("getAdminPricingStrategyLabel", () => {
  it("treats bria background removal as per-image billing", () => {
    expect(
      getAdminPricingStrategyLabel("fal-ai/bria/background/remove", "fal-economy-image-per-mp")
    ).toBe("Per image");
  });

  it("describes megapixel-priced economy image models plainly", () => {
    expect(getAdminPricingStrategyLabel("fal-ai/flux-2/klein/9b", "fal-economy-image-per-mp")).toBe(
      "Per megapixel"
    );
  });

  it("describes output-sized edit models as output megapixel pricing", () => {
    expect(
      getAdminPricingStrategyLabel(
        "fal-ai/flux-kontext-lora/inpaint",
        "fal-flux-kontext-inpaint-per-mp"
      )
    ).toBe("Per output megapixel");
  });

  it("describes token billing plainly", () => {
    expect(getAdminPricingStrategyLabel("gpt-5-nano", "gpt41nano-per-token")).toBe("Per token");
  });

  it("describes time-based video billing plainly", () => {
    expect(getAdminPricingStrategyLabel(KIE_VEO_31_FAST_I2V_MODEL_ID, "veo-3-per-second")).toBe(
      "Per output second"
    );
  });
});
