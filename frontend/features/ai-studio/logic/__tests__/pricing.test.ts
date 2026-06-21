/**
 * Regression coverage for model pricing formulas and policy conversion outputs.
 */

import { describe, expect, it } from "vitest";
import { computeCostForModel, falImageSizeMap, getModelConfig } from "../pricing";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../lib/model-runtime/providerModelIds";

const expectDefaultMarkedUpCredits = (
  cost: ReturnType<typeof computeCostForModel>,
  usdRaw: number,
  precision = 6
) => {
  expect(cost).not.toBeNull();
  expect(cost?.usdRaw).toBeCloseTo(usdRaw, precision);
  const expectedCredits = Math.ceil(usdRaw * 160);
  expect(cost?.rawCredits).toBe(expectedCredits);
  expect(cost?.credits).toBe(expectedCredits);
  expect(cost?.usd).toBeCloseTo(expectedCredits / 100, 6);
};

describe("computeCostForModel (economy image lane)", () => {
  const modelId = "fal-ai/flux-2/klein/9b";

  it("uses explicit aspect when available", () => {
    const cost = computeCostForModel(modelId, { aspect: "16:9" });
    expect(cost).not.toBeNull();
    expect(cost?.width).toBe(falImageSizeMap["16:9"].width);
    expect(cost?.height).toBe(falImageSizeMap["16:9"].height);
    expect(cost?.credits).toBeGreaterThan(0);
  });

  it("falls back to default aspect when unknown", () => {
    const cost = computeCostForModel(modelId, { aspect: "non-existent" });
    expect(cost).not.toBeNull();
    expect(cost?.width).toBe(falImageSizeMap["4:3"].width);
    expect(cost?.height).toBe(falImageSizeMap["4:3"].height);
  });

  it("applies the at-cost credit ceiling by default", () => {
    const cost = computeCostForModel(modelId, { aspect: "1:1" });
    expect(cost?.megapixels).toBeCloseTo(1.048576, 6);
    expectDefaultMarkedUpCredits(cost, 0.006291456, 9);
  });

  it("uses explicit image dimensions when provided", () => {
    const cost = computeCostForModel(modelId, { imageWidth: 4096, imageHeight: 4096 });
    expect(cost?.width).toBe(4096);
    expect(cost?.height).toBe(4096);
    expectDefaultMarkedUpCredits(cost, 0.100663296, 9);
  });
});

describe("computeCostForModel (FLUX.2 Lite + Bria rounding)", () => {
  it("does not apply global round-nearest quantization for fal-ai/flux-2/klein/9b by default", () => {
    const cost = computeCostForModel("fal-ai/flux-2/klein/9b", { aspect: "4:3" });
    expectDefaultMarkedUpCredits(cost, 0.00648, 6);
  });

  it("keeps FLUX.2 Lite dynamic for large explicit dimensions", () => {
    const cost = computeCostForModel("fal-ai/flux-2/klein/9b", {
      imageWidth: 4096,
      imageHeight: 4096,
    });
    expectDefaultMarkedUpCredits(cost, 0.100663296, 9);
  });

  it("does not apply global round-nearest quantization for fal-ai/bria/background/remove by default", () => {
    const cost = computeCostForModel("fal-ai/bria/background/remove", {
      imageWidth: 1024,
      imageHeight: 1024,
    });
    expectDefaultMarkedUpCredits(cost, 0.018, 6);
  });
});

describe("computeCostForModel (FLUX edit/fill lanes)", () => {
  it("uses raw megapixels * $0.05 for fal-ai/flux-pro/v1/fill", () => {
    const cost = computeCostForModel("fal-ai/flux-pro/v1/fill", { aspect: "1:1" });
    expectDefaultMarkedUpCredits(cost, 0.0524288, 9);
  });

  it("uses raw megapixels * $0.035 for fal-ai/flux-kontext-lora/inpaint", () => {
    const cost = computeCostForModel("fal-ai/flux-kontext-lora/inpaint", { aspect: "1:1" });
    expectDefaultMarkedUpCredits(cost, 0.03670016, 9);
  });
});

describe("computeCostForModel (GPT-5.4 Nano helper lane)", () => {
  it("calculates non-zero cost from token usage", () => {
    const cost = computeCostForModel("gpt-5.4-nano", { inputTokens: 500, outputTokens: 700 });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.000975, 9);
    expect(cost?.rawCredits).toBe(1);
    expect(cost?.credits).toBe(1);
    expect(cost?.usd).toBeCloseTo(0.01, 6);
  });
});

describe("computeCostForModel (Veo 3.1)", () => {
  it("uses fixed per-video pricing for kie-ai/veo-3.1-fast-i2v", () => {
    const cost = computeCostForModel(KIE_VEO_31_FAST_I2V_MODEL_ID, {
      durationSeconds: 6,
      resolution: "720p",
      audio: true,
    });
    expectDefaultMarkedUpCredits(cost, 0.4, 6);
  });

  it("keeps kie-ai/veo-3.1-fast-i2v pricing invariant across duration/resolution/audio inputs", () => {
    const cases = [
      { durationSeconds: 4, resolution: "720p", audio: true },
      { durationSeconds: 6, resolution: "720p", audio: false },
      { durationSeconds: 8, resolution: "720p", audio: false },
      { durationSeconds: 4, resolution: "1080p", audio: true },
      { durationSeconds: 8, resolution: "1080p", audio: false },
    ] as const;

    for (const params of cases) {
      const cost = computeCostForModel(KIE_VEO_31_FAST_I2V_MODEL_ID, params);
      expectDefaultMarkedUpCredits(cost, 0.4, 6);
    }
  });
});

describe("computeCostForModel (Kling 3.0)", () => {
  it("uses kie-ai/kling-3.0 pro-mode per-second rates at cost", () => {
    const cost = computeCostForModel(KIE_KLING_30_MODEL_ID, {
      durationSeconds: 4,
      resolution: "1080p",
      mode: "pro",
      audio: false,
    });
    expectDefaultMarkedUpCredits(cost, 0.36, 6);
  });

  it("uses kie-ai/kling-3.0 std-mode per-second rates at cost", () => {
    const cost = computeCostForModel(KIE_KLING_30_MODEL_ID, {
      durationSeconds: 4,
      resolution: "720p",
      mode: "std",
      audio: false,
    });
    expectDefaultMarkedUpCredits(cost, 0.28, 6);
  });

  it("falls back to resolution-derived mode when explicit mode is absent", () => {
    const cost = computeCostForModel(KIE_KLING_30_MODEL_ID, {
      durationSeconds: 3,
      resolution: "720p",
      audio: false,
    });
    expectDefaultMarkedUpCredits(cost, 0.21, 6);
  });

  it("advertises the full active Kling duration range", () => {
    expect(getModelConfig(KIE_KLING_30_MODEL_ID)?.minDurationSeconds).toBe(3);
    expect(getModelConfig(KIE_KLING_30_MODEL_ID)?.maxDurationSeconds).toBe(15);
  });
});

describe("computeCostForModel (Kie Seedance 2)", () => {
  it("prices 15s Seedance 2 generations at the full submitted duration", () => {
    const tenSecondCost = computeCostForModel(KIE_SEEDANCE_2_MODEL_ID, {
      durationSeconds: 10,
      resolution: "1080p",
      audio: true,
    });
    const fifteenSecondCost = computeCostForModel(KIE_SEEDANCE_2_MODEL_ID, {
      durationSeconds: 15,
      resolution: "1080p",
      audio: true,
    });

    expect(tenSecondCost).not.toBeNull();
    expect(fifteenSecondCost).not.toBeNull();
    expect(fifteenSecondCost?.usdRaw).toBeCloseTo((tenSecondCost?.usdRaw ?? 0) * 1.5, 6);
  });

  it("advertises 15s as the max for both Seedance 2 pricing configs", () => {
    expect(getModelConfig(KIE_SEEDANCE_2_MODEL_ID)?.minDurationSeconds).toBe(4);
    expect(getModelConfig(KIE_SEEDANCE_2_MODEL_ID)?.maxDurationSeconds).toBe(15);
    expect(getModelConfig(KIE_SEEDANCE_2_FAST_MODEL_ID)?.minDurationSeconds).toBe(4);
    expect(getModelConfig(KIE_SEEDANCE_2_FAST_MODEL_ID)?.maxDurationSeconds).toBe(15);
  });
});

describe("computeCostForModel (Nano Banana Pro)", () => {
  const modelId = "fal-ai/nano-banana-pro";

  it("applies the at-cost credit ceiling for standard runs", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K" });
    expectDefaultMarkedUpCredits(cost, 0.15, 6);
  });

  it("doubles the base price for 4K renders", () => {
    const cost = computeCostForModel(modelId, { resolution: "4K" });
    expectDefaultMarkedUpCredits(cost, 0.3, 6);
  });

  it("adds web search surcharge", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K", webSearch: true });
    expectDefaultMarkedUpCredits(cost, 0.165, 6);
  });
});

describe("computeCostForModel (Nano Banana 2)", () => {
  const modelId = "fal-ai/nano-banana-2";

  it("charges 8 credits for 1K defaults", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K" });
    expectDefaultMarkedUpCredits(cost, 0.08, 6);
  });

  it("supports 0.5K pricing multiplier", () => {
    const cost = computeCostForModel(modelId, { resolution: "0.5K" });
    expectDefaultMarkedUpCredits(cost, 0.06, 6);
  });

  it("charges 12 credits at 2K", () => {
    const cost = computeCostForModel(modelId, { resolution: "2K" });
    expectDefaultMarkedUpCredits(cost, 0.12, 6);
  });

  it("charges 16 credits at 4K", () => {
    const cost = computeCostForModel(modelId, { resolution: "4K" });
    expectDefaultMarkedUpCredits(cost, 0.16, 6);
  });

  it("adds web search surcharge and keeps credit ceiling", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K", webSearch: true });
    expectDefaultMarkedUpCredits(cost, 0.095, 6);
  });
});

describe("computeCostForModel (Seedream)", () => {
  it("charges the ceiled credit value at standard resolution", () => {
    const cost = computeCostForModel("fal-ai/bytedance/seedream/v4.5/text-to-image", {
      resolution: "1K",
    });
    expectDefaultMarkedUpCredits(cost, 0.04, 6);
  });

  it("uses doubled raw usd for 4K inputs", () => {
    const cost = computeCostForModel("fal-ai/bytedance/seedream/v4.5/text-to-image", {
      resolution: "4K",
    });
    expectDefaultMarkedUpCredits(cost, 0.08, 6);
  });

  it("keeps seedream 5 lite flat across auto_2K and auto_3K", () => {
    const auto2k = computeCostForModel("fal-ai/bytedance/seedream/v5/lite/text-to-image", {
      resolution: "auto_2K",
    });
    const auto3k = computeCostForModel("fal-ai/bytedance/seedream/v5/lite/text-to-image", {
      resolution: "auto_3K",
    });
    expectDefaultMarkedUpCredits(auto2k, 0.035, 6);
    expect(auto3k).not.toBeNull();
    expect(auto2k?.usdRaw).toBeCloseTo(auto3k?.usdRaw ?? 0, 6);
    expect(auto2k?.credits).toBe(auto3k?.credits);
  });
});
