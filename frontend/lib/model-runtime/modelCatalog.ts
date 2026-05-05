/**
 * Canonical model catalog shared by AI Studio client logic and server runtime.
 * Keep model capabilities, provider docs provenance, and Fal routing aliases in one place.
 */
import type { ElevenLabsModelPricingAuthority } from "./elevenLabsModels";
import {
  ELEVENLABS_MUSIC_MODEL_ID,
  ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
  ELEVENLABS_VOICEOVER_MODEL_ID,
  ELEVENLABS_VOICE_CHANGER_MODEL_ID,
  ELEVENLABS_VOICE_DESIGN_MODEL_ID,
} from "./elevenLabsModels";
import type { PricingStrategyId } from "./pricingTypes";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "./providerModelIds";

export type ModelAspectSubmitField = "aspect_ratio" | "image_size" | "none";
export type ModelProvider = "fal" | "kie" | "openai" | "elevenlabs";
export type ModelCatalogMediaType =
  | "image"
  | "video"
  | "image-to-video"
  | "multi"
  | "text"
  | "audio";
export type GenerationWorkflowLane =
  | "text-to-image"
  | "image-to-image"
  | "text-to-video"
  | "image-to-video"
  | "text-to-speech"
  | "speech-to-speech"
  | "music"
  | "sfx"
  | "voice-design"
  | "text";
export type GenerationExecutionMode = "queued" | "direct" | "none";
export type GenerationSubmitHandler = "default" | "image" | "video" | "audio" | "unsupported";
export type ModelLifecycle = "active" | "deprecated" | "disabled" | "retired";
export type ModelSurface =
  | "picker"
  | "pricing"
  | "runtime"
  | "hidden_tool"
  | "internal_helper"
  | "audio_tool"
  | "metadata";
export type ModelLogoKey = "flux" | "google" | "kling" | "seedream" | "openai" | "elevenlabs";
export type ModelVisibilityFlag = "NEXT_PUBLIC_KIE_SEEDANCE_2_ENABLED";

export type ModelPayloadValidationSpec = {
  allowedTopLevelFields?: string[];
  requiredStringFields?: string[];
  requiredStringArrayFields?: Array<{ field: string; min?: number; max?: number }>;
  requiredAnyOfStringFields?: string[];
  requiredAnyOfStringArrayFields?: string[];
  enumFields?: Record<string, string[]>;
  optionalBooleanFields?: string[];
  optionalNumberFields?: string[];
};

export type ModelCatalogEntry = {
  modelId: string;
  provider: ModelProvider;
  sourceUrl: string;
  verifiedAt: string;
  label?: string;
  mediaType?: ModelCatalogMediaType;
  pricingStrategy?: PricingStrategyId;
  pricingAuthority?: "shared_policy" | ElevenLabsModelPricingAuthority;
  lifecycle?: ModelLifecycle;
  surfaces?: ModelSurface[];
  billable?: boolean;
  displayFamily?: string;
  displayOrder?: number;
  pricingFamily?: string;
  surfaceNote?: string;
  visibilityFlag?: ModelVisibilityFlag;
  logoKey?: ModelLogoKey;
  providerModelId?: string;
  providerVariants?: string[];
  sizeMapId?: "fal-image";
  submitAspectField: ModelAspectSubmitField;
  defaultAspect: string;
  allowedAspects: string[];
  defaultResolution?: string;
  allowedResolutions?: string[];
  defaultDurationSeconds?: number;
  defaultGenerationCount?: number;
  defaultSourceDurationSeconds?: number;
  defaultTextCharacters?: number;
  allowedDurations?: number[];
  minDurationSeconds?: number;
  maxDurationSeconds?: number;
  defaultAudio?: boolean;
  supportsTextToImage?: boolean;
  supportsImageToImage?: boolean;
  supportsImageToVideo?: boolean;
  generationLanes?: GenerationWorkflowLane[];
  executionMode?: GenerationExecutionMode;
  submitHandler?: GenerationSubmitHandler;
  gridEligible?: boolean;
  apiRouteSlug?: string;
  falSubmitUrl?: string;
  falStatusBaseUrls?: string[];
  falTimeoutMs?: number;
  kieSubmitUrl?: string;
  kieStatusBaseUrls?: string[];
  kieTimeoutMs?: number;
  pricingParamAliases?: {
    webSearch?: string[];
  };
  payloadValidation?: ModelPayloadValidationSpec;
};

const VERIFIED_AT = "2026-04-30";
const KONTEXT_INPAINT_VERIFIED_AT = "2026-04-14";
const GPT_IMAGE_2_VERIFIED_AT = "2026-04-27";
const ELEVENLABS_VERIFIED_AT = "2026-05-01";
type ModelCatalogRuntimeMetadata = Pick<
  ModelCatalogEntry,
  | "label"
  | "mediaType"
  | "pricingStrategy"
  | "pricingAuthority"
  | "lifecycle"
  | "surfaces"
  | "billable"
  | "displayFamily"
  | "displayOrder"
  | "pricingFamily"
  | "surfaceNote"
  | "visibilityFlag"
  | "logoKey"
  | "providerModelId"
  | "providerVariants"
  | "sizeMapId"
  | "defaultAudio"
  | "supportsTextToImage"
  | "supportsImageToImage"
  | "supportsImageToVideo"
  | "generationLanes"
  | "executionMode"
  | "submitHandler"
  | "gridEligible"
  | "apiRouteSlug"
  | "defaultGenerationCount"
  | "defaultSourceDurationSeconds"
  | "defaultTextCharacters"
  | "minDurationSeconds"
  | "maxDurationSeconds"
>;

const catalogBase: Record<string, ModelCatalogEntry> = {
  "fal-ai/flux-2/klein/9b": {
    modelId: "fal-ai/flux-2/klein/9b",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2/klein/9b/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/flux-2/klein/9b",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/flux-2/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        output_format: ["png", "jpeg", "webp"],
      },
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "num_inference_steps", "seed", "guidance_scale"],
    },
  },
  "fal-ai/flux-pro/v1/fill": {
    modelId: "fal-ai/flux-pro/v1/fill",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-pro/v1/fill/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "none",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/flux-pro/v1/fill",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/flux-pro/v1/fill/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt", "image_url", "mask_url"],
      enumFields: {
        output_format: ["png", "jpeg"],
        safety_tolerance: ["1", "2", "3", "4", "5", "6"],
      },
      optionalBooleanFields: ["sync_mode", "enhance_prompt"],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/flux-kontext-lora/inpaint": {
    modelId: "fal-ai/flux-kontext-lora/inpaint",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-kontext-lora/inpaint/api",
    verifiedAt: KONTEXT_INPAINT_VERIFIED_AT,
    submitAspectField: "none",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/flux-kontext-lora/inpaint",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/flux-kontext-lora/inpaint/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt", "image_url", "mask_url", "reference_image_url"],
      enumFields: {
        output_format: ["png", "jpeg"],
      },
      optionalBooleanFields: ["sync_mode"],
      optionalNumberFields: ["num_images", "seed", "guidance_scale", "num_inference_steps"],
    },
  },
  "fal-ai/bria/background/remove": {
    modelId: "fal-ai/bria/background/remove",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bria/background/remove/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "none",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/bria/background/remove",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/bria/background/remove/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["image_url"],
      optionalBooleanFields: ["sync_mode"],
    },
  },
  "gpt-image-2": {
    modelId: "gpt-image-2",
    provider: "openai",
    sourceUrl: "https://developers.openai.com/api/docs/models/gpt-image-2",
    verifiedAt: GPT_IMAGE_2_VERIFIED_AT,
    submitAspectField: "none",
    defaultAspect: "1:1",
    allowedAspects: ["auto", "9:16", "4:5", "1:1", "5:4", "16:9"],
    defaultResolution: "medium",
    allowedResolutions: ["low", "medium", "high"],
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        size: ["1024x1024", "1024x1536", "1536x1024"],
        quality: ["low", "medium", "high"],
        output_format: ["png", "jpeg", "webp"],
        moderation: ["auto", "low"],
      },
      optionalNumberFields: ["n", "output_compression"],
    },
  },
  "fal-ai/nano-banana": {
    modelId: "fal-ai/nano-banana",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "1:1",
    allowedAspects: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/nano-banana",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/nano-banana/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["21:9", "16:9", "3:2", "4:3", "5:4", "1:1", "4:5", "3:4", "2:3", "9:16"],
        output_format: ["png", "jpeg", "webp"],
      },
      optionalBooleanFields: ["sync_mode", "limit_generations"],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/nano-banana/edit": {
    modelId: "fal-ai/nano-banana/edit",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana/edit/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "auto",
    allowedAspects: [
      "auto",
      "21:9",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/nano-banana/edit",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/nano-banana/edit/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredStringArrayFields: [{ field: "image_urls", min: 1 }],
      enumFields: {
        aspect_ratio: [
          "auto",
          "21:9",
          "16:9",
          "3:2",
          "4:3",
          "5:4",
          "1:1",
          "4:5",
          "3:4",
          "2:3",
          "9:16",
        ],
        output_format: ["png", "jpeg", "webp"],
      },
      optionalBooleanFields: ["sync_mode", "limit_generations"],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/nano-banana-2": {
    modelId: "fal-ai/nano-banana-2",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-2/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "auto",
    allowedAspects: [
      "auto",
      "21:9",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ],
    defaultResolution: "1K",
    allowedResolutions: ["0.5K", "1K", "2K", "4K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/nano-banana-2",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/nano-banana-2/requests"],
    falTimeoutMs: 60000,
    pricingParamAliases: {
      webSearch: ["enable_web_search", "web_search", "enable_google_search"],
    },
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: [
          "auto",
          "21:9",
          "16:9",
          "3:2",
          "4:3",
          "5:4",
          "1:1",
          "4:5",
          "3:4",
          "2:3",
          "9:16",
        ],
        output_format: ["png", "jpeg", "webp"],
        resolution: ["0.5K", "1K", "2K", "4K"],
      },
      optionalBooleanFields: [
        "sync_mode",
        "limit_generations",
        "enable_web_search",
        "enable_google_search",
      ],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/nano-banana-2/edit": {
    modelId: "fal-ai/nano-banana-2/edit",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-2/edit/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "auto",
    allowedAspects: [
      "auto",
      "21:9",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ],
    defaultResolution: "1K",
    allowedResolutions: ["0.5K", "1K", "2K", "4K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/nano-banana-2/edit",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/nano-banana-2/edit/requests"],
    falTimeoutMs: 60000,
    pricingParamAliases: {
      webSearch: ["enable_web_search", "web_search", "enable_google_search"],
    },
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredStringArrayFields: [{ field: "image_urls", min: 1 }],
      enumFields: {
        aspect_ratio: [
          "auto",
          "21:9",
          "16:9",
          "3:2",
          "4:3",
          "5:4",
          "1:1",
          "4:5",
          "3:4",
          "2:3",
          "9:16",
        ],
        output_format: ["png", "jpeg", "webp"],
        resolution: ["0.5K", "1K", "2K", "4K"],
      },
      optionalBooleanFields: [
        "sync_mode",
        "limit_generations",
        "enable_web_search",
        "enable_google_search",
      ],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/nano-banana-pro": {
    modelId: "fal-ai/nano-banana-pro",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-pro/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "4:5",
    allowedAspects: ["21:9", "16:9", "3:2", "4:3", "5:4", "4:5", "3:4", "2:3", "9:16", "1:1"],
    defaultResolution: "1K",
    allowedResolutions: ["1K", "2K", "4K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/nano-banana-pro",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/nano-banana-pro/requests"],
    falTimeoutMs: 60000,
    pricingParamAliases: {
      webSearch: ["enable_web_search", "web_search", "enable_google_search"],
    },
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["21:9", "16:9", "3:2", "4:3", "5:4", "4:5", "3:4", "2:3", "9:16", "1:1"],
        output_format: ["png", "jpeg", "webp"],
        resolution: ["1K", "2K", "4K"],
      },
      optionalBooleanFields: [
        "sync_mode",
        "limit_generations",
        "enable_web_search",
        "enable_google_search",
      ],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/nano-banana-pro/edit": {
    modelId: "fal-ai/nano-banana-pro/edit",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-pro/edit/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "auto",
    allowedAspects: [
      "auto",
      "21:9",
      "16:9",
      "3:2",
      "4:3",
      "5:4",
      "1:1",
      "4:5",
      "3:4",
      "2:3",
      "9:16",
    ],
    defaultResolution: "1K",
    allowedResolutions: ["1K", "2K", "4K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/nano-banana-pro/edit",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/nano-banana-pro/edit/requests"],
    falTimeoutMs: 60000,
    pricingParamAliases: {
      webSearch: ["enable_web_search", "web_search", "enable_google_search"],
    },
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredStringArrayFields: [{ field: "image_urls", min: 1 }],
      enumFields: {
        aspect_ratio: [
          "auto",
          "21:9",
          "16:9",
          "3:2",
          "4:3",
          "5:4",
          "1:1",
          "4:5",
          "3:4",
          "2:3",
          "9:16",
        ],
        output_format: ["png", "jpeg", "webp"],
        resolution: ["1K", "2K", "4K"],
      },
      optionalBooleanFields: [
        "sync_mode",
        "limit_generations",
        "enable_web_search",
        "enable_google_search",
      ],
      optionalNumberFields: ["num_images", "seed"],
    },
  },
  "fal-ai/bytedance/seedream/v4.5/text-to-image": {
    modelId: "fal-ai/bytedance/seedream/v4.5/text-to-image",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/text-to-image/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    defaultResolution: "auto_2K",
    allowedResolutions: ["auto_2K", "auto_4K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/text-to-image/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        output_format: ["png", "jpeg", "webp"],
      },
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "max_images", "seed"],
    },
  },
  "fal-ai/bytedance/seedream/v4.5/edit": {
    modelId: "fal-ai/bytedance/seedream/v4.5/edit",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedream/v4.5/edit/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    defaultResolution: "auto_2K",
    allowedResolutions: ["auto_2K", "auto_4K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredStringArrayFields: [{ field: "image_urls", min: 1, max: 10 }],
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "max_images", "seed"],
    },
  },
  "fal-ai/bytedance/seedream/v5/lite/text-to-image": {
    modelId: "fal-ai/bytedance/seedream/v5/lite/text-to-image",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/text-to-image/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    defaultResolution: "auto_2K",
    allowedResolutions: ["auto_2K", "auto_3K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v5/lite/text-to-image",
    falStatusBaseUrls: [
      "https://queue.fal.run/fal-ai/bytedance/seedream/v5/lite/text-to-image/requests",
    ],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "max_images", "seed"],
    },
  },
  "fal-ai/bytedance/seedream/v5/lite/edit": {
    modelId: "fal-ai/bytedance/seedream/v5/lite/edit",
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/edit/api",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "image_size",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"],
    defaultResolution: "auto_2K",
    allowedResolutions: ["auto_2K", "auto_3K"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/bytedance/seedream/v5/lite/edit",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/bytedance/seedream/v5/lite/edit/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      requiredStringFields: ["prompt"],
      requiredStringArrayFields: [{ field: "image_urls", min: 1, max: 10 }],
      optionalBooleanFields: ["sync_mode", "enable_safety_checker"],
      optionalNumberFields: ["num_images", "max_images", "seed"],
    },
  },
  [KIE_VEO_31_FAST_I2V_MODEL_ID]: {
    modelId: KIE_VEO_31_FAST_I2V_MODEL_ID,
    provider: "kie",
    sourceUrl: "https://docs.kie.ai/",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16"],
    defaultDurationSeconds: 5,
    allowedDurations: [5, 8],
    defaultResolution: "720p",
    allowedResolutions: ["720p", "1080p"],
    kieSubmitUrl: "https://api.kie.ai/api/v1/veo/generate",
    kieStatusBaseUrls: ["https://api.kie.ai/api/v1/veo/record-info?taskId={requestId}"],
    kieTimeoutMs: 60000,
    payloadValidation: {
      allowedTopLevelFields: [
        "prompt",
        "image_url",
        "image_urls",
        "aspect_ratio",
        "duration",
        "duration_seconds",
        "resolution",
        "generate_audio",
        "generation_type",
        "model",
        "callback_url",
        "seed",
        "watermark",
        "enable_translation",
      ],
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["16:9", "9:16"],
        resolution: ["720p", "1080p"],
        generation_type: ["TEXT_2_VIDEO", "FIRST_AND_LAST_FRAMES_2_VIDEO", "REFERENCE_2_VIDEO"],
        model: ["veo3", "veo3_fast"],
      },
      optionalBooleanFields: ["generate_audio", "enable_translation"],
      optionalNumberFields: ["duration", "seed"],
    },
  },
  [KIE_KLING_30_MODEL_ID]: {
    modelId: KIE_KLING_30_MODEL_ID,
    provider: "kie",
    sourceUrl: "https://docs.kie.ai/",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16", "1:1"],
    defaultDurationSeconds: 10,
    allowedDurations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultResolution: "1080p",
    allowedResolutions: ["720p", "1080p"],
    kieSubmitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
    kieStatusBaseUrls: ["https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}"],
    kieTimeoutMs: 60000,
    payloadValidation: {
      allowedTopLevelFields: [
        "prompt",
        "image_url",
        "image_urls",
        "input_url",
        "input_urls",
        "video_url",
        "video_urls",
        "aspect",
        "aspect_ratio",
        "resolution",
        "duration",
        "duration_seconds",
        "cfg_scale",
        "generate_audio",
        "sound",
        "mode",
        "multi_shots",
        "multi_prompt",
        "kling_elements",
        "character_orientation",
        "background_source",
        "callback_url",
        "input",
      ],
      requiredStringFields: ["prompt"],
      requiredAnyOfStringFields: ["image_url"],
      requiredAnyOfStringArrayFields: ["image_urls"],
      enumFields: {
        aspect_ratio: ["16:9", "9:16", "1:1"],
        resolution: ["720p", "1080p"],
      },
      optionalBooleanFields: ["generate_audio"],
      optionalNumberFields: ["duration", "cfg_scale"],
    },
  },
  [KIE_SEEDANCE_15_PRO_MODEL_ID]: {
    modelId: KIE_SEEDANCE_15_PRO_MODEL_ID,
    provider: "kie",
    sourceUrl: "https://docs.kie.ai/market/bytedance/seedance-1-5-pro",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "1:1",
    allowedAspects: ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"],
    defaultDurationSeconds: 4,
    allowedDurations: [4, 8, 12],
    defaultResolution: "720p",
    allowedResolutions: ["480p", "720p", "1080p"],
    kieSubmitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
    kieStatusBaseUrls: ["https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}"],
    kieTimeoutMs: 60000,
    payloadValidation: {
      allowedTopLevelFields: [
        "prompt",
        "input_url",
        "input_urls",
        "image_url",
        "image_urls",
        "aspect",
        "aspect_ratio",
        "duration",
        "duration_seconds",
        "resolution",
        "generate_audio",
        "fixed_lens",
        "nsfw_checker",
        "model",
        "callback_url",
        "input",
      ],
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"],
        resolution: ["480p", "720p", "1080p"],
      },
      optionalBooleanFields: ["generate_audio", "fixed_lens", "nsfw_checker"],
      optionalNumberFields: ["duration"],
    },
  },
  [KIE_SEEDANCE_2_MODEL_ID]: {
    modelId: KIE_SEEDANCE_2_MODEL_ID,
    provider: "kie",
    sourceUrl: "https://docs.kie.ai/market/bytedance/seedance-2",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"],
    defaultDurationSeconds: 5,
    allowedDurations: [5, 10, 15],
    defaultResolution: "1080p",
    allowedResolutions: ["720p", "1080p"],
    kieSubmitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
    kieStatusBaseUrls: ["https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}"],
    kieTimeoutMs: 60000,
    pricingParamAliases: {
      webSearch: ["web_search", "webSearch"],
    },
    payloadValidation: {
      allowedTopLevelFields: [
        "prompt",
        "first_frame_url",
        "last_frame_url",
        "reference_image_urls",
        "reference_video_urls",
        "reference_audio_urls",
        "aspect",
        "aspect_ratio",
        "duration",
        "duration_seconds",
        "resolution",
        "generate_audio",
        "return_last_frame",
        "web_search",
        "model",
        "callBackUrl",
        "callbackUrl",
        "callback_url",
        "input",
      ],
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"],
        resolution: ["720p", "1080p"],
      },
      optionalBooleanFields: ["generate_audio", "return_last_frame", "web_search"],
      optionalNumberFields: ["duration"],
    },
  },
  [KIE_SEEDANCE_2_FAST_MODEL_ID]: {
    modelId: KIE_SEEDANCE_2_FAST_MODEL_ID,
    provider: "kie",
    sourceUrl: "https://docs.kie.ai/market/bytedance/seedance-2-fast",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"],
    defaultDurationSeconds: 5,
    allowedDurations: [5, 10, 15],
    defaultResolution: "1080p",
    allowedResolutions: ["720p", "1080p"],
    kieSubmitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
    kieStatusBaseUrls: ["https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}"],
    kieTimeoutMs: 60000,
    pricingParamAliases: {
      webSearch: ["web_search", "webSearch"],
    },
    payloadValidation: {
      allowedTopLevelFields: [
        "prompt",
        "first_frame_url",
        "last_frame_url",
        "reference_image_urls",
        "reference_video_urls",
        "reference_audio_urls",
        "aspect",
        "aspect_ratio",
        "duration",
        "duration_seconds",
        "resolution",
        "generate_audio",
        "return_last_frame",
        "web_search",
        "model",
        "callBackUrl",
        "callbackUrl",
        "callback_url",
        "input",
      ],
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"],
        resolution: ["720p", "1080p"],
      },
      optionalBooleanFields: ["generate_audio", "return_last_frame", "web_search"],
      optionalNumberFields: ["duration"],
    },
  },
  "gpt-5.4": {
    modelId: "gpt-5.4",
    provider: "openai",
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "none",
    defaultAspect: "text",
    allowedAspects: [],
  },
  "gpt-5.4-mini": {
    modelId: "gpt-5.4-mini",
    provider: "openai",
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "none",
    defaultAspect: "text",
    allowedAspects: [],
  },
  "gpt-5.4-nano": {
    modelId: "gpt-5.4-nano",
    provider: "openai",
    sourceUrl: "https://developers.openai.com/api/docs/pricing",
    verifiedAt: VERIFIED_AT,
    submitAspectField: "none",
    defaultAspect: "text",
    allowedAspects: [],
  },
  [ELEVENLABS_MUSIC_MODEL_ID]: {
    modelId: ELEVENLABS_MUSIC_MODEL_ID,
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    verifiedAt: ELEVENLABS_VERIFIED_AT,
    label: "ElevenLabs Music",
    mediaType: "audio",
    pricingStrategy: "elevenlabs-music-per-minute",
    pricingAuthority: "shared_policy",
    submitAspectField: "none",
    defaultAspect: "audio",
    allowedAspects: [],
    defaultDurationSeconds: 60,
    minDurationSeconds: 8,
    maxDurationSeconds: 180,
    generationLanes: ["music"],
    executionMode: "direct",
    submitHandler: "audio",
    gridEligible: true,
  },
  [ELEVENLABS_SOUND_EFFECTS_MODEL_ID]: {
    modelId: ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    verifiedAt: ELEVENLABS_VERIFIED_AT,
    label: "ElevenLabs Sound Effects",
    mediaType: "audio",
    pricingStrategy: "elevenlabs-sound-effect",
    pricingAuthority: "shared_policy",
    submitAspectField: "none",
    defaultAspect: "audio",
    allowedAspects: [],
    defaultDurationSeconds: 5,
    defaultGenerationCount: 1,
    minDurationSeconds: 0.5,
    maxDurationSeconds: 30,
    generationLanes: ["sfx"],
    executionMode: "direct",
    submitHandler: "audio",
    gridEligible: true,
  },
  [ELEVENLABS_VOICEOVER_MODEL_ID]: {
    modelId: ELEVENLABS_VOICEOVER_MODEL_ID,
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    verifiedAt: ELEVENLABS_VERIFIED_AT,
    label: "ElevenLabs Voiceover",
    mediaType: "audio",
    pricingStrategy: "elevenlabs-text-to-speech-per-kchar",
    pricingAuthority: "shared_policy",
    submitAspectField: "none",
    defaultAspect: "audio",
    allowedAspects: [],
    defaultTextCharacters: 1000,
    generationLanes: ["text-to-speech"],
    executionMode: "direct",
    submitHandler: "audio",
    gridEligible: true,
  },
  [ELEVENLABS_VOICE_CHANGER_MODEL_ID]: {
    modelId: ELEVENLABS_VOICE_CHANGER_MODEL_ID,
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    verifiedAt: ELEVENLABS_VERIFIED_AT,
    label: "ElevenLabs Voice Changer",
    mediaType: "audio",
    pricingStrategy: "elevenlabs-voice-changer-per-minute",
    pricingAuthority: "shared_policy",
    submitAspectField: "none",
    defaultAspect: "audio",
    allowedAspects: [],
    defaultSourceDurationSeconds: 60,
    generationLanes: ["speech-to-speech"],
    executionMode: "direct",
    submitHandler: "audio",
    gridEligible: true,
  },
  [ELEVENLABS_VOICE_DESIGN_MODEL_ID]: {
    modelId: ELEVENLABS_VOICE_DESIGN_MODEL_ID,
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    verifiedAt: ELEVENLABS_VERIFIED_AT,
    label: "ElevenLabs Voice Design",
    mediaType: "audio",
    pricingAuthority: "metadata_only",
    submitAspectField: "none",
    defaultAspect: "audio",
    allowedAspects: [],
    generationLanes: ["voice-design"],
    executionMode: "direct",
    submitHandler: "audio",
    gridEligible: false,
  },
};
const activePickerPricingRuntime = (
  metadata: ModelCatalogRuntimeMetadata
): ModelCatalogRuntimeMetadata => ({
  lifecycle: "active",
  surfaces: ["picker", "pricing", "runtime"],
  billable: true,
  ...metadata,
});

const activeHiddenPricingRuntime = (
  metadata: ModelCatalogRuntimeMetadata
): ModelCatalogRuntimeMetadata => ({
  lifecycle: "active",
  surfaces: ["hidden_tool", "pricing", "runtime"],
  billable: true,
  ...metadata,
});

const activeInternalPricingRuntime = (
  metadata: ModelCatalogRuntimeMetadata
): ModelCatalogRuntimeMetadata => ({
  lifecycle: "active",
  surfaces: ["internal_helper", "pricing", "runtime"],
  billable: true,
  ...metadata,
});

const activeAudioPricingRuntime = (
  metadata: ModelCatalogRuntimeMetadata
): ModelCatalogRuntimeMetadata => ({
  lifecycle: "active",
  surfaces: ["audio_tool", "pricing", "runtime"],
  billable: true,
  ...metadata,
});

const activeMetadataRuntime = (
  metadata: ModelCatalogRuntimeMetadata
): ModelCatalogRuntimeMetadata => ({
  lifecycle: "active",
  surfaces: ["metadata", "runtime"],
  billable: false,
  ...metadata,
});

const runtimeMetadataByModelId: Record<string, ModelCatalogRuntimeMetadata> = {
  "fal-ai/flux-2/klein/9b": activePickerPricingRuntime({
    label: "FLUX.2 Lite",
    mediaType: "image",
    pricingStrategy: "fal-economy-image-per-mp",
    displayFamily: "Image",
    displayOrder: 100,
    pricingFamily: "Image",
    logoKey: "flux",
    sizeMapId: "fal-image",
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    gridEligible: true,
    apiRouteSlug: "flux2klein",
  }),
  "fal-ai/flux-pro/v1/fill": activeHiddenPricingRuntime({
    label: "FLUX Pro Fill",
    mediaType: "image",
    pricingStrategy: "fal-fill-per-mp",
    displayFamily: "Image tools",
    displayOrder: 210,
    pricingFamily: "Image tools",
    logoKey: "flux",
    surfaceNote: "Internal image fill tool.",
    sizeMapId: "fal-image",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    gridEligible: true,
    apiRouteSlug: "flux-pro-fill",
  }),
  "fal-ai/flux-kontext-lora/inpaint": activeHiddenPricingRuntime({
    label: "FLUX Kontext Inpaint",
    mediaType: "image",
    pricingStrategy: "fal-flux-kontext-inpaint-per-mp",
    displayFamily: "Image tools",
    displayOrder: 220,
    pricingFamily: "Image tools",
    logoKey: "flux",
    surfaceNote: "Internal inpaint tool.",
    sizeMapId: "fal-image",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    gridEligible: true,
    apiRouteSlug: "flux-kontext-inpaint",
  }),
  "fal-ai/bria/background/remove": activeHiddenPricingRuntime({
    label: "Bria Background Remove",
    mediaType: "image",
    pricingStrategy: "fal-economy-image-per-mp",
    displayFamily: "Image tools",
    displayOrder: 230,
    pricingFamily: "Image tools",
    surfaceNote: "Internal background removal tool.",
    sizeMapId: "fal-image",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    gridEligible: false,
    apiRouteSlug: "bria-background-remove",
  }),
  "gpt-image-2": activePickerPricingRuntime({
    label: "ChatGPT Image 2",
    mediaType: "image",
    pricingStrategy: "gpt-image-2-per-image",
    displayFamily: "Image",
    displayOrder: 110,
    pricingFamily: "Image",
    logoKey: "openai",
    supportsTextToImage: true,
    supportsImageToImage: true,
    generationLanes: ["text-to-image", "image-to-image"],
    executionMode: "direct",
    submitHandler: "default",
    gridEligible: true,
  }),
  "fal-ai/nano-banana": activePickerPricingRuntime({
    label: "Nano Banana",
    mediaType: "image",
    pricingStrategy: "google-nano-banana-per-image",
    displayFamily: "Image",
    displayOrder: 120,
    pricingFamily: "Image",
    logoKey: "google",
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "default",
    gridEligible: true,
    apiRouteSlug: "nano-banana",
  }),
  "fal-ai/nano-banana/edit": activePickerPricingRuntime({
    label: "Nano Banana Edit",
    mediaType: "image",
    pricingStrategy: "google-nano-banana-per-image",
    displayFamily: "Image",
    displayOrder: 130,
    pricingFamily: "Image",
    logoKey: "google",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    gridEligible: true,
    apiRouteSlug: "nano-banana-edit",
  }),
  "fal-ai/nano-banana-2": activePickerPricingRuntime({
    label: "Nano Banana 2",
    mediaType: "image",
    pricingStrategy: "nano-banana-2-per-image",
    displayFamily: "Image",
    displayOrder: 140,
    pricingFamily: "Image",
    logoKey: "google",
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "default",
    gridEligible: true,
    apiRouteSlug: "nano-banana-2",
  }),
  "fal-ai/nano-banana-2/edit": activePickerPricingRuntime({
    label: "Nano Banana 2 Edit",
    mediaType: "image",
    pricingStrategy: "nano-banana-2-per-image",
    displayFamily: "Image",
    displayOrder: 150,
    pricingFamily: "Image",
    logoKey: "google",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    gridEligible: true,
    apiRouteSlug: "nano-banana-2-edit",
  }),
  "fal-ai/nano-banana-pro": activePickerPricingRuntime({
    label: "Nano Banana Pro",
    mediaType: "image",
    pricingStrategy: "nano-banana-per-image",
    displayFamily: "Image",
    displayOrder: 160,
    pricingFamily: "Image",
    logoKey: "google",
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "default",
    gridEligible: true,
    apiRouteSlug: "nano-banana-pro",
  }),
  "fal-ai/nano-banana-pro/edit": activePickerPricingRuntime({
    label: "Nano Banana Pro Edit",
    mediaType: "image",
    pricingStrategy: "nano-banana-per-image",
    displayFamily: "Image",
    displayOrder: 170,
    pricingFamily: "Image",
    logoKey: "google",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    gridEligible: true,
    apiRouteSlug: "nano-banana-pro-edit",
  }),
  "fal-ai/bytedance/seedream/v4.5/text-to-image": activePickerPricingRuntime({
    label: "Seedream 4.5",
    mediaType: "image",
    pricingStrategy: "seedream-per-image",
    displayFamily: "Image",
    displayOrder: 210,
    pricingFamily: "Image",
    logoKey: "seedream",
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "default",
    gridEligible: true,
    apiRouteSlug: "seedream",
  }),
  "fal-ai/bytedance/seedream/v4.5/edit": activePickerPricingRuntime({
    label: "Seedream 4.5 Edit",
    mediaType: "image",
    pricingStrategy: "seedream-per-image",
    displayFamily: "Image",
    displayOrder: 200,
    pricingFamily: "Image",
    logoKey: "seedream",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    gridEligible: true,
    apiRouteSlug: "seedream-edit",
  }),
  "fal-ai/bytedance/seedream/v5/lite/text-to-image": activePickerPricingRuntime({
    label: "Seedream 5 Lite",
    mediaType: "image",
    pricingStrategy: "seedream-5-lite-per-image",
    displayFamily: "Image",
    displayOrder: 180,
    pricingFamily: "Image",
    logoKey: "seedream",
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "default",
    gridEligible: true,
    apiRouteSlug: "seedream-v5-lite",
  }),
  "fal-ai/bytedance/seedream/v5/lite/edit": activePickerPricingRuntime({
    label: "Seedream 5 Lite Edit",
    mediaType: "image",
    pricingStrategy: "seedream-5-lite-per-image",
    displayFamily: "Image",
    displayOrder: 190,
    pricingFamily: "Image",
    logoKey: "seedream",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    gridEligible: true,
    apiRouteSlug: "seedream-v5-lite-edit",
  }),
  [KIE_VEO_31_FAST_I2V_MODEL_ID]: activePickerPricingRuntime({
    label: "Veo 3.1 Fast I2V (Kie)",
    mediaType: "image-to-video",
    pricingStrategy: "veo-3-per-second",
    displayFamily: "Video",
    displayOrder: 10,
    pricingFamily: "Video",
    logoKey: "google",
    minDurationSeconds: 5,
    maxDurationSeconds: 8,
    defaultAudio: true,
    supportsImageToVideo: true,
    generationLanes: ["text-to-video", "image-to-video"],
    executionMode: "queued",
    submitHandler: "video",
    gridEligible: true,
    apiRouteSlug: "kie-veo",
  }),
  [KIE_KLING_30_MODEL_ID]: activePickerPricingRuntime({
    label: "Kling 3.0 (Kie)",
    mediaType: "image-to-video",
    pricingStrategy: "kling-3-per-second",
    displayFamily: "Video",
    displayOrder: 20,
    pricingFamily: "Video",
    logoKey: "kling",
    minDurationSeconds: 5,
    maxDurationSeconds: 15,
    defaultAudio: true,
    supportsImageToVideo: true,
    generationLanes: ["image-to-video"],
    executionMode: "queued",
    submitHandler: "video",
    gridEligible: true,
    apiRouteSlug: "kie-kling",
  }),
  [KIE_SEEDANCE_15_PRO_MODEL_ID]: activePickerPricingRuntime({
    label: "Seedance 1.5 Pro (Kie)",
    mediaType: "image-to-video",
    pricingStrategy: "seedance-1.5-per-second",
    displayFamily: "Video",
    displayOrder: 30,
    pricingFamily: "Video",
    logoKey: "seedream",
    minDurationSeconds: 4,
    maxDurationSeconds: 12,
    defaultAudio: true,
    supportsImageToVideo: true,
    generationLanes: ["text-to-video", "image-to-video"],
    executionMode: "queued",
    submitHandler: "video",
    gridEligible: true,
    apiRouteSlug: "kie-seedance",
  }),
  [KIE_SEEDANCE_2_MODEL_ID]: activePickerPricingRuntime({
    label: "Seedance 2.0 (Kie)",
    mediaType: "image-to-video",
    pricingStrategy: "seedance-2-per-second",
    displayFamily: "Video",
    displayOrder: 40,
    pricingFamily: "Video",
    visibilityFlag: "NEXT_PUBLIC_KIE_SEEDANCE_2_ENABLED",
    logoKey: "seedream",
    minDurationSeconds: 5,
    maxDurationSeconds: 15,
    defaultAudio: true,
    supportsImageToVideo: true,
    generationLanes: ["text-to-video", "image-to-video"],
    executionMode: "queued",
    submitHandler: "video",
    gridEligible: true,
    apiRouteSlug: "kie-seedance-2",
  }),
  [KIE_SEEDANCE_2_FAST_MODEL_ID]: activePickerPricingRuntime({
    label: "Seedance 2.0 Fast (Kie)",
    mediaType: "image-to-video",
    pricingStrategy: "seedance-2-fast-per-second",
    displayFamily: "Video",
    displayOrder: 50,
    pricingFamily: "Video",
    visibilityFlag: "NEXT_PUBLIC_KIE_SEEDANCE_2_ENABLED",
    logoKey: "seedream",
    minDurationSeconds: 5,
    maxDurationSeconds: 15,
    defaultAudio: true,
    supportsImageToVideo: true,
    generationLanes: ["text-to-video", "image-to-video"],
    executionMode: "queued",
    submitHandler: "video",
    gridEligible: true,
    apiRouteSlug: "kie-seedance-2-fast",
  }),
  "gpt-5.4": activeInternalPricingRuntime({
    label: "GPT-5.4",
    mediaType: "text",
    pricingStrategy: "openai-text-token",
    displayFamily: "Text",
    displayOrder: 300,
    pricingFamily: "Text",
    logoKey: "openai",
    generationLanes: ["text"],
    executionMode: "none",
    submitHandler: "unsupported",
    gridEligible: false,
  }),
  "gpt-5.4-mini": activeInternalPricingRuntime({
    label: "GPT-5.4 Mini",
    mediaType: "text",
    pricingStrategy: "openai-text-token",
    displayFamily: "Text",
    displayOrder: 310,
    pricingFamily: "Text",
    logoKey: "openai",
    generationLanes: ["text"],
    executionMode: "none",
    submitHandler: "unsupported",
    gridEligible: false,
  }),
  "gpt-5.4-nano": activeInternalPricingRuntime({
    label: "GPT-5.4 Nano",
    mediaType: "text",
    pricingStrategy: "openai-text-token",
    displayFamily: "Text",
    displayOrder: 320,
    pricingFamily: "Text",
    logoKey: "openai",
    generationLanes: ["text"],
    executionMode: "none",
    submitHandler: "unsupported",
    gridEligible: false,
  }),
  [ELEVENLABS_MUSIC_MODEL_ID]: activeAudioPricingRuntime({
    displayFamily: "Audio",
    displayOrder: 400,
    pricingFamily: "Audio",
    logoKey: "elevenlabs",
  }),
  [ELEVENLABS_SOUND_EFFECTS_MODEL_ID]: activeAudioPricingRuntime({
    displayFamily: "Audio",
    displayOrder: 410,
    pricingFamily: "Audio",
    logoKey: "elevenlabs",
  }),
  [ELEVENLABS_VOICEOVER_MODEL_ID]: activeAudioPricingRuntime({
    displayFamily: "Audio",
    displayOrder: 420,
    pricingFamily: "Audio",
    logoKey: "elevenlabs",
  }),
  [ELEVENLABS_VOICE_CHANGER_MODEL_ID]: activeAudioPricingRuntime({
    displayFamily: "Audio",
    displayOrder: 430,
    pricingFamily: "Audio",
    logoKey: "elevenlabs",
  }),
  [ELEVENLABS_VOICE_DESIGN_MODEL_ID]: activeMetadataRuntime({
    displayFamily: "Audio",
    displayOrder: 440,
    pricingFamily: "Audio",
    logoKey: "elevenlabs",
    surfaceNote: "Metadata-only voice design model; debit happens through generated speech output.",
  }),
};

export const MODEL_CATALOG: Record<string, ModelCatalogEntry> = Object.fromEntries(
  Object.entries(catalogBase).map(([modelId, entry]) => [
    modelId,
    {
      ...entry,
      ...(runtimeMetadataByModelId[modelId] ?? {}),
    },
  ])
);

export const listModelCatalogEntries = (): ModelCatalogEntry[] => Object.values(MODEL_CATALOG);

export const getModelCatalogEntry = (modelId: string): ModelCatalogEntry | null =>
  MODEL_CATALOG[modelId] ?? null;

export const getFalSubmitUrlByModelId = (modelId: string): string | null =>
  getModelCatalogEntry(modelId)?.falSubmitUrl ?? null;

export const getFalStatusBaseUrlsByModelId = (modelId: string): string[] =>
  getModelCatalogEntry(modelId)?.falStatusBaseUrls ?? [];

export const getFalTimeoutMsByModelId = (modelId: string): number | null =>
  getModelCatalogEntry(modelId)?.falTimeoutMs ?? null;

export const getKieSubmitUrlByModelId = (modelId: string): string | null =>
  getModelCatalogEntry(modelId)?.kieSubmitUrl ?? null;

export const getKieStatusBaseUrlsByModelId = (modelId: string): string[] =>
  getModelCatalogEntry(modelId)?.kieStatusBaseUrls ?? [];

export const getKieTimeoutMsByModelId = (modelId: string): number | null =>
  getModelCatalogEntry(modelId)?.kieTimeoutMs ?? null;

export const getModelPayloadValidationSpec = (modelId: string): ModelPayloadValidationSpec | null =>
  getModelCatalogEntry(modelId)?.payloadValidation ?? null;
