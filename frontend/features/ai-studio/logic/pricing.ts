import { getModelConfig } from "./modelRegistry";
import { resolveAspectSize, falImageSizeMap } from "./modelSizes";
import { pricingStrategies } from "./pricingStrategies";
import { CostBreakdown, PricingParams } from "./pricingTypes";

export { getModelConfig } from "./modelRegistry";
export { listModelConfigs } from "./modelRegistry";
export { falImageSizeMap } from "./modelSizes";
export type { CostBreakdown } from "./pricingTypes";

export const falSizeForAspect = (aspect: string) =>
  resolveAspectSize(aspect, falImageSizeMap, "4:3") ?? falImageSizeMap["4:3"];

export const computeCostForModel = (modelId: string, params: Omit<PricingParams, "modelId"> = {}): CostBreakdown | null => {
  const config = getModelConfig(modelId);
  if (!config) return null;

  const strategy = pricingStrategies[config.pricingStrategy];
  if (!strategy) return null;

  return strategy({ ...params, modelId });
};

// Backward-compatible helper for existing call sites.
export const computeFalFluxCost = (aspect: string): CostBreakdown => {
  const result = computeCostForModel("fal/flux-dev", { aspect });
  if (result) return result;
  return { credits: 0, usd: 0, megapixels: 0, width: 0, height: 0 };
};
