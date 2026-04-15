/**
 * Pricing strategy identifiers and shared pricing types.
 */
export type PricingStrategyId =
  | "fal-per-mp"
  | "fal-flux2-per-mp"
  | "fal-flux2-klein-per-mp"
  | "fal-flux2-pro-per-mp"
  | "fal-flux-kontext-inpaint-per-mp"
  | "gpt-image-per-image"
  | "google-nano-banana-per-image"
  | "nano-banana-2-per-image"
  | "gpt41nano-per-token"
  | "nano-banana-per-image"
  | "seedream-per-image"
  | "seedream-5-lite-per-image"
  | "veo-3-per-second"
  | "kling-3-per-second"
  | "seedance-1.5-per-second"
  | "seedance-2-per-second"
  | "seedance-2-fast-per-second";

export type PricingParams = {
  modelId: string;
  aspect?: string;
  imageWidth?: number;
  imageHeight?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  resolution?: string;
  mode?: string;
  webSearch?: boolean;
  audio?: boolean;
  voiceControl?: boolean;
};

export type CostBreakdown = {
  credits: number;
  usd: number;
  rawCredits: number;
  usdRaw: number;
  megapixels: number;
  width: number;
  height: number;
};
