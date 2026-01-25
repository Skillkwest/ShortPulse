import { DEFAULT_KLING_DURATION_SECONDS, computeCostForModel } from "../pricing";
import { falImageSizeMap } from "../modelSizes";

describe("computeCostForModel (FLUX.2)", () => {
  const modelId = "fal/flux-2";

  it("uses explicit aspect when available", () => {
    const cost = computeCostForModel(modelId, { aspect: "16:9" });
    expect(cost).not.toBeNull();
    expect(cost?.width).toBe(falImageSizeMap["16:9"].width);
    expect(cost?.credits).toBeGreaterThan(0);
  });

  it("falls back to default aspect when unknown", () => {
    const cost = computeCostForModel(modelId, { aspect: "non-existent" });
    expect(cost).not.toBeNull();
    // defaultAspect for this model is 4:3 (see registry)
    expect(cost?.width).toBe(falImageSizeMap["4:3"].width);
  });

  it("rounds up credits per MP", () => {
    const cost = computeCostForModel(modelId, { aspect: "1:1" });
    expect(cost?.megapixels).toBeGreaterThan(1);
    const mp = (falImageSizeMap["1:1"].width * falImageSizeMap["1:1"].height) / 1_000_000;
    const usdRaw = mp * 0.012;
    const expectedCredits = Math.ceil(usdRaw / 0.01);
    expect(cost?.credits).toBe(expectedCredits);
  });
});

describe("computeCostForModel (GPT-4.1 Nano)", () => {
  const modelId = "gpt-4.1-nano";

  it("calculates credits from input/output tokens", () => {
    const cost = computeCostForModel(modelId, { inputTokens: 500, outputTokens: 700 });
    expect(cost).not.toBeNull();
    // USD = (500 * 0.10 / 1M) + (700 * 0.025 / 1M) = 0.0000675
    // credits = ceil(0.0000675 / 0.01) = 1
    expect(cost?.credits).toBe(1);
    expect(cost?.usd).toBeCloseTo(0.01); // credit conversion rounds up to $0.01 minimum
  });
});

describe("computeCostForModel (Kling 2.5 Turbo Pro)", () => {
  const modelId = "fal-ai/kling-video/v2.5-turbo/pro/image-to-video";

  it("uses base $0.35 for 5s (35 credits)", () => {
    const cost = computeCostForModel(modelId, { durationSeconds: 5 });
    expect(cost?.credits).toBe(35);
    expect(cost?.usd).toBeCloseTo(0.35, 2);
  });

  it("adds $0.07 per extra second and defaults to 10s (70 credits)", () => {
    const cost = computeCostForModel(modelId, {});
    expect(cost?.credits).toBe(70);
    expect(cost?.usd).toBeCloseTo(0.7, 2);
  });
});

describe("computeCostForModel (Kling 2.5 Turbo Text to Video)", () => {
  const modelId = "fal-ai/kling-video/v2.5-turbo/pro/text-to-video";

  it("defaults to 10s (base $0.35 + 5s * $0.07 = 70 credits)", () => {
    const cost = computeCostForModel(modelId, {});
    expect(cost?.credits).toBe(70);
    expect(cost?.usd).toBeCloseTo(0.7, 2);
  });
});

describe("computeCostForModel (Google Veo 3.1)", () => {
  const modelId = "fal-ai/veo3.1";

  it("defaults to 8s with audio at 1080p (8 * $0.40 = 320 credits)", () => {
    const cost = computeCostForModel(modelId, { durationSeconds: 8, resolution: "1080p", audio: true });
    expect(cost?.credits).toBe(320);
    expect(cost?.usd).toBeCloseTo(3.2, 2);
  });

  it("charges 0.60/sec for 4K with audio", () => {
    const cost = computeCostForModel(modelId, { durationSeconds: 5, resolution: "4k", audio: true });
    expect(cost?.credits).toBe(300);
  });
});

describe("computeCostForModel (Kling 2.6 Text to Video)", () => {
  const modelId = "fal-ai/kling-video/v2.6/pro/text-to-video";

  it("defaults to 10s with audio (10 * $0.14 = 140 credits)", () => {
    const cost = computeCostForModel(modelId, { durationSeconds: 10, audio: true });
    expect(cost?.credits).toBe(140);
    expect(cost?.usd).toBeCloseTo(1.4, 2);
  });

  it("allows audio off pricing at 7 credits/sec", () => {
    const cost = computeCostForModel(modelId, { durationSeconds: 10, audio: false });
    expect(cost?.credits).toBe(70);
  });
});

describe("computeCostForModel (Nano Banana Pro)", () => {
  const modelId = "fal-ai/nano-banana-pro";

  it("charges 15 credits per standard run", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K" });
    expect(cost).not.toBeNull();
    expect(cost?.credits).toBe(15);
    expect(cost?.usd).toBeCloseTo(0.15, 2);
  });

  it("doubles the price for 4K renders", () => {
    const cost = computeCostForModel(modelId, { resolution: "4K" });
    expect(cost?.credits).toBe(30);
  });

  it("adds a web search surcharge", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K", webSearch: true });
    expect(cost?.credits).toBe(17);
  });
});

describe("computeCostForModel (Seedream 4.5)", () => {
  const modelId = "fal-ai/bytedance/seedream/v4.5/text-to-image";

  it("charges 4 credits per standard run", () => {
    const cost = computeCostForModel(modelId, { resolution: "1K" });
    expect(cost).not.toBeNull();
    expect(cost?.credits).toBe(4);
    expect(cost?.usd).toBeCloseTo(0.04, 2);
  });

  it("doubles the price for 4K renders", () => {
    const cost = computeCostForModel(modelId, { resolution: "4K" });
    expect(cost?.credits).toBe(8);
  });
});
