import { describe, expect, it } from "vitest";

import { buildPricingParams } from "../../server/api/generationBilling/pricingParams";
import {
  resolveEditImageBilledCreditLookup,
  resolveEditImageBilledCredits,
} from "../editImageBilledCredits";
import { getDefaultModelPricingPolicyDocument } from "../pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../materializeImageBilledCreditPolicy";
import { OPENAI_GPT_IMAGE_2_MODEL_ID } from "../openAiImage2";

const pricingPolicy = materializeImageBilledCreditPolicy({
  ...getDefaultModelPricingPolicyDocument(),
  global: {
    ...getDefaultModelPricingPolicyDocument().global,
    creditUsdScale: 30,
  },
});

describe("editImageBilledCredits", () => {
  it("keeps client Edit lookup and server debit lookup on the same canonical GPT Image 2 row", () => {
    const clientLookup = resolveEditImageBilledCreditLookup({
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      params: {
        aspect: "16:9",
        resolution: "medium",
        inputImageCount: 1,
      },
      pricingPolicy,
    });
    const serverLookup = resolveEditImageBilledCreditLookup({
      modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
      params: buildPricingParams(OPENAI_GPT_IMAGE_2_MODEL_ID, {
        size: "1536x1024",
        quality: "MEDIUM",
        input_fidelity: "high",
        images: [{ image_url: "https://cdn.shortpulse.test/base.png" }],
      }),
      pricingPolicy,
    });

    expect(clientLookup.breakdown?.variantId).toBe(serverLookup.breakdown?.variantId);
    expect(clientLookup.breakdown?.variantId).toBe(
      "edit|res:medium|aspect:16:9|input_images:1|input_fidelity:high|mask:no"
    );
    expect(clientLookup.breakdown?.credits).toBe(serverLookup.breakdown?.credits);
    expect(clientLookup.breakdown?.credits).not.toBeNull();
  });

  it("keeps GPT Image 2 multi-ref Edit gaps fail-closed after canonical normalization", () => {
    expect(
      resolveEditImageBilledCredits({
        modelId: OPENAI_GPT_IMAGE_2_MODEL_ID,
        params: {
          aspect: "16:9",
          resolution: "medium",
          inputImageCount: 2,
        },
        pricingPolicy,
      })
    ).toBeNull();
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
