/**
 * Unit coverage for decimal-safe USD-to-credit conversion policy behavior.
 */

import { describe, expect, it } from "vitest";
import { convertUsdToCredits, resolveModelCreditRoundingMode } from "../pricingCredits";

describe("pricingCredits", () => {
  it("uses nearest-5 quantization by default", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.039,
    });
    expect(result).toEqual({
      rawCredits: 5,
      credits: 5,
      billedUsd: 0.05,
    });
  });

  it("uses global nearest-5 quantization for all models by default", () => {
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
      credits: 5,
      billedUsd: 0.05,
    });
    expect(bria).toEqual({
      rawCredits: 2,
      credits: 5,
      billedUsd: 0.05,
    });
  });

  it("handles boundary values near nearest-5 cutoffs", () => {
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
    expect(noMarkupAboveFive.credits).toBe(10);
  });

  it("applies markup before quantization", () => {
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
    expect(withMarkup.rawCredits).toBe(6);
    expect(withMarkup.credits).toBe(10);
  });

  it("resolves model rounding mode deterministically", () => {
    expect(resolveModelCreditRoundingMode("fal-ai/flux-2/klein/9b")).toBe("nearest-5");
    expect(resolveModelCreditRoundingMode("fal-ai/bria/background/remove")).toBe("nearest-5");
    expect(resolveModelCreditRoundingMode("fal-ai/nano-banana")).toBe("nearest-5");
  });

  it("applies a shared policy override for markup and conversion scale", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.039,
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 200,
          markupBps: 0,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
        },
        perModel: {},
      },
    });

    expect(result).toEqual({
      rawCredits: 8,
      credits: 10,
      billedUsd: 0.05,
    });
  });

  it("applies per-model markup overrides instead of layering on the global markup", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.039,
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          markupBps: 300,
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
      credits: 10,
      billedUsd: 0.1,
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
          markupBps: 300,
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
      rawCredits: 9,
      credits: 10,
      billedUsd: 0.05,
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
          markupBps: 300,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
        },
        perModel: {
          "fal-ai/nano-banana": {
            roundingIncrement: 1,
          },
        },
      },
    });

    expect(result).toEqual({
      rawCredits: 6,
      credits: 6,
      billedUsd: 0.06,
    });
  });

  it("preserves legacy multiplier overrides by converting them to equivalent markup overrides", () => {
    const result = convertUsdToCredits({
      modelId: "fal-ai/nano-banana",
      usdRaw: 0.039,
      policy: {
        schemaVersion: 1,
        global: {
          creditUsdScale: 100,
          markupBps: 300,
          defaultRoundingMode: "nearest-5",
          defaultRoundingIncrement: 5,
        },
        perModel: {
          "fal-ai/nano-banana": {
            // Legacy format from the first control-plane implementation.
            // Old behavior was global markup first, then 2x multiplier.
            // New normalization should preserve the same billed result.
            multiplierBps: 20_000,
            roundingIncrement: 1,
          } as never,
        },
      },
    });

    expect(result).toEqual({
      rawCredits: 9,
      credits: 9,
      billedUsd: 0.09,
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
          markupBps: 300,
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
