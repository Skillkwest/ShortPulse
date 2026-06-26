import { describe, expect, it } from "vitest";

import { normalizeImageResolutionForCanonicalBilledPricing } from "../imageResolution";

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
