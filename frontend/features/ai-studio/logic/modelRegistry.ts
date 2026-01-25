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
  defaultDurationSeconds?: number;
  defaultResolution?: string;
  defaultAudio?: boolean;
};

const registry: Record<string, ModelConfig> = {
  "fal/flux-2": {
    id: "fal/flux-2",
    label: "FLUX.2",
    provider: "fal",
    mediaType: "image",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    pricingStrategy: "fal-flux2-per-mp",
    sizeMap: falImageSizeMap,
  },
  "fal/flux-2-pro": {
    id: "fal/flux-2-pro",
    label: "FLUX.2 Pro",
    provider: "fal",
    mediaType: "image",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    pricingStrategy: "fal-flux2-pro-per-mp",
    sizeMap: falImageSizeMap,
  },
  "fal/flux-2-max": {
    id: "fal/flux-2-max",
    label: "FLUX.2 Max",
    provider: "fal",
    mediaType: "image",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    pricingStrategy: "fal-flux2-max-per-mp",
    sizeMap: falImageSizeMap,
  },
  "fal/imagen4/preview/fast": {
    id: "fal/imagen4/preview/fast",
    label: "Imagen 4 Fast",
    provider: "fal",
    mediaType: "image",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    pricingStrategy: "imagen4-fast-per-image",
    sizeMap: falImageSizeMap,
  },
  "fal-ai/nano-banana": {
    id: "fal-ai/nano-banana",
    label: "Nano Banana",
    provider: "fal",
    mediaType: "image",
    defaultAspect: "1:1",
    allowedAspects: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    pricingStrategy: "google-nano-banana-per-image",
  },
  "fal-ai/nano-banana-pro": {
    id: "fal-ai/nano-banana-pro",
    label: "Nano Banana Pro",
    provider: "fal",
    mediaType: "image",
    defaultAspect: "4:5",
    allowedAspects: ["21:9", "16:9", "3:2", "4:3", "5:4", "4:5", "3:4", "2:3", "9:16", "1:1"],
    pricingStrategy: "nano-banana-per-image",
    defaultResolution: "1K",
  },
  "fal-ai/bytedance/seedream/v4.5/text-to-image": {
    id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    label: "Seedream 4.5",
    provider: "fal",
    mediaType: "image",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    pricingStrategy: "seedream-per-image",
  },
  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video": {
    id: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    label: "Kling 2.5 Turbo Pro",
    provider: "fal",
    mediaType: "video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1"],
    pricingStrategy: "kling-2.5-per-duration",
    defaultDurationSeconds: 10,
  },
  "fal-ai/kling-video/v2.5-turbo/pro/text-to-video": {
    id: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    label: "Kling 2.5 Turbo Text to Video",
    provider: "fal",
    mediaType: "video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1"],
    pricingStrategy: "kling-2.5-per-duration",
    defaultDurationSeconds: 10,
  },
  "fal-ai/veo3.1": {
    id: "fal-ai/veo3.1",
    label: "Google Veo 3.1",
    provider: "fal",
    mediaType: "video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1"],
    pricingStrategy: "veo-3-per-second",
    defaultDurationSeconds: 8,
    defaultResolution: "1080p",
    defaultAudio: true,
  },
  "fal-ai/kling-video/v2.6/pro/text-to-video": {
    id: "fal-ai/kling-video/v2.6/pro/text-to-video",
    label: "Kling 2.6 Pro",
    provider: "fal",
    mediaType: "video",
    defaultAspect: "16:9",
    allowedAspects: ["1:1", "16:9", "9:16"],
    pricingStrategy: "kling-2.6-per-second",
    defaultDurationSeconds: 10,
    defaultAudio: true,
  },
  "fal-ai/sora-2/text-to-video/pro": {
    id: "fal-ai/sora-2/text-to-video/pro",
    label: "Sora 2 Pro",
    provider: "fal",
    mediaType: "video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16"],
    pricingStrategy: "sora-2-pro-per-second",
    defaultDurationSeconds: 8,
    defaultResolution: "1080p",
    defaultAudio: true,
  },
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video": {
    id: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    label: "Seedance 1.5 Pro",
    provider: "fal",
    mediaType: "video",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
    pricingStrategy: "seedance-1.5-per-second",
    defaultDurationSeconds: 10,
    defaultResolution: "1080p",
    defaultAudio: true,
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
