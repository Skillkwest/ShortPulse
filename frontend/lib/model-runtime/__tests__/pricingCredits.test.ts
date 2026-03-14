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

  it("uses ceil quantization for exception models", () => {
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
    expect(resolveModelCreditRoundingMode("fal-ai/flux-2/klein/9b")).toBe("ceil");
    expect(resolveModelCreditRoundingMode("fal-ai/bria/background/remove")).toBe("ceil");
    expect(resolveModelCreditRoundingMode("fal-ai/nano-banana")).toBe("nearest-5");
  });
});
