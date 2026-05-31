import { describe, expect, it } from "vitest";

import { buildPricingParams } from "../pricingParams";

describe("buildPricingParams", () => {
  it("maps GPT Image 2 UI resolution labels to canonical quality tiers", () => {
    expect(buildPricingParams("gpt-image-2", { aspect: "16:9", resolution: "1K", n: 1 })).toEqual(
      expect.objectContaining({
        aspect: "16:9",
        generationCount: 1,
        resolution: "low",
        quality: "low",
      })
    );

    expect(buildPricingParams("gpt-image-2", { aspect: "16:9", resolution: "2K", n: 1 })).toEqual(
      expect.objectContaining({
        aspect: "16:9",
        generationCount: 1,
        resolution: "medium",
        quality: "medium",
      })
    );

    expect(buildPricingParams("gpt-image-2", { aspect: "16:9", resolution: "4K", n: 1 })).toEqual(
      expect.objectContaining({
        aspect: "16:9",
        generationCount: 1,
        resolution: "high",
        quality: "high",
      })
    );
  });
});
