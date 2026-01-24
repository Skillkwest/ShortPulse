import { computeCostForModel } from "../pricing";
import { listModelConfigs } from "../modelRegistry";

describe("model pricing coverage", () => {
  it("returns a cost for every registered model with a pricing strategy", () => {
    const configs = listModelConfigs();
    const failures: string[] = [];

    configs.forEach((config) => {
      if (!config.pricingStrategy) return;
      const tryAspects = [
        config.defaultAspect,
        ...(config.allowedAspects ?? []),
      ].filter(Boolean);

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
});
