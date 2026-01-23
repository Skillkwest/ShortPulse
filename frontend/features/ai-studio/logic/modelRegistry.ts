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
