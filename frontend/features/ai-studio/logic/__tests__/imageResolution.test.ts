import { describe, expect, it } from "vitest";

import {
  normalizeImageResolutionForCanonicalBilledPricing,
  normalizeKieGptImage2ResolutionForAspect,
} from "../imageResolution";

describe("normalizeImageResolutionForCanonicalBilledPricing", () => {
  it("preserves active Kie GPT Image 2 resolution rows for billed pricing", () => {
    expect(
      normalizeImageResolutionForCanonicalBilledPricing("kie-ai/gpt-image-2-text-to-image", "1K")
    ).toBe("1K");
    expect(
      normalizeImageResolutionForCanonicalBilledPricing("kie-ai/gpt-image-2-text-to-image", "2K")
    ).toBe("2K");
    expect(
      normalizeImageResolutionForCanonicalBilledPricing("kie-ai/gpt-image-2-text-to-image", "4K")
    ).toBe("4K");
  });

  it("preserves authored non-GPT resolutions for other create models", () => {
    expect(
      normalizeImageResolutionForCanonicalBilledPricing(
        "fal-ai/bytedance/seedream/v4.5/text-to-image",
        "auto_4K"
      )
    ).toBe("auto_4K");
  });
});

describe("normalizeKieGptImage2ResolutionForAspect", () => {
  it("keeps provider-supported 4K aspect ratios and downgrades documented unsupported 2K/4K aspects", () => {
    expect(normalizeKieGptImage2ResolutionForAspect({ aspect: "1:1", resolution: "4K" })).toBe(
      "4K"
    );
    expect(normalizeKieGptImage2ResolutionForAspect({ aspect: "16:9", resolution: "4K" })).toBe(
      "4K"
    );
    expect(normalizeKieGptImage2ResolutionForAspect({ aspect: "4:5", resolution: "4K" })).toBe(
      "1K"
    );
    expect(normalizeKieGptImage2ResolutionForAspect({ aspect: "5:4", resolution: "2K" })).toBe(
      "1K"
    );
    expect(normalizeKieGptImage2ResolutionForAspect({ aspect: "3:1", resolution: "2K" })).toBe(
      "1K"
    );
    expect(normalizeKieGptImage2ResolutionForAspect({ aspect: "auto", resolution: "4K" })).toBe(
      "1K"
    );
  });
});
