import { getModelConfig } from "./modelRegistry";
import { resolveAspectSize } from "./modelSizes";
import { CostBreakdown, PricingParams, PricingStrategyId } from "./pricingTypes";

const FAL_COST_PER_MP_USD = 0.025;
const CREDIT_VALUE_USD = 0.01;

type StrategyFn = (params: PricingParams) => CostBreakdown | null;

const computeFalPerMpCost: StrategyFn = ({ modelId, aspect }) => {
  const config = getModelConfig(modelId);
  if (!config?.sizeMap) return null;

  const size = resolveAspectSize(aspect, config.sizeMap, config.defaultAspect);
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const roundedMp = Math.ceil(megapixels);
  const credits = Math.ceil((FAL_COST_PER_MP_USD / CREDIT_VALUE_USD) * roundedMp);
  const usd = credits * CREDIT_VALUE_USD;

  return { credits, usd, megapixels, width: size.width, height: size.height };
};

const computeGpt41NanoPerTokenCost: StrategyFn = ({ inputTokens = 0, outputTokens = 0 }) => {
  // Rates are per 1M tokens: input $0.10, output $0.025.
  const INPUT_USD_PER_M = 0.10;
  const OUTPUT_USD_PER_M = 0.025;
  const totalUsd =
    ((Math.max(0, inputTokens) / 1_000_000) * INPUT_USD_PER_M) +
    ((Math.max(0, outputTokens) / 1_000_000) * OUTPUT_USD_PER_M);
  const credits = Math.max(1, Math.ceil(totalUsd / CREDIT_VALUE_USD));
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

export const pricingStrategies: Record<PricingStrategyId, StrategyFn> = {
  "fal-per-mp": computeFalPerMpCost,
  "gpt41nano-per-token": computeGpt41NanoPerTokenCost,
};
