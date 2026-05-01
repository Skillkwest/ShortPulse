/**
 * Unit coverage for decimal-safe USD-to-credit conversion policy behavior.
 */

import { describe, expect, it } from "vitest";
import { convertUsdToCredits, resolveModelCreditRoundingMode } from "../pricingCredits";

describe("pricingCredits", () => {
  it("does not apply extra round-nearest quantization by default", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.039,
    });
    expect(result).toEqual({
      rawCredits: 4,
      credits: 4,
      billedUsd: 0.04,
    });
  });

  it("ignores legacy global nearest-5 quantization by default", () => {
    const fluxLite = convertUsdToCredits({
      modelId: "fal-ai/flux-2/klein/9b",
      usdRaw: 0.00648,
    });
    const bria = convertUsdToCredits({
      modelId: "fal-ai/bria/background/remove",
      usdRaw: 0.018,
    });
    expect(fluxLite).toEqual({
      rawCredits: 1,
      credits: 1,
      billedUsd: 0.01,
    });
    expect(bria).toEqual({
      rawCredits: 2,
      credits: 2,
      billedUsd: 0.02,
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

  it("does not apply markup without a per-model markup value", () => {
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
    expect(withMarkup.rawCredits).toBe(5);
    expect(withMarkup.credits).toBe(5);
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

  it("ignores the legacy top-level markup field while applying conversion scale", () => {
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
      rawCredits: 8,
      credits: 8,
      billedUsd: 0.04,
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
      rawCredits: 8,
      credits: 8,
      billedUsd: 0.04,
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
      rawCredits: 5,
      credits: 5,
      billedUsd: 0.05,
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

  it("converts legacy exception ids into normal roundup increment overrides", () => {
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
      rawCredits: 1,
      credits: 1,
      billedUsd: 0.01,
    });
  });
});
