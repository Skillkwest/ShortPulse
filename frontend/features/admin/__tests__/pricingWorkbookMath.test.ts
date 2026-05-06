import { describe, expect, it } from "vitest";
import {
  getCreditsAtProviderCost,
  getPricingMargin,
  getWorkbookBillableCredits,
  getWorkbookBillableUsd,
} from "../pricingWorkbookMath";

describe("pricingWorkbookMath", () => {
  it("prefers runtime preview credits instead of recomputing display values", () => {
    expect(
      getCreditsAtProviderCost(
        {
          usdRaw: 0.801,
          rawCredits: 81,
          billedCredits: 90,
          billedUsd: 0.9,
        },
        100
      )
    ).toBe(81);

    expect(
      getWorkbookBillableCredits({
        breakdown: {
          usdRaw: 0.801,
          rawCredits: 81,
          billedCredits: 90,
          billedUsd: 0.9,
        },
        creditsAtCost: 80.1,
        markupBps: 1_000,
        roundingIncrement: 5,
      })
    ).toBe(90);

    expect(getWorkbookBillableUsd(90, 100, 0.9)).toBe(0.9);
  });

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
