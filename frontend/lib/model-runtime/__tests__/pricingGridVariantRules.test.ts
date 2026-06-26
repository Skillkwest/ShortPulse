import { describe, expect, it } from "vitest";

import { resolvePricingGridAspectOptions } from "../pricingGridVariantRules";

const GPT_IMAGE_2_PROVIDER_ASPECTS = [
  "auto",
  "1:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "5:4",
  "4:5",
  "16:9",
  "9:16",
  "2:1",
  "1:2",
  "3:1",
  "1:3",
  "21:9",
  "9:21",
];

describe("pricing grid variant rules", () => {
  it("keeps Kie GPT Image 2 auto plus app-supported aspect rows only", () => {
    expect(
      resolvePricingGridAspectOptions({
        pricingStrategy: "kie-gpt-image-2-per-image",
        allowedAspects: GPT_IMAGE_2_PROVIDER_ASPECTS,
        defaultAspect: "auto",
      })
    ).toEqual(["auto", "9:16", "4:5", "1:1", "5:4", "16:9"]);
  });
});
