import { describe, expect, it } from "vitest";

import { buildPricingParams } from "../../server/api/generationBilling/pricingParams";
import {
  resolveEditImageBilledCreditLookup,
  resolveEditImageBilledCredits,
} from "../editImageBilledCredits";
import { getDefaultModelPricingPolicyDocument } from "../pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../materializeImageBilledCreditPolicy";
import { KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID } from "../providerModelIds";

const pricingPolicy = materializeImageBilledCreditPolicy({
  ...getDefaultModelPricingPolicyDocument(),
  global: {
    ...getDefaultModelPricingPolicyDocument().global,
    creditUsdScale: 30,
  },
});

describe("editImageBilledCredits", () => {
  it("keeps client Edit lookup and server debit lookup on the same active Kie GPT Image 2 row", () => {
    const clientLookup = resolveEditImageBilledCreditLookup({
      modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      params: {
        aspect: "16:9",
        resolution: "1K",
        inputImageCount: 1,
      },
      pricingPolicy,
    });
    const serverLookup = resolveEditImageBilledCreditLookup({
      modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      params: buildPricingParams(KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID, {
        aspect_ratio: "16:9",
        resolution: "1K",
        image_urls: ["https://cdn.shortpulse.test/base.png"],
      }),
      pricingPolicy,
    });

    expect(clientLookup.breakdown?.variantId).toBe(serverLookup.breakdown?.variantId);
    expect(clientLookup.breakdown?.variantId).toBe("edit|res:1K|aspect:16:9");
    expect(clientLookup.breakdown?.credits).toBe(serverLookup.breakdown?.credits);
    expect(clientLookup.breakdown?.credits).toBe(2);
    expect(clientLookup.authorityMode).toBe("explicit_row");
    expect(serverLookup.authorityMode).toBe("explicit_row");
  });

  it("keeps active Kie GPT Image 2 multi-ref Edit pricing on the canonical edit row", () => {
    const lookup = resolveEditImageBilledCreditLookup({
      modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
      params: {
        aspect: "16:9",
        resolution: "1K",
        inputImageCount: 2,
      },
      pricingPolicy,
    });

    expect(lookup.authorityMode).toBe("explicit_row");
    expect(lookup.breakdown?.variantId).toBe("edit|res:1K|aspect:16:9");
    expect(
      resolveEditImageBilledCredits({
        modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
        params: lookup.params,
        pricingPolicy,
      })
    ).toBe(2);
  });

  it("collapses Nano Banana 2 Edit multi-ref pricing onto the canonical edit row", () => {
    const lookup = resolveEditImageBilledCreditLookup({
      modelId: "fal-ai/nano-banana-2/edit",
      params: {
        aspect: "16:9",
        resolution: "2K",
        inputImageCount: 3,
      },
      pricingPolicy,
    });

    expect(lookup.breakdown?.variantId).toBe("edit|res:2K|aspect:auto");
    expect(lookup.breakdown?.credits).toBe(7);
  });
});
