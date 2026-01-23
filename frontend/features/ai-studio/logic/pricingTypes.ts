export type PricingStrategyId = "fal-per-mp" | "gpt41nano-per-token";

export type PricingParams = {
  modelId: string;
  aspect?: string;
  inputTokens?: number;
  outputTokens?: number;
};

export type CostBreakdown = {
  credits: number;
  usd: number;
  megapixels: number;
  width: number;
  height: number;
};
