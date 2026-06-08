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

  it("counts provider URL-array image inputs for reference-aware billing", () => {
    expect(
      buildPricingParams("gpt-image-2", {
        input_urls: Array.from(
          { length: 10 },
          (_, index) => `https://example.com/ref-${index}.png`
        ),
      })
    ).toEqual(
      expect.objectContaining({
        inputImageCount: 10,
      })
    );

    expect(
      buildPricingParams("gpt-image-2", {
        image_urls: ["https://example.com/ref-1.png", null, "  ", "https://example.com/ref-2.png"],
      })
    ).toEqual(
      expect.objectContaining({
        inputImageCount: 2,
      })
    );
  });

  it("prefers explicit input image count when submission payload provides it", () => {
    expect(
      buildPricingParams("gpt-image-2", {
        input_image_count: 10,
        input_urls: ["https://example.com/ref-1.png"],
      })
    ).toEqual(
      expect.objectContaining({
        inputImageCount: 10,
      })
    );
  });
});
