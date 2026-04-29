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

  it("applies markup before nearest-5 quantization", () => {
    const cost = computeCostForModel(modelId, { aspect: "1:1" });
    expect(cost).not.toBeNull();
    expect(cost?.megapixels).toBeCloseTo(1.048576, 6);
    expect(cost?.usdRaw).toBeCloseTo(0.006291456, 9);
    expect(cost?.rawCredits).toBe(1);
    expect(cost?.credits).toBe(5);
  });

  it("uses explicit image dimensions when provided", () => {
    const cost = computeCostForModel(modelId, { imageWidth: 4096, imageHeight: 4096 });
    expect(cost).not.toBeNull();
    expect(cost?.width).toBe(4096);
    expect(cost?.height).toBe(4096);
    expect(cost?.rawCredits).toBe(11);
    expect(cost?.credits).toBe(15);
  });
});

describe("computeCostForModel (FLUX.2 Lite + Bria rounding)", () => {
  it("uses shared nearest-5 quantization for fal-ai/flux-2/klein/9b by default", () => {
    const cost = computeCostForModel("fal-ai/flux-2/klein/9b", { aspect: "4:3" });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.00648, 6);
    expect(cost?.rawCredits).toBe(1);
    expect(cost?.credits).toBe(5);
  });

  it("keeps FLUX.2 Lite dynamic for large explicit dimensions", () => {
    const cost = computeCostForModel("fal-ai/flux-2/klein/9b", {
      imageWidth: 4096,
      imageHeight: 4096,
    });
    expect(cost).not.toBeNull();
    expect(cost?.rawCredits).toBe(11);
    expect(cost?.credits).toBe(15);
  });

  it("uses shared nearest-5 quantization for fal-ai/bria/background/remove by default", () => {
    const cost = computeCostForModel("fal-ai/bria/background/remove", {
      imageWidth: 1024,
      imageHeight: 1024,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.018, 6);
    expect(cost?.rawCredits).toBe(2);
    expect(cost?.credits).toBe(5);
  });
});

describe("computeCostForModel (FLUX edit/fill lanes)", () => {
  it("uses ceil(MP) * $0.05 for fal-ai/flux-pro/v1/fill", () => {
    const cost = computeCostForModel("fal-ai/flux-pro/v1/fill", { aspect: "1:1" });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.1, 6);
    expect(cost?.rawCredits).toBe(11);
    expect(cost?.credits).toBe(15);
  });
});

describe("computeCostForModel (GPT-5 Nano helper lane)", () => {
  it("calculates non-zero cost from token usage", () => {
    const cost = computeCostForModel("gpt-5-nano", { inputTokens: 500, outputTokens: 700 });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.0000675, 9);
    expect(cost?.rawCredits).toBe(1);
    expect(cost?.credits).toBe(5);
    expect(cost?.usd).toBeCloseTo(0.05, 6);
  });
});

describe("computeCostForModel (Veo 3.1)", () => {
  it("uses fixed per-video pricing for kie-ai/veo-3.1-fast-i2v", () => {
    const cost = computeCostForModel(KIE_VEO_31_FAST_I2V_MODEL_ID, {
      durationSeconds: 5,
      resolution: "720p",
      audio: true,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.4, 6);
    expect(cost?.rawCredits).toBe(42);
    expect(cost?.credits).toBe(45);
  });

  it("keeps kie-ai/veo-3.1-fast-i2v pricing invariant across duration/resolution/audio inputs", () => {
    const cases = [
      { durationSeconds: 5, resolution: "720p", audio: true },
      { durationSeconds: 8, resolution: "720p", audio: false },
      { durationSeconds: 5, resolution: "1080p", audio: true },
      { durationSeconds: 8, resolution: "1080p", audio: false },
    ] as const;

    for (const params of cases) {
      const cost = computeCostForModel(KIE_VEO_31_FAST_I2V_MODEL_ID, params);
      expect(cost).not.toBeNull();
      expect(cost?.usdRaw).toBeCloseTo(0.4, 6);
      expect(cost?.rawCredits).toBe(42);
      expect(cost?.credits).toBe(45);
    }
  });
});

describe("computeCostForModel (Kling 3.0)", () => {
  it("uses kie-ai/kling-3.0 pro-mode per-second rates with markup", () => {
    const cost = computeCostForModel(KIE_KLING_30_MODEL_ID, {
      durationSeconds: 4,
      resolution: "1080p",
      mode: "pro",
      audio: false,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.36, 6);
    expect(cost?.rawCredits).toBe(38);
    expect(cost?.credits).toBe(40);
  });

  it("uses kie-ai/kling-3.0 std-mode per-second rates with markup", () => {
    const cost = computeCostForModel(KIE_KLING_30_MODEL_ID, {
      durationSeconds: 4,
      resolution: "720p",
      mode: "std",
      audio: false,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.28, 6);
    expect(cost?.rawCredits).toBe(29);
    expect(cost?.credits).toBe(30);
  });

  it("falls back to resolution-derived mode when explicit mode is absent", () => {
    const cost = computeCostForModel(KIE_KLING_30_MODEL_ID, {
      durationSeconds: 3,
      resolution: "720p",
      audio: false,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.21, 6);
    expect(cost?.rawCredits).toBe(22);
    expect(cost?.credits).toBe(25);
  });
});

describe("computeCostForModel (Kie Seedance 1.5)", () => {
  it("matches observed 4s 720p audio-off Kie pricing", () => {
    const cost = computeCostForModel("kie-ai/seedance-1.5-pro", {
      durationSeconds: 4,
      resolution: "720p",
      audio: false,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.07, 6);
    expect(cost?.rawCredits).toBe(8);
    expect(cost?.credits).toBe(10);
  });

  it("matches observed 12s 1080p audio-off Kie pricing", () => {
    const cost = computeCostForModel("kie-ai/seedance-1.5-pro", {
      durationSeconds: 12,
      resolution: "1080p",
      audio: false,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.45, 6);
    expect(cost?.rawCredits).toBe(47);
    expect(cost?.credits).toBe(50);
  });

  it("matches observed 12s 720p audio-on Kie pricing", () => {
    const cost = computeCostForModel("kie-ai/seedance-1.5-pro", {
      durationSeconds: 12,
      resolution: "720p",
      audio: true,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.42, 6);
    expect(cost?.rawCredits).toBe(44);
    expect(cost?.credits).toBe(45);
  });

  it("matches observed 12s 1080p audio-on Kie pricing", () => {
    const cost = computeCostForModel("kie-ai/seedance-1.5-pro", {
      durationSeconds: 12,
      resolution: "1080p",
      audio: true,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.9, 6);
    expect(cost?.rawCredits).toBe(93);
    expect(cost?.credits).toBe(95);
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
    expect(getModelConfig(KIE_SEEDANCE_2_MODEL_ID)?.maxDurationSeconds).toBe(15);
    expect(getModelConfig(KIE_SEEDANCE_2_FAST_MODEL_ID)?.maxDurationSeconds).toBe(15);
  });
});

describe("computeCostForModel (Nano Banana Pro)", () => {
  const modelId = "fal-ai/nano-banana-pro";

  it("applies markup and nearest-5 quantization for standard runs", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K" });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.15, 6);
    expect(cost?.rawCredits).toBe(16);
    expect(cost?.credits).toBe(20);
  });

  it("doubles the base price for 4K renders", () => {
    const cost = computeCostForModel(modelId, { resolution: "4K" });
    expect(cost?.rawCredits).toBe(31);
    expect(cost?.credits).toBe(35);
  });

  it("adds web search surcharge", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K", webSearch: true });
    expect(cost?.rawCredits).toBe(17);
    expect(cost?.credits).toBe(20);
  });
});

describe("computeCostForModel (Nano Banana 2)", () => {
  const modelId = "fal-ai/nano-banana-2";

  it("charges 10 credits for 1K defaults", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K" });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.08, 6);
    expect(cost?.rawCredits).toBe(9);
    expect(cost?.credits).toBe(10);
  });

  it("supports 0.5K pricing multiplier", () => {
    const cost = computeCostForModel(modelId, { resolution: "0.5K" });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.06, 6);
    expect(cost?.rawCredits).toBe(7);
    expect(cost?.credits).toBe(10);
  });

  it("charges 15 credits at 2K", () => {
    const cost = computeCostForModel(modelId, { resolution: "2K" });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.12, 6);
    expect(cost?.rawCredits).toBe(13);
    expect(cost?.credits).toBe(15);
  });

  it("charges 20 credits at 4K", () => {
    const cost = computeCostForModel(modelId, { resolution: "4K" });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.16, 6);
    expect(cost?.rawCredits).toBe(17);
    expect(cost?.credits).toBe(20);
  });

  it("adds web search surcharge and keeps nearest-5 quantization", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K", webSearch: true });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.095, 6);
    expect(cost?.rawCredits).toBe(10);
    expect(cost?.credits).toBe(10);
  });
});

describe("computeCostForModel (Seedream)", () => {
  it("charges a rounded 5-credit minimum at standard resolution", () => {
    const cost = computeCostForModel("fal-ai/bytedance/seedream/v4.5/text-to-image", {
      resolution: "1K",
    });
    expect(cost).not.toBeNull();
    expect(cost?.rawCredits).toBe(5);
    expect(cost?.credits).toBe(5);
    expect(cost?.usd).toBeCloseTo(0.05, 6);
  });

  it("uses doubled raw usd for 4K inputs", () => {
    const cost = computeCostForModel("fal-ai/bytedance/seedream/v4.5/text-to-image", {
      resolution: "4K",
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.08, 6);
    expect(cost?.rawCredits).toBe(9);
    expect(cost?.credits).toBe(10);
  });

  it("keeps seedream 5 lite flat across auto_2K and auto_3K", () => {
    const auto2k = computeCostForModel("fal-ai/bytedance/seedream/v5/lite/text-to-image", {
      resolution: "auto_2K",
    });
    const auto3k = computeCostForModel("fal-ai/bytedance/seedream/v5/lite/text-to-image", {
      resolution: "auto_3K",
    });
    expect(auto2k).not.toBeNull();
    expect(auto3k).not.toBeNull();
    expect(auto2k?.usdRaw).toBeCloseTo(0.035, 6);
    expect(auto2k?.rawCredits).toBe(4);
    expect(auto2k?.credits).toBe(5);
    expect(auto2k?.usdRaw).toBeCloseTo(auto3k?.usdRaw ?? 0, 6);
    expect(auto2k?.credits).toBe(auto3k?.credits);
  });
});
