import { describe, expect, it } from "vitest";
import { getPricingMargin } from "../pricingWorkbookMath";

describe("pricingWorkbookMath", () => {
  it("preserves negative margins when billed price falls below provider cost", () => {
    const margin = getPricingMargin(
      {
        usdRaw: 2.5,
        rawCredits: 250,
        billedCredits: 100,
        billedUsd: 1,
      },
      1
    );

    expect(margin).toEqual({
      usd: -1.5,
      percent: -150,
    });
  });
});
