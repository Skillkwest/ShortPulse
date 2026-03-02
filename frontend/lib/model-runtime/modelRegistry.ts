/**
 * Registry of supported AI Studio models with metadata for UI and pricing.
 */
import { PricingStrategyId } from "./pricingTypes";
import { AspectSize, falImageSizeMap } from "./modelSizes";
import { KIE_KLING_30_MODEL_ID, KIE_VEO_31_FAST_I2V_MODEL_ID } from "./providerModelIds";
import {
  getModelAllowedAspects,
  getModelAllowedDurations,
  getModelAllowedResolutions,
  getModelDefaultAspect,
  getModelDefaultDurationSeconds,
  getModelDefaultResolution,
} from "./modelApiContracts";

export type ModelConfig = {
  id: string;
  label: string;
  provider: "fal" | "kie" | "openai" | "other";
  mediaType: "image" | "video" | "image-to-video" | "multi" | "text";
  defaultAspect: string;
  allowedAspects: string[];
  pricingStrategy: PricingStrategyId;
  sizeMap?: Record<string, AspectSize>;
  defaultDurationSeconds?: number;
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  defaultResolution?: string;
  defaultAudio?: boolean;
  allowedResolutions?: string[]; // Model-specific resolution options (video + image)
  allowedDurations?: number[]; // Model-specific duration options (e.g., [4, 6, 8])
  supportsTextToImage?: boolean;
  supportsImageToImage?: boolean;
  supportsImageToVideo?: boolean;
};

const contractDefaultAspect = (modelId: string, fallback: string): string =>
  getModelDefaultAspect(modelId, fallback);

const contractAllowedAspects = (modelId: string, fallback: string[]): string[] =>
  getModelAllowedAspects(modelId, fallback);

const contractDefaultResolution = (
  modelId: string,
  fallback: string | undefined
): string | undefined => getModelDefaultResolution(modelId, fallback);

const contractAllowedResolutions = (
  modelId: string,
  fallback: string[] | undefined
): string[] | undefined => getModelAllowedResolutions(modelId, fallback);

const contractDefaultDuration = (
  modelId: string,
  fallback: number | undefined
): number | undefined => getModelDefaultDurationSeconds(modelId, fallback);

const contractAllowedDurations = (
  modelId: string,
  fallback: number[] | undefined
): number[] | undefined => getModelAllowedDurations(modelId, fallback);

const registry: Record<string, ModelConfig> = {
  "fal-ai/flux-2/klein/9b": {
    id: "fal-ai/flux-2/klein/9b",
    label: "FLUX.2 Lite",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/flux-2/klein/9b", "4:3"),
    allowedAspects: contractAllowedAspects("fal-ai/flux-2/klein/9b", [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
    ]),
    pricingStrategy: "fal-flux2-klein-per-mp",
    sizeMap: falImageSizeMap,
    defaultResolution: contractDefaultResolution("fal-ai/flux-2/klein/9b", "model_default"),
    allowedResolutions: contractAllowedResolutions("fal-ai/flux-2/klein/9b", ["model_default"]),
    supportsTextToImage: true,
  },
  "fal/flux-2": {
    id: "fal/flux-2",
    label: "FLUX.2",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal/flux-2", "4:3"),
    allowedAspects: contractAllowedAspects("fal/flux-2", ["1:1", "4:3", "3:4", "16:9", "9:16"]),
    pricingStrategy: "fal-flux2-per-mp",
    sizeMap: falImageSizeMap,
    defaultResolution: contractDefaultResolution("fal/flux-2", "model_default"),
    allowedResolutions: contractAllowedResolutions("fal/flux-2", ["model_default"]),
    supportsTextToImage: true,
  },
  "fal/flux-2/edit": {
    id: "fal/flux-2/edit",
    label: "FLUX.2 Edit",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal/flux-2/edit", "4:3"),
    allowedAspects: contractAllowedAspects("fal/flux-2/edit", [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
    ]),
    pricingStrategy: "fal-flux2-per-mp",
    sizeMap: falImageSizeMap,
    defaultResolution: contractDefaultResolution("fal/flux-2/edit", "model_default"),
    allowedResolutions: contractAllowedResolutions("fal/flux-2/edit", ["model_default"]),
    supportsImageToImage: true,
  },
  "fal/flux-2-pro": {
    id: "fal/flux-2-pro",
    label: "FLUX.2 Pro",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal/flux-2-pro", "4:3"),
    allowedAspects: contractAllowedAspects("fal/flux-2-pro", ["1:1", "4:3", "3:4", "16:9", "9:16"]),
    pricingStrategy: "fal-flux2-pro-per-mp",
    sizeMap: falImageSizeMap,
    defaultResolution: contractDefaultResolution("fal/flux-2-pro", "model_default"),
    allowedResolutions: contractAllowedResolutions("fal/flux-2-pro", ["model_default"]),
    supportsTextToImage: true,
  },
  "fal/flux-2-pro/edit": {
    id: "fal/flux-2-pro/edit",
    label: "FLUX.2 Pro Edit",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal/flux-2-pro/edit", "4:3"),
    allowedAspects: contractAllowedAspects("fal/flux-2-pro/edit", [
      "1:1",
      "4:3",
      "3:4",
      "16:9",
      "9:16",
    ]),
    pricingStrategy: "fal-flux2-pro-per-mp",
    sizeMap: falImageSizeMap,
    defaultResolution: contractDefaultResolution("fal/flux-2-pro/edit", "model_default"),
    allowedResolutions: contractAllowedResolutions("fal/flux-2-pro/edit", ["model_default"]),
    supportsImageToImage: true,
  },
  "fal-ai/nano-banana": {
    id: "fal-ai/nano-banana",
    label: "Nano Banana",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/nano-banana", "1:1"),
    allowedAspects: contractAllowedAspects("fal-ai/nano-banana", [
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ]),
    pricingStrategy: "google-nano-banana-per-image",
    defaultResolution: contractDefaultResolution("fal-ai/nano-banana", "model_default"),
    allowedResolutions: contractAllowedResolutions("fal-ai/nano-banana", ["model_default"]),
    supportsTextToImage: true,
  },
  "fal-ai/nano-banana/edit": {
    id: "fal-ai/nano-banana/edit",
    label: "Nano Banana Edit",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/nano-banana/edit", "auto"),
    allowedAspects: contractAllowedAspects("fal-ai/nano-banana/edit", [
      "auto",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ]),
    pricingStrategy: "google-nano-banana-per-image",
    defaultResolution: contractDefaultResolution("fal-ai/nano-banana/edit", "model_default"),
    allowedResolutions: contractAllowedResolutions("fal-ai/nano-banana/edit", ["model_default"]),
    supportsImageToImage: true,
  },
  "fal-ai/nano-banana-2": {
    id: "fal-ai/nano-banana-2",
    label: "Nano Banana 2",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/nano-banana-2", "auto"),
    allowedAspects: contractAllowedAspects("fal-ai/nano-banana-2", [
      "auto",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ]),
    pricingStrategy: "nano-banana-2-per-image",
    defaultResolution: contractDefaultResolution("fal-ai/nano-banana-2", "1K"),
    allowedResolutions: contractAllowedResolutions("fal-ai/nano-banana-2", [
      "0.5K",
      "1K",
      "2K",
      "4K",
    ]),
    supportsTextToImage: true,
  },
  "fal-ai/nano-banana-2/edit": {
    id: "fal-ai/nano-banana-2/edit",
    label: "Nano Banana 2 Edit",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/nano-banana-2/edit", "auto"),
    allowedAspects: contractAllowedAspects("fal-ai/nano-banana-2/edit", [
      "auto",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ]),
    pricingStrategy: "nano-banana-2-per-image",
    defaultResolution: contractDefaultResolution("fal-ai/nano-banana-2/edit", "1K"),
    allowedResolutions: contractAllowedResolutions("fal-ai/nano-banana-2/edit", [
      "0.5K",
      "1K",
      "2K",
      "4K",
    ]),
    supportsImageToImage: true,
  },
  "fal-ai/nano-banana-pro": {
    id: "fal-ai/nano-banana-pro",
    label: "Nano Banana Pro",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/nano-banana-pro", "4:5"),
    allowedAspects: contractAllowedAspects("fal-ai/nano-banana-pro", [
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
      "1:1",
    ]),
    pricingStrategy: "nano-banana-per-image",
    defaultResolution: contractDefaultResolution("fal-ai/nano-banana-pro", "1K"),
    allowedResolutions: contractAllowedResolutions("fal-ai/nano-banana-pro", ["1K", "2K", "4K"]),
    supportsTextToImage: true,
  },
  "fal-ai/nano-banana-pro/edit": {
    id: "fal-ai/nano-banana-pro/edit",
    label: "Nano Banana Pro Edit",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/nano-banana-pro/edit", "auto"),
    allowedAspects: contractAllowedAspects("fal-ai/nano-banana-pro/edit", [
      "auto",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ]),
    pricingStrategy: "nano-banana-per-image",
    defaultResolution: contractDefaultResolution("fal-ai/nano-banana-pro/edit", "1K"),
    allowedResolutions: contractAllowedResolutions("fal-ai/nano-banana-pro/edit", [
      "1K",
      "2K",
      "4K",
    ]),
    supportsImageToImage: true,
  },
  "fal-ai/bytedance/seedream/v4.5/text-to-image": {
    id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    label: "Seedream 4.5",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/bytedance/seedream/v4.5/text-to-image", "1:1"),
    allowedAspects: contractAllowedAspects("fal-ai/bytedance/seedream/v4.5/text-to-image", [
      "1:1",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
    ]),
    pricingStrategy: "seedream-per-image",
    defaultResolution: contractDefaultResolution(
      "fal-ai/bytedance/seedream/v4.5/text-to-image",
      "model_default"
    ),
    allowedResolutions: contractAllowedResolutions("fal-ai/bytedance/seedream/v4.5/text-to-image", [
      "model_default",
      "auto_2K",
      "auto_4K",
    ]),
    supportsTextToImage: true,
  },
  "fal-ai/bytedance/seedream/v4.5/edit": {
    id: "fal-ai/bytedance/seedream/v4.5/edit",
    label: "Seedream 4.5 Edit",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/bytedance/seedream/v4.5/edit", "1:1"),
    allowedAspects: contractAllowedAspects("fal-ai/bytedance/seedream/v4.5/edit", [
      "1:1",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
    ]),
    pricingStrategy: "seedream-per-image",
    defaultResolution: contractDefaultResolution(
      "fal-ai/bytedance/seedream/v4.5/edit",
      "model_default"
    ),
    allowedResolutions: contractAllowedResolutions("fal-ai/bytedance/seedream/v4.5/edit", [
      "model_default",
      "auto_2K",
      "auto_4K",
    ]),
    supportsImageToImage: true,
  },
  "fal-ai/bytedance/seedream/v5/lite/text-to-image": {
    id: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    label: "Seedream 5 Lite",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/bytedance/seedream/v5/lite/text-to-image", "1:1"),
    allowedAspects: contractAllowedAspects("fal-ai/bytedance/seedream/v5/lite/text-to-image", [
      "1:1",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
    ]),
    pricingStrategy: "seedream-5-lite-per-image",
    defaultResolution: contractDefaultResolution(
      "fal-ai/bytedance/seedream/v5/lite/text-to-image",
      "auto_2K"
    ),
    allowedResolutions: contractAllowedResolutions(
      "fal-ai/bytedance/seedream/v5/lite/text-to-image",
      ["auto_2K", "auto_3K"]
    ),
    supportsTextToImage: true,
  },
  "fal-ai/bytedance/seedream/v5/lite/edit": {
    id: "fal-ai/bytedance/seedream/v5/lite/edit",
    label: "Seedream 5 Lite Edit",
    provider: "fal",
    mediaType: "image",
    defaultAspect: contractDefaultAspect("fal-ai/bytedance/seedream/v5/lite/edit", "1:1"),
    allowedAspects: contractAllowedAspects("fal-ai/bytedance/seedream/v5/lite/edit", [
      "1:1",
      "2:3",
      "3:2",
      "3:4",
      "4:3",
      "4:5",
      "5:4",
      "9:16",
      "16:9",
    ]),
    pricingStrategy: "seedream-5-lite-per-image",
    defaultResolution: contractDefaultResolution(
      "fal-ai/bytedance/seedream/v5/lite/edit",
      "auto_2K"
    ),
    allowedResolutions: contractAllowedResolutions("fal-ai/bytedance/seedream/v5/lite/edit", [
      "auto_2K",
      "auto_3K",
    ]),
    supportsImageToImage: true,
  },
  "fal-ai/kling-video/v3/pro/text-to-video": {
    id: "fal-ai/kling-video/v3/pro/text-to-video",
    label: "Kling 3.0",
    provider: "fal",
    mediaType: "video",
    defaultAspect: contractDefaultAspect("fal-ai/kling-video/v3/pro/text-to-video", "16:9"),
    allowedAspects: contractAllowedAspects("fal-ai/kling-video/v3/pro/text-to-video", [
      "16:9",
      "9:16",
      "1:1",
    ]),
    pricingStrategy: "kling-3-per-second",
    defaultDurationSeconds: contractDefaultDuration("fal-ai/kling-video/v3/pro/text-to-video", 10),
    defaultAudio: true,
    allowedDurations: contractAllowedDurations(
      "fal-ai/kling-video/v3/pro/text-to-video",
      [5, 6, 7, 8, 9, 10]
    ),
  },
  "fal-ai/kling-video/v3/pro/image-to-video": {
    id: "fal-ai/kling-video/v3/pro/image-to-video",
    label: "Kling 3.0",
    provider: "fal",
    mediaType: "image-to-video",
    defaultAspect: contractDefaultAspect("fal-ai/kling-video/v3/pro/image-to-video", "16:9"),
    allowedAspects: contractAllowedAspects("fal-ai/kling-video/v3/pro/image-to-video", [
      "16:9",
      "9:16",
      "1:1",
    ]),
    pricingStrategy: "kling-3-per-second",
    defaultDurationSeconds: contractDefaultDuration("fal-ai/kling-video/v3/pro/image-to-video", 10),
    defaultAudio: true,
    allowedDurations: contractAllowedDurations(
      "fal-ai/kling-video/v3/pro/image-to-video",
      [5, 6, 7, 8, 9, 10]
    ),
    supportsImageToVideo: true,
  },
  "fal-ai/veo3.1": {
    id: "fal-ai/veo3.1",
    label: "Google Veo 3.1",
    provider: "fal",
    mediaType: "video",
    defaultAspect: contractDefaultAspect("fal-ai/veo3.1", "16:9"),
    allowedAspects: contractAllowedAspects("fal-ai/veo3.1", ["16:9", "9:16"]),
    pricingStrategy: "veo-3-per-second",
    defaultDurationSeconds: contractDefaultDuration("fal-ai/veo3.1", 8),
    defaultResolution: contractDefaultResolution("fal-ai/veo3.1", "1080p"),
    defaultAudio: true,
    allowedResolutions: contractAllowedResolutions("fal-ai/veo3.1", ["720p", "1080p", "4k"]),
    allowedDurations: contractAllowedDurations("fal-ai/veo3.1", [4, 6, 8]),
  },
  "fal-ai/veo3.1/first-last-frame-to-video": {
    id: "fal-ai/veo3.1/first-last-frame-to-video",
    label: "Google Veo 3.1 (First/Last Frame)",
    provider: "fal",
    mediaType: "image-to-video",
    defaultAspect: contractDefaultAspect("fal-ai/veo3.1/first-last-frame-to-video", "auto"),
    allowedAspects: contractAllowedAspects("fal-ai/veo3.1/first-last-frame-to-video", [
      "auto",
      "16:9",
      "9:16",
    ]),
    pricingStrategy: "veo-3-per-second",
    defaultDurationSeconds: contractDefaultDuration("fal-ai/veo3.1/first-last-frame-to-video", 8),
    defaultResolution: contractDefaultResolution("fal-ai/veo3.1/first-last-frame-to-video", "720p"),
    defaultAudio: true,
    allowedResolutions: contractAllowedResolutions("fal-ai/veo3.1/first-last-frame-to-video", [
      "720p",
      "1080p",
      "4k",
    ]),
    allowedDurations: contractAllowedDurations(
      "fal-ai/veo3.1/first-last-frame-to-video",
      [4, 6, 8]
    ),
  },
  "fal-ai/veo3.1/image-to-video": {
    id: "fal-ai/veo3.1/image-to-video",
    label: "Google Veo 3.1 (Image to Video)",
    provider: "fal",
    mediaType: "image-to-video",
    defaultAspect: contractDefaultAspect("fal-ai/veo3.1/image-to-video", "auto"),
    allowedAspects: contractAllowedAspects("fal-ai/veo3.1/image-to-video", [
      "auto",
      "16:9",
      "9:16",
    ]),
    pricingStrategy: "veo-3-per-second",
    defaultDurationSeconds: contractDefaultDuration("fal-ai/veo3.1/image-to-video", 8),
    defaultResolution: contractDefaultResolution("fal-ai/veo3.1/image-to-video", "720p"),
    defaultAudio: true,
    allowedResolutions: contractAllowedResolutions("fal-ai/veo3.1/image-to-video", [
      "720p",
      "1080p",
      "4k",
    ]),
    allowedDurations: contractAllowedDurations("fal-ai/veo3.1/image-to-video", [4, 6, 8]),
    supportsImageToVideo: true,
  },
  "fal-ai/sora-2/text-to-video/pro": {
    id: "fal-ai/sora-2/text-to-video/pro",
    label: "Sora 2 Pro",
    provider: "fal",
    mediaType: "video",
    defaultAspect: contractDefaultAspect("fal-ai/sora-2/text-to-video/pro", "16:9"),
    allowedAspects: contractAllowedAspects("fal-ai/sora-2/text-to-video/pro", ["16:9", "9:16"]),
    pricingStrategy: "sora-2-pro-per-second",
    defaultDurationSeconds: contractDefaultDuration("fal-ai/sora-2/text-to-video/pro", 8),
    defaultResolution: contractDefaultResolution("fal-ai/sora-2/text-to-video/pro", "1080p"),
    defaultAudio: true,
    allowedResolutions: contractAllowedResolutions("fal-ai/sora-2/text-to-video/pro", [
      "720p",
      "1080p",
    ]),
    allowedDurations: contractAllowedDurations("fal-ai/sora-2/text-to-video/pro", [4, 8, 12]),
  },
  "fal-ai/bytedance/seedance/v1.5/pro/text-to-video": {
    id: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    label: "Seedance 1.5 Pro",
    provider: "fal",
    mediaType: "video",
    defaultAspect: contractDefaultAspect(
      "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
      "16:9"
    ),
    allowedAspects: contractAllowedAspects("fal-ai/bytedance/seedance/v1.5/pro/text-to-video", [
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16",
      "21:9",
    ]),
    pricingStrategy: "seedance-1.5-per-second",
    defaultDurationSeconds: contractDefaultDuration(
      "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
      10
    ),
    defaultResolution: contractDefaultResolution(
      "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
      "1080p"
    ),
    defaultAudio: true,
    allowedResolutions: contractAllowedResolutions(
      "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
      ["480p", "720p", "1080p"]
    ),
    allowedDurations: contractAllowedDurations(
      "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
      [4, 5, 6, 7, 8, 9, 10, 11, 12]
    ),
  },
  "fal-ai/bytedance/seedance/v1.5/pro/image-to-video": {
    id: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    label: "Seedance 1.5 Pro",
    provider: "fal",
    mediaType: "image-to-video",
    defaultAspect: contractDefaultAspect(
      "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
      "16:9"
    ),
    allowedAspects: contractAllowedAspects("fal-ai/bytedance/seedance/v1.5/pro/image-to-video", [
      "16:9",
      "4:3",
      "1:1",
      "3:4",
      "9:16",
      "21:9",
    ]),
    pricingStrategy: "seedance-1.5-per-second",
    defaultDurationSeconds: contractDefaultDuration(
      "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
      5
    ),
    minDurationSeconds: 4,
    maxDurationSeconds: 12,
    defaultResolution: contractDefaultResolution(
      "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
      "1080p"
    ),
    defaultAudio: true,
    allowedResolutions: contractAllowedResolutions(
      "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
      ["480p", "720p", "1080p"]
    ),
    allowedDurations: contractAllowedDurations(
      "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
      [4, 5, 6, 7, 8, 9, 10, 11, 12]
    ),
    supportsImageToVideo: true,
  },
  [KIE_VEO_31_FAST_I2V_MODEL_ID]: {
    id: KIE_VEO_31_FAST_I2V_MODEL_ID,
    label: "Veo 3.1 Fast I2V (Kie)",
    provider: "kie",
    mediaType: "image-to-video",
    defaultAspect: contractDefaultAspect(KIE_VEO_31_FAST_I2V_MODEL_ID, "16:9"),
    allowedAspects: contractAllowedAspects(KIE_VEO_31_FAST_I2V_MODEL_ID, ["16:9", "9:16"]),
    pricingStrategy: "veo-3-per-second",
    defaultDurationSeconds: contractDefaultDuration(KIE_VEO_31_FAST_I2V_MODEL_ID, 5),
    minDurationSeconds: 5,
    maxDurationSeconds: 8,
    defaultResolution: contractDefaultResolution(KIE_VEO_31_FAST_I2V_MODEL_ID, "720p"),
    defaultAudio: true,
    allowedResolutions: contractAllowedResolutions(KIE_VEO_31_FAST_I2V_MODEL_ID, ["720p", "1080p"]),
    allowedDurations: contractAllowedDurations(KIE_VEO_31_FAST_I2V_MODEL_ID, [5, 8]),
    supportsImageToVideo: true,
  },
  [KIE_KLING_30_MODEL_ID]: {
    id: KIE_KLING_30_MODEL_ID,
    label: "Kling 3.0 (Kie)",
    provider: "kie",
    mediaType: "image-to-video",
    defaultAspect: contractDefaultAspect(KIE_KLING_30_MODEL_ID, "16:9"),
    allowedAspects: contractAllowedAspects(KIE_KLING_30_MODEL_ID, ["16:9", "9:16", "1:1"]),
    pricingStrategy: "kling-3-per-second",
    defaultDurationSeconds: contractDefaultDuration(KIE_KLING_30_MODEL_ID, 10),
    minDurationSeconds: 5,
    maxDurationSeconds: 10,
    defaultResolution: contractDefaultResolution(KIE_KLING_30_MODEL_ID, "1080p"),
    defaultAudio: true,
    allowedResolutions: contractAllowedResolutions(KIE_KLING_30_MODEL_ID, ["1080p"]),
    allowedDurations: contractAllowedDurations(KIE_KLING_30_MODEL_ID, [5, 10]),
    supportsImageToVideo: true,
  },
  "gpt-5-nano": {
    id: "gpt-5-nano",
    label: "GPT-5 Nano",
    provider: "openai",
    mediaType: "text",
    defaultAspect: contractDefaultAspect("gpt-5-nano", "text"),
    allowedAspects: contractAllowedAspects("gpt-5-nano", []),
    pricingStrategy: "gpt41nano-per-token",
  },
};

export const getModelConfig = (id: string): ModelConfig | null => registry[id] ?? null;

export const listModelConfigs = (): ModelConfig[] => Object.values(registry);
