import { computeCostForModel } from "../pricing";
import { falImageSizeMap } from "../modelSizes";

describe("computeCostForModel (Fal Flux Dev)", () => {
  const modelId = "fal/flux-dev";

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
    // Credits: ceil(mp) * 2.5 then ceil
    const roundedMp = Math.ceil((falImageSizeMap["1:1"].width * falImageSizeMap["1:1"].height) / 1_000_000);
    const expectedCredits = Math.ceil(2.5 * roundedMp);
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
