/**
 * Regression coverage for model pricing formulas and policy conversion outputs.
 */

import { describe, expect, it } from "vitest";
import { falImageSizeMap } from "../modelSizes";
import { computeCostForModel } from "../pricing";

describe("computeCostForModel (FLUX.2)", () => {
  const modelId = "fal/flux-2";

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
    expect(cost?.usdRaw).toBeCloseTo(0.012582912, 9);
    expect(cost?.rawCredits).toBe(2);
    expect(cost?.credits).toBe(5);
  });

  it("uses explicit image dimensions when provided", () => {
    const cost = computeCostForModel(modelId, { imageWidth: 4096, imageHeight: 4096 });
    expect(cost).not.toBeNull();
    expect(cost?.width).toBe(4096);
    expect(cost?.height).toBe(4096);
    expect(cost?.rawCredits).toBe(21);
    expect(cost?.credits).toBe(25);
  });
});

describe("computeCostForModel (FLUX.2 Lite + Bria exceptions)", () => {
  it("uses ceil quantization for fal-ai/flux-2/klein/9b", () => {
    const cost = computeCostForModel("fal-ai/flux-2/klein/9b", { aspect: "4:3" });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.00648, 6);
    expect(cost?.rawCredits).toBe(1);
    expect(cost?.credits).toBe(1);
  });

  it("keeps FLUX.2 Lite dynamic for large explicit dimensions", () => {
    const cost = computeCostForModel("fal-ai/flux-2/klein/9b", {
      imageWidth: 4096,
      imageHeight: 4096,
    });
    expect(cost).not.toBeNull();
    expect(cost?.rawCredits).toBe(11);
    expect(cost?.credits).toBe(11);
  });

  it("uses ceil quantization for fal-ai/bria/background/remove", () => {
    const cost = computeCostForModel("fal-ai/bria/background/remove", {
      imageWidth: 1024,
      imageHeight: 1024,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.018, 6);
    expect(cost?.rawCredits).toBe(2);
    expect(cost?.credits).toBe(2);
  });
});

describe("computeCostForModel (FLUX edit/fill lanes)", () => {
  it("includes normalized 1MP input cost for fal/flux-2/edit", () => {
    const cost = computeCostForModel("fal/flux-2/edit", { aspect: "4:3" });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.02496, 6);
    expect(cost?.rawCredits).toBe(3);
    expect(cost?.credits).toBe(5);
  });

  it("uses ceil(MP) * $0.05 for fal-ai/flux-pro/v1/fill", () => {
    const cost = computeCostForModel("fal-ai/flux-pro/v1/fill", { aspect: "1:1" });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.1, 6);
    expect(cost?.rawCredits).toBe(11);
    expect(cost?.credits).toBe(15);
  });

  it("prices fal/flux-2-pro/edit with normalized input MP and markup", () => {
    const cost = computeCostForModel("fal/flux-2-pro/edit", {
      imageWidth: 1024,
      imageHeight: 1024,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.06, 6);
    expect(cost?.rawCredits).toBe(7);
    expect(cost?.credits).toBe(10);
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
  const modelId = "fal-ai/veo3.1";

  it("defaults to 8s with audio at 1080p", () => {
    const cost = computeCostForModel(modelId, {
      durationSeconds: 8,
      resolution: "1080p",
      audio: true,
    });
    expect(cost?.usdRaw).toBeCloseTo(3.2, 6);
    expect(cost?.rawCredits).toBe(330);
    expect(cost?.credits).toBe(330);
  });

  it("charges 0.60/sec for 4K with audio", () => {
    const cost = computeCostForModel(modelId, {
      durationSeconds: 5,
      resolution: "4k",
      audio: true,
    });
    expect(cost?.usdRaw).toBeCloseTo(3, 6);
    expect(cost?.rawCredits).toBe(309);
    expect(cost?.credits).toBe(310);
  });

  it("uses fixed per-video pricing for kie-ai/veo-3.1-fast-i2v", () => {
    const cost = computeCostForModel("kie-ai/veo-3.1-fast-i2v", {
      durationSeconds: 5,
      resolution: "720p",
      audio: true,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(0.3, 6);
    expect(cost?.rawCredits).toBe(31);
    expect(cost?.credits).toBe(35);
  });

  it("keeps kie-ai/veo-3.1-fast-i2v pricing invariant across duration/resolution/audio inputs", () => {
    const cases = [
      { durationSeconds: 5, resolution: "720p", audio: true },
      { durationSeconds: 8, resolution: "720p", audio: false },
      { durationSeconds: 5, resolution: "1080p", audio: true },
      { durationSeconds: 8, resolution: "1080p", audio: false },
    ] as const;

    for (const params of cases) {
      const cost = computeCostForModel("kie-ai/veo-3.1-fast-i2v", params);
      expect(cost).not.toBeNull();
      expect(cost?.usdRaw).toBeCloseTo(0.3, 6);
      expect(cost?.rawCredits).toBe(31);
      expect(cost?.credits).toBe(35);
    }
  });
});

describe("computeCostForModel (Kling 3.0)", () => {
  const falModelId = "fal-ai/kling-video/v3/pro/image-to-video";

  it("charges $0.112/sec with audio off", () => {
    const cost = computeCostForModel(falModelId, { durationSeconds: 5, audio: false });
    expect(cost?.usdRaw).toBeCloseTo(0.56, 6);
    expect(cost?.rawCredits).toBe(58);
    expect(cost?.credits).toBe(60);
  });

  it("charges $0.168/sec with audio on", () => {
    const cost = computeCostForModel(falModelId, { durationSeconds: 5, audio: true });
    expect(cost?.usdRaw).toBeCloseTo(0.84, 6);
    expect(cost?.rawCredits).toBe(87);
    expect(cost?.credits).toBe(90);
  });

  it("charges $0.196/sec when voice control is used with audio", () => {
    const cost = computeCostForModel(falModelId, {
      durationSeconds: 5,
      audio: true,
      voiceControl: true,
    });
    expect(cost?.usdRaw).toBeCloseTo(0.98, 6);
    expect(cost?.rawCredits).toBe(101);
    expect(cost?.credits).toBe(105);
  });

  it("uses kie-ai/kling-3.0 1080p per-second rates with markup", () => {
    const cost = computeCostForModel("kie-ai/kling-3.0", {
      durationSeconds: 10,
      resolution: "1080p",
      audio: true,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(2, 6);
    expect(cost?.rawCredits).toBe(206);
    expect(cost?.credits).toBe(210);
  });

  it("uses kie-ai/kling-3.0 720p per-second rates with markup", () => {
    const cost = computeCostForModel("kie-ai/kling-3.0", {
      durationSeconds: 10,
      resolution: "720p",
      audio: false,
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(1, 6);
    expect(cost?.rawCredits).toBe(103);
    expect(cost?.credits).toBe(105);
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

describe("computeCostForModel (Sora 2 Pro)", () => {
  const modelId = "fal-ai/sora-2/text-to-video/pro";

  it("uses 1080p per-second pricing at default duration", () => {
    const cost = computeCostForModel(modelId, {
      durationSeconds: 8,
      resolution: "1080p",
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(4, 6);
    expect(cost?.rawCredits).toBe(412);
    expect(cost?.credits).toBe(415);
  });

  it("uses 720p per-second pricing", () => {
    const cost = computeCostForModel(modelId, {
      durationSeconds: 8,
      resolution: "720p",
    });
    expect(cost).not.toBeNull();
    expect(cost?.usdRaw).toBeCloseTo(2.4, 6);
    expect(cost?.rawCredits).toBe(248);
    expect(cost?.credits).toBe(250);
  });
});
