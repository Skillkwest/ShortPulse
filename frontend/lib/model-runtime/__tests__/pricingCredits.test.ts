/**
 * Unit coverage for decimal-safe USD-to-credit conversion policy behavior.
 */

import { describe, expect, it } from "vitest";
import { convertUsdToCredits, resolveModelCreditRoundingMode } from "../pricingCredits";
import { buildModelPricingVariantId } from "../modelPricingVariants";

describe("pricingCredits", () => {
  it("applies the default 60% markup while keeping whole-credit roundup", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.039,
    });
    expect(result).toEqual({
      rawCredits: 7,
      credits: 7,
      billedUsd: 0.07,
    });
  });

  it("ignores legacy global nearest-5 quantization while still applying the default markup", () => {
    const fluxLite = convertUsdToCredits({
      modelId: "fal-ai/flux-2/klein/9b",
      usdRaw: 0.00648,
    });
    const bria = convertUsdToCredits({
      modelId: "fal-ai/bria/background/remove",
      usdRaw: 0.018,
    });
    expect(fluxLite).toEqual({
      rawCredits: 2,
      credits: 2,
      billedUsd: 0.02,
    });
    expect(bria).toEqual({
      rawCredits: 3,
      credits: 3,
      billedUsd: 0.03,
    });
  });

  it("does not round boundary values up to nearest-5 without a per-model override", () => {
    const noMarkupAtFive = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.05,
      applyMarkup: false,
    });
    const noMarkupAboveFive = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.050001,
      applyMarkup: false,
    });

    expect(noMarkupAtFive.rawCredits).toBe(5);
    expect(noMarkupAtFive.credits).toBe(5);
    expect(noMarkupAboveFive.rawCredits).toBe(6);
    expect(noMarkupAboveFive.credits).toBe(6);
  });

  it("applies the default 60% markup when no per-model override exists", () => {
    const withoutMarkup = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.0486,
      applyMarkup: false,
    });
    const withMarkup = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.0486,
    });

    expect(withoutMarkup.rawCredits).toBe(5);
    expect(withoutMarkup.credits).toBe(5);
    expect(withMarkup.rawCredits).toBe(8);
    expect(withMarkup.credits).toBe(8);
  });

  it("resolves ceil rounding unless a per-model increment is set", () => {
    expect(resolveModelCreditRoundingMode("fal-ai/flux-2/klein/9b")).toBe("ceil");
    expect(resolveModelCreditRoundingMode("fal-ai/bria/background/remove")).toBe("ceil");
    expect(
      resolveModelCreditRoundingMode("fal-ai/nano-banana", {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "ceil",
          defaultRoundingIncrement: 1,
        },
        perModel: {
          "fal-ai/nano-banana": {
            roundingIncrement: 5,
          },
        },
      })
    ).toBe("nearest-5");
  });

  it("ignores the legacy top-level markup field while still applying the default markup", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.039,
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 200,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
        },
        perModel: {},
      },
    });

    expect(result).toEqual({
      rawCredits: 13,
      credits: 13,
      billedUsd: 0.065,
    });
  });

  it("applies per-model markup without layering on the legacy top-level field", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.039,
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
        },
        perModel: {
          "fal-ai/nano-banana": {
            markupBps: 10_000,
          },
        },
      },
    });

    expect(result).toEqual({
      rawCredits: 8,
      credits: 8,
      billedUsd: 0.08,
    });
  });

  it("applies per-model credit conversion overrides", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.039,
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
        },
        perModel: {
          "fal-ai/nano-banana": {
            creditUsdScale: 200,
          },
        },
      },
    });

    expect(result).toEqual({
      rawCredits: 13,
      credits: 13,
      billedUsd: 0.065,
    });
  });

  it("applies per-model rounding increment overrides", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.0486,
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
        },
        perModel: {
          "fal-ai/nano-banana": {
            roundingIncrement: 5,
          },
        },
      },
    });

    expect(result).toEqual({
      rawCredits: 8,
      credits: 10,
      billedUsd: 0.1,
    });
  });

  it("converts legacy multiplier overrides without using top-level markup", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.039,
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
        },
        perModel: {
          "fal-ai/nano-banana": {
            // Legacy format from the first control-plane implementation.
            // Normalization maps this to a per-model markup and ignores top-level markup.
            multiplierBps: 20_000,
            roundingIncrement: 1,
          } as never,
        },
      },
    });

    expect(result).toEqual({
      rawCredits: 8,
      credits: 8,
      billedUsd: 0.08,
    });
  });

  it("converts legacy exception ids into normal roundup increment overrides on top of the default markup", () => {
    const fluxLite = convertUsdToCredits({
      modelId: "fal-ai/flux-2/klein/9b",
      usdRaw: 0.00648,
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
          exceptionRoundingModelIds: ["fal-ai/flux-2/klein/9b"],
        } as never,
        perModel: {},
      },
    });

    expect(fluxLite).toEqual({
      rawCredits: 2,
      credits: 2,
      billedUsd: 0.02,
    });
  });

  it("applies per-variant markup overrides without affecting sibling variants", () => {
    const modelId = "fal-ai/nano-banana-2";
    const oneKVariantId = buildModelPricingVariantId({
      baseVariantId: "default",
      aspect: "auto",
      resolution: "1K",
    });
    const twoKVariantId = buildModelPricingVariantId({
      baseVariantId: "default",
      aspect: "auto",
      resolution: "2K",
    });
    const policy = {
      schemaVersion: 2 as const,
      global: {
        creditUsdScale: 100,
        defaultRoundingMode: "ceil" as const,
        defaultRoundingIncrement: 1,
      },
      perModel: {
        [modelId]: {
          variants: {
            [oneKVariantId]: {
              markupBps: 6_000,
            },
          },
        },
      },
    };

    const oneKResult = convertUsdToCredits({
      modelId,
      usdRaw: 0.08,
      policy,
      variantId: oneKVariantId,
    });
    const twoKResult = convertUsdToCredits({
      modelId,
      usdRaw: 0.08,
      policy,
      variantId: twoKVariantId,
    });

    expect(oneKResult).toEqual({
      rawCredits: 13,
      credits: 13,
      billedUsd: 0.13,
    });
    expect(twoKResult).toEqual({
      rawCredits: 13,
      credits: 13,
      billedUsd: 0.13,
    });
  });
});
