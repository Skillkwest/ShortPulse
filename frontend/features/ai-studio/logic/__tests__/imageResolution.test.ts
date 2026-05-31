import { describe, expect, it } from "vitest";

import { normalizeImageResolutionForCanonicalBilledPricing } from "../imageResolution";

describe("normalizeImageResolutionForCanonicalBilledPricing", () => {
  it("maps GPT Image 2 UI resolution labels back to canonical quality rows", () => {
    expect(normalizeImageResolutionForCanonicalBilledPricing("gpt-image-2", "1K")).toBe("low");
    expect(normalizeImageResolutionForCanonicalBilledPricing("gpt-image-2", "2K")).toBe("medium");
    expect(normalizeImageResolutionForCanonicalBilledPricing("gpt-image-2", "4K")).toBe("high");
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
