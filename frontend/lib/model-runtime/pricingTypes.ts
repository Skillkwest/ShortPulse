/**
 * Pricing strategy identifiers and shared pricing types.
 */
import type { ModelPricingPolicyDocument } from "./pricingPolicy";

export type PricingStrategyId =
  | "elevenlabs-music-per-minute"
  | "elevenlabs-sound-effect"
  | "elevenlabs-text-to-speech-per-kchar"
  | "elevenlabs-voice-changer-per-minute"
  | "fal-per-mp"
  | "fal-economy-image-per-mp"
  | "fal-fill-per-mp"
  | "fal-flux-kontext-inpaint-per-mp"
  | "gpt-image-2-per-image"
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
  size?: string;
  quality?: string;
  inputTokens?: number;
  outputTokens?: number;
  durationSeconds?: number;
  generationCount?: number;
  resolution?: string;
  mode?: string;
  sourceDurationSeconds?: number;
  textCharacters?: number;
  webSearch?: boolean;
  audio?: boolean;
  voiceControl?: boolean;
  pricingPolicy?: ModelPricingPolicyDocument | null;
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
