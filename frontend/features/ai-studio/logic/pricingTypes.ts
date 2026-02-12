/**
 * Pricing strategy identifiers and shared pricing types.
 */
export type PricingStrategyId =
  | "fal-per-mp"
  | "fal-flux2-per-mp"
  | "fal-flux2-klein-per-mp"
  | "fal-flux2-pro-per-mp"
  | "gpt-image-per-image"
  | "google-nano-banana-per-image"
  | "gpt41nano-per-token"
  | "nano-banana-per-image"
  | "seedream-per-image"
  | "veo-3-per-second"
  | "kling-3-per-second"
  | "sora-2-pro-per-second"
  | "seedance-1.5-per-second";

export type PricingParams = {
  modelId: string;
  aspect?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  resolution?: string;
  webSearch?: boolean;
  audio?: boolean;
  voiceControl?: boolean;
};

export type CostBreakdown = {
  credits: number;
  usd: number;
  megapixels: number;
  width: number;
  height: number;
};
