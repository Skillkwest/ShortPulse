import { describe, expect, it } from "vitest";
import {
  getCreditsAtProviderCost,
  getEffectiveProviderCostUsd,
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

  it("can recompute credits at cost from provider usd when runtime raw credits already include markup", () => {
    expect(
      getCreditsAtProviderCost(
        {
          usdRaw: 0.4,
          rawCredits: 27,
          billedCredits: 27,
          billedUsd: 0.9,
        },
        30,
        {
          preferRuntimeCredits: false,
        }
      )
    ).toBe(12);
  });

  it("ceils billed credits even when no roundup increment override is set", () => {
    expect(
      getWorkbookBillableCredits({
        breakdown: {
          usdRaw: 0.4,
          rawCredits: 27,
          billedCredits: 27,
          billedUsd: 0.9,
        },
        creditsAtCost: 33,
        markupBps: 12_000,
        roundingIncrement: 1,
        preferRuntimeBilledCredits: false,
      })
    ).toBe(73);
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

  it("treats non-time provider overrides as unit rates when a usage multiplier is present", () => {
    expect(
      getEffectiveProviderCostUsd({
        breakdown: {
          usdRaw: 0.08,
          rawCredits: 8,
          billedCredits: 13,
          billedUsd: 0.13,
        },
        providerUsdOverride: 0.08,
        usageRateMultiplier: 15,
      })
    ).toBe(1.2);
  });
});
