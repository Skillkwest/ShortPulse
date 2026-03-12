import { computeCostForModel } from "../pricing";
import { listModelConfigs } from "../modelRegistry";

const ONE_CREDIT_STRATEGIES = new Set(["fal-flux2-klein-per-mp"]);

describe("model pricing coverage", () => {
  it("returns a cost for every registered model with a pricing strategy", () => {
    const configs = listModelConfigs();
    const failures: string[] = [];

    configs.forEach((config) => {
      if (!config.pricingStrategy) return;
      const tryAspects = [config.defaultAspect, ...(config.allowedAspects ?? [])].filter(Boolean);

      const found = tryAspects.some((aspect) => {
        const result = computeCostForModel(config.id, { aspect });
        return Boolean(result);
      });

      if (!found) failures.push(config.id);
    });

    if (failures.length) {
      throw new Error(`Missing pricing coverage for: ${failures.join(", ")}`);
    }
  });

  it("applies model default rounding contracts (with explicit model exceptions)", () => {
    const configs = listModelConfigs().filter((config) => Boolean(config.pricingStrategy));

    configs.forEach((config) => {
      const estimate = computeCostForModel(config.id, {
        aspect: config.defaultAspect,
        durationSeconds: config.defaultDurationSeconds,
        resolution: config.defaultResolution,
        audio: config.defaultAudio,
      });

      expect(estimate).not.toBeNull();
      expect(estimate?.credits).toBeGreaterThan(0);
      if (ONE_CREDIT_STRATEGIES.has(config.pricingStrategy)) {
        expect(estimate?.credits).toBe(1);
      } else {
        expect((estimate?.credits ?? 0) % 5).toBe(0);
      }
      expect(estimate?.rawCredits).toBeLessThanOrEqual(estimate?.credits ?? 0);
      expect(estimate?.usd).toBeCloseTo((estimate?.credits ?? 0) * 0.01, 6);
      expect(estimate?.usdRaw).toBeLessThanOrEqual((estimate?.usd ?? 0) + Number.EPSILON);
    });
  });
});
