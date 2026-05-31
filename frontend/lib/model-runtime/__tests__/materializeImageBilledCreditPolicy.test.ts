import { describe, expect, it } from "vitest";

import {
  resolveModelPricingForModel,
  getDefaultModelPricingPolicyDocument,
} from "../pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../materializeImageBilledCreditPolicy";

const basePolicy = {
  ...getDefaultModelPricingPolicyDocument(),
  global: {
    ...getDefaultModelPricingPolicyDocument().global,
    creditUsdScale: 30,
  },
};

describe("materializeImageBilledCreditPolicy", () => {
  it("materializes canonical billed-credit rows for create and edit image variants", () => {
    const materialized = materializeImageBilledCreditPolicy(basePolicy);

    expect(
      resolveModelPricingForModel(materialized, "gpt-image-2", "create|res:medium|aspect:16:9")
        .billedCreditsOverride
    ).toBe(4);

    expect(
      resolveModelPricingForModel(
        materialized,
        "gpt-image-2",
        "edit|res:high|aspect:16:9|input_images:1|input_fidelity:high|mask:no"
      ).billedCreditsOverride
    ).toBe(12);

    expect(
      resolveModelPricingForModel(
        materialized,
        "fal-ai/bytedance/seedream/v4.5/text-to-image",
        "default|res:auto_4K|aspect:1:1"
      ).billedCreditsOverride
    ).toBe(4);
  });
});
