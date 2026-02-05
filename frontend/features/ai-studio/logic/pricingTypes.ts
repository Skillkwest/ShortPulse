export type PricingStrategyId =
  | "fal-per-mp"
  | "fal-flux1-schnell-per-mp"
  | "fal-flux2-per-mp"
  | "fal-flux2-klein-per-mp"
  | "fal-flux2-max-per-mp"
  | "fal-flux2-pro-per-mp"
  | "imagen4-fast-per-image"
  | "google-nano-banana-per-image"
  | "gpt41nano-per-token"
  | "nano-banana-per-image"
  | "seedream-per-image"
  | "kling-2.5-per-duration"
  | "veo-3-per-second"
  | "kling-2.6-per-second"
  | "kling-2.6-motion-per-second"
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
};

export type CostBreakdown = {
  credits: number;
  usd: number;
  megapixels: number;
  width: number;
  height: number;
};
