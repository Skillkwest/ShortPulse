/**
 * Registry of supported AI Studio models with metadata for UI and pricing.
 */
import { PricingStrategyId } from "./pricingTypes";
import { AspectSize, falImageSizeMap } from "./modelSizes";

export type ModelConfig = {
  id: string;
  label: string;
  provider: "fal" | "kei" | "openai" | "other";
  mediaType: "image" | "video" | "multi" | "text";
  defaultAspect: string;
  allowedAspects: string[];
  pricingStrategy: PricingStrategyId;
  sizeMap?: Record<string, AspectSize>;
};

const registry: Record<string, ModelConfig> = {
  "fal/flux-dev": {
    id: "fal/flux-dev",
    label: "Fal Flux Dev (Image)",
    provider: "fal",
    mediaType: "image",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    pricingStrategy: "fal-per-mp",
    sizeMap: falImageSizeMap,
  },
  "fal/kling-video-v1.6": {
    id: "fal/kling-video-v1.6",
    label: "Kling 1.6 (Image to Video)",
    provider: "fal",
    mediaType: "video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1"],
    pricingStrategy: "fal-kling-video-per-request",
  },
  "fal/kling-video-v1.6-text": {
    id: "fal/kling-video-v1.6-text",
    label: "Kling 1.6 (Text to Video)",
    provider: "fal",
    mediaType: "video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1"],
    pricingStrategy: "fal-kling-video-per-request",
  },
  "gpt-4.1-nano": {
    id: "gpt-4.1-nano",
    label: "GPT-4.1 Nano",
    provider: "openai",
    mediaType: "text",
    defaultAspect: "text",
    allowedAspects: [],
    pricingStrategy: "gpt41nano-per-token",
  },
};

export const getModelConfig = (id: string): ModelConfig | null => registry[id] ?? null;

export const listModelConfigs = (): ModelConfig[] => Object.values(registry);
