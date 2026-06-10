/**
 * Canonical model catalog shared by AI Studio client logic and server runtime.
 * Keep model capabilities, provider docs provenance, and Fal routing aliases in one place.
 */
import type { ElevenLabsModelPricingAuthority } from "./elevenLabsModels";
import {
  ELEVENLABS_MUSIC_DURATION_MAX_SECONDS,
  ELEVENLABS_MUSIC_DURATION_MIN_SECONDS,
  ELEVENLABS_SOUND_EFFECT_DURATION_MAX_SECONDS,
  ELEVENLABS_SOUND_EFFECT_DURATION_MIN_SECONDS,
} from "./elevenLabsAudioDurations";
import {
  ELEVENLABS_MUSIC_MODEL_ID,
  ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
  ELEVENLABS_VOICEOVER_MODEL_ID,
  ELEVENLABS_VOICE_CHANGER_MODEL_ID,
  ELEVENLABS_VOICE_DESIGN_MODEL_ID,
} from "./elevenLabsModels";
import type { PricingStrategyId } from "./pricingTypes";
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "./providerModelIds";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_NANO_BANANA_2_EDIT_MODEL_ID,
  FAL_NANO_BANANA_2_MODEL_ID,
  FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
  FAL_NANO_BANANA_PRO_MODEL_ID,
  FAL_OMNIHUMAN_V15_MODEL_ID,
  FAL_SEEDREAM_45_EDIT_MODEL_ID,
  FAL_SEEDREAM_45_TEXT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
  FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
} from "./falModelIds";
import { OPENAI_GPT_IMAGE_2_PROVIDER_ALLOWED_SIZES } from "./openAiImage2";
import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_ALLOWED_ASPECTS,
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_ALLOWED_RESOLUTIONS,
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_DEFAULT_ASPECT,
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_DEFAULT_RESOLUTION,
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_PROVIDER_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_ALLOWED_ASPECTS,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_ALLOWED_RESOLUTIONS,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_DEFAULT_ASPECT,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_DEFAULT_RESOLUTION,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_PROVIDER_MODEL_ID,
} from "./kieGptImage2";
import type { ModelSubmissionAdapterKey } from "./submissionAdapterMetadata";
export type { ModelSubmissionAdapterKey } from "./submissionAdapterMetadata";

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
  | "lip-sync"
  | "text-to-speech"
  | "speech-to-speech"
  | "music"
  | "sfx"
  | "voice-design"
  | "text";
export type GenerationExecutionMode = "queued" | "direct" | "none";
export type GenerationSubmitHandler = "default" | "image" | "video" | "audio" | "unsupported";
export type ModelPromptPolicy = "required" | "optional";
export type ModelAdmissionTier = "video_long" | "image_heavy" | "image_standard";
export type ModelLifecycle = "active" | "deprecated" | "disabled" | "retired";
export type ModelDefaultRole =
  | "create-startup"
  | "create-character-mode-startup"
  | "edit-startup"
  | "audio-music"
  | "audio-sfx"
  | "audio-voiceover"
  | "audio-voice-changer"
  | "audio-voice-design"
  | "ai-studio-text-prompt"
  | "studio-agent-chat"
  | "studio-agent-vision"
  | "style-extraction-vision"
  | "style-extraction-fallback";
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
  apiDocFile?: string;
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
  pairedModelId?: string;
  replacementModelId?: string;
  createCharacterModeOrder?: number;
  promptPolicy?: ModelPromptPolicy;
  admissionTier?: ModelAdmissionTier;
  alwaysOnProviderRuntime?: boolean;
  defaultRoles?: ModelDefaultRole[];
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
  submissionAdapterKey?: ModelSubmissionAdapterKey;
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

const DEFAULT_ROLE_FALLBACK_MODEL_IDS: Record<ModelDefaultRole, string> = {
  "create-startup": FAL_SEEDREAM_45_TEXT_MODEL_ID,
  "create-character-mode-startup": FAL_SEEDREAM_45_EDIT_MODEL_ID,
  "edit-startup": FAL_SEEDREAM_45_EDIT_MODEL_ID,
  "audio-music": ELEVENLABS_MUSIC_MODEL_ID,
  "audio-sfx": ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
  "audio-voiceover": ELEVENLABS_VOICEOVER_MODEL_ID,
  "audio-voice-changer": ELEVENLABS_VOICE_CHANGER_MODEL_ID,
  "audio-voice-design": ELEVENLABS_VOICE_DESIGN_MODEL_ID,
  "ai-studio-text-prompt": "gpt-5.5",
  "studio-agent-chat": "gpt-5.5",
  "studio-agent-vision": "gpt-5.5",
  "style-extraction-vision": "gpt-5.4-mini",
  "style-extraction-fallback": "gpt-5.4",
};

const VERIFIED_AT = "2026-04-30";
const KONTEXT_INPAINT_VERIFIED_AT = "2026-04-14";
const GPT_IMAGE_2_VERIFIED_AT = "2026-04-27";
const KIE_GPT_IMAGE_2_VERIFIED_AT = "2026-06-04";
const OMNIHUMAN_V15_VERIFIED_AT = "2026-06-08";
const OPENAI_TEXT_VERIFIED_AT = "2026-05-07";
const ELEVENLABS_VERIFIED_AT = "2026-05-01";
const SEEDANCE_ALLOWED_DURATIONS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;
type ModelCatalogRuntimeMetadata = Pick<
  ModelCatalogEntry,
  | "apiDocFile"
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
  | "pairedModelId"
  | "replacementModelId"
  | "createCharacterModeOrder"
  | "promptPolicy"
  | "admissionTier"
  | "alwaysOnProviderRuntime"
  | "defaultRoles"
  | "defaultAudio"
  | "supportsTextToImage"
  | "supportsImageToImage"
  | "supportsImageToVideo"
  | "generationLanes"
  | "executionMode"
  | "submitHandler"
  | "submissionAdapterKey"
  | "gridEligible"
  | "apiRouteSlug"
  | "defaultGenerationCount"
  | "defaultSourceDurationSeconds"
  | "defaultTextCharacters"
  | "minDurationSeconds"
  | "maxDurationSeconds"
>;

const catalogBase: Record<string, ModelCatalogEntry> = {
  [FAL_FLUX_2_KLEIN_9B_MODEL_ID]: {
    modelId: FAL_FLUX_2_KLEIN_9B_MODEL_ID,
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/flux-2/klein/9b/api",
    verifiedAt: VERIFIED_AT,
    apiDocFile: "api-fal-flux-2-klein-9b.md",
    submitAspectField: "image_size",
    defaultAspect: "4:3",
    allowedAspects: ["1:1", "4:3", "3:4", "16:9", "9:16"],
    defaultResolution: "model_default",
    allowedResolutions: ["model_default"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/flux-2/klein/9b",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/flux-2/klein/9b/requests"],
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
    apiDocFile: "api-fal-flux-pro-fill.md",
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
    apiDocFile: "api-fal-flux-kontext-inpaint.md",
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
    apiDocFile: "api-fal-bria-background-remove.md",
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
    apiDocFile: "api-openai-gpt-image-2.md",
    submitAspectField: "none",
    defaultAspect: "1:1",
    allowedAspects: ["auto", "9:16", "4:5", "1:1", "5:4", "16:9"],
    defaultResolution: "medium",
    allowedResolutions: ["low", "medium", "high"],
    payloadValidation: {
      requiredStringFields: ["prompt"],
      enumFields: {
        size: [...OPENAI_GPT_IMAGE_2_PROVIDER_ALLOWED_SIZES],
        quality: ["low", "medium", "high"],
        output_format: ["png", "jpeg", "webp"],
        moderation: ["auto", "low"],
      },
      optionalNumberFields: ["n", "output_compression"],
    },
  },
  [FAL_NANO_BANANA_2_MODEL_ID]: {
    modelId: FAL_NANO_BANANA_2_MODEL_ID,
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-2/api",
    verifiedAt: VERIFIED_AT,
    apiDocFile: "api-fal-nano-banana-2.md",
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
  [FAL_NANO_BANANA_2_EDIT_MODEL_ID]: {
    modelId: FAL_NANO_BANANA_2_EDIT_MODEL_ID,
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-2/edit/api",
    verifiedAt: VERIFIED_AT,
    apiDocFile: "api-fal-nano-banana-2-edit.md",
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
  [FAL_NANO_BANANA_PRO_MODEL_ID]: {
    modelId: FAL_NANO_BANANA_PRO_MODEL_ID,
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-pro/api",
    verifiedAt: VERIFIED_AT,
    apiDocFile: "api-fal-nano-banana-pro.md",
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
  [FAL_NANO_BANANA_PRO_EDIT_MODEL_ID]: {
    modelId: FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/nano-banana-pro/edit/api",
    verifiedAt: VERIFIED_AT,
    apiDocFile: "api-fal-nano-banana-pro-edit.md",
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
    apiDocFile: "api-fal-seedream-4-5.md",
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
    apiDocFile: "api-fal-seedream-4-5-edit.md",
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
  [FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID]: {
    modelId: FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/text-to-image/api",
    verifiedAt: VERIFIED_AT,
    apiDocFile: "api-fal-seedream-5-lite.md",
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
  [FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID]: {
    modelId: FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/seedream/v5/lite/edit/api",
    verifiedAt: VERIFIED_AT,
    apiDocFile: "api-fal-seedream-5-lite-edit.md",
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
    apiDocFile: "api-kie-veo-3-1-fast-image-to-video.md",
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["16:9", "9:16"],
    defaultDurationSeconds: 6,
    allowedDurations: [4, 6, 8],
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
    apiDocFile: "api-kie-kling-3-0.md",
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
  [KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID]: {
    modelId: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
    provider: "kie",
    sourceUrl: "https://docs.kie.ai/",
    verifiedAt: KIE_GPT_IMAGE_2_VERIFIED_AT,
    apiDocFile: "api-kie-gpt-image-2-text-to-image.md",
    submitAspectField: "aspect_ratio",
    defaultAspect: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_DEFAULT_ASPECT,
    allowedAspects: [...KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_ALLOWED_ASPECTS],
    defaultResolution: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_DEFAULT_RESOLUTION,
    allowedResolutions: [...KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_ALLOWED_RESOLUTIONS],
    providerModelId: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_PROVIDER_MODEL_ID,
    kieSubmitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
    kieStatusBaseUrls: ["https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}"],
    kieTimeoutMs: 60000,
    payloadValidation: {
      allowedTopLevelFields: [
        "prompt",
        "aspect",
        "aspectRatio",
        "aspect_ratio",
        "resolution",
        "enable_safety_checker",
        "safety_tolerance",
        "model",
        "callBackUrl",
        "callbackUrl",
        "callback_url",
        "input",
      ],
      requiredStringFields: ["prompt"],
      enumFields: {
        aspect_ratio: [...KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_ALLOWED_ASPECTS],
        resolution: [...KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_ALLOWED_RESOLUTIONS],
      },
      optionalBooleanFields: ["enable_safety_checker"],
      optionalNumberFields: ["safety_tolerance"],
    },
  },
  [KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID]: {
    modelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
    provider: "kie",
    sourceUrl: "https://docs.kie.ai/",
    verifiedAt: KIE_GPT_IMAGE_2_VERIFIED_AT,
    apiDocFile: "api-kie-gpt-image-2-image-to-image.md",
    submitAspectField: "aspect_ratio",
    defaultAspect: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_DEFAULT_ASPECT,
    allowedAspects: [...KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_ALLOWED_ASPECTS],
    defaultResolution: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_DEFAULT_RESOLUTION,
    allowedResolutions: [...KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_ALLOWED_RESOLUTIONS],
    providerModelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_PROVIDER_MODEL_ID,
    kieSubmitUrl: "https://api.kie.ai/api/v1/jobs/createTask",
    kieStatusBaseUrls: ["https://api.kie.ai/api/v1/jobs/recordInfo?taskId={requestId}"],
    kieTimeoutMs: 60000,
    payloadValidation: {
      allowedTopLevelFields: [
        "prompt",
        "image_url",
        "imageUrl",
        "image_urls",
        "imageUrls",
        "input_url",
        "inputUrl",
        "input_urls",
        "inputUrls",
        "input_image_count",
        "aspect",
        "aspectRatio",
        "aspect_ratio",
        "resolution",
        "enable_safety_checker",
        "safety_tolerance",
        "model",
        "callBackUrl",
        "callbackUrl",
        "callback_url",
        "input",
      ],
      requiredStringFields: ["prompt"],
      requiredAnyOfStringFields: ["image_url", "imageUrl", "input_url", "inputUrl"],
      requiredAnyOfStringArrayFields: ["image_urls", "imageUrls", "input_urls", "inputUrls"],
      enumFields: {
        aspect_ratio: [...KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_ALLOWED_ASPECTS],
        resolution: [...KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_ALLOWED_RESOLUTIONS],
      },
      optionalBooleanFields: ["enable_safety_checker"],
      optionalNumberFields: ["safety_tolerance"],
    },
  },
  [KIE_SEEDANCE_2_MODEL_ID]: {
    modelId: KIE_SEEDANCE_2_MODEL_ID,
    provider: "kie",
    sourceUrl: "https://docs.kie.ai/market/bytedance/seedance-2",
    verifiedAt: VERIFIED_AT,
    apiDocFile: "api-kie-seedance-2.md",
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"],
    defaultDurationSeconds: 5,
    allowedDurations: [...SEEDANCE_ALLOWED_DURATIONS],
    defaultResolution: "1080p",
    allowedResolutions: ["1080p", "720p", "480p"],
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
        resolution: ["480p", "720p", "1080p"],
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
    apiDocFile: "api-kie-seedance-2-fast.md",
    submitAspectField: "aspect_ratio",
    defaultAspect: "16:9",
    allowedAspects: ["1:1", "21:9", "4:3", "3:4", "16:9", "9:16"],
    defaultDurationSeconds: 5,
    allowedDurations: [...SEEDANCE_ALLOWED_DURATIONS],
    defaultResolution: "720p",
    allowedResolutions: ["720p", "480p"],
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
        resolution: ["480p", "720p"],
      },
      optionalBooleanFields: ["generate_audio", "return_last_frame", "web_search"],
      optionalNumberFields: ["duration"],
    },
  },
  [FAL_OMNIHUMAN_V15_MODEL_ID]: {
    modelId: FAL_OMNIHUMAN_V15_MODEL_ID,
    provider: "fal",
    sourceUrl: "https://fal.ai/models/fal-ai/bytedance/omnihuman/v1.5/api",
    verifiedAt: OMNIHUMAN_V15_VERIFIED_AT,
    apiDocFile: "api-fal-omnihuman-v1-5.md",
    submitAspectField: "none",
    defaultAspect: "video",
    allowedAspects: [],
    defaultDurationSeconds: 10,
    minDurationSeconds: 1,
    maxDurationSeconds: 60,
    defaultResolution: "1080p",
    allowedResolutions: ["720p", "1080p"],
    falSubmitUrl: "https://queue.fal.run/fal-ai/bytedance/omnihuman/v1.5",
    falStatusBaseUrls: ["https://queue.fal.run/fal-ai/bytedance/requests"],
    falTimeoutMs: 60000,
    payloadValidation: {
      allowedTopLevelFields: [
        "prompt",
        "image_url",
        "audio_url",
        "mask_url",
        "turbo_mode",
        "resolution",
      ],
      requiredStringFields: ["image_url", "audio_url"],
      enumFields: {
        resolution: ["720p", "1080p"],
      },
      optionalBooleanFields: ["turbo_mode"],
    },
  },
  "gpt-5.5": {
    modelId: "gpt-5.5",
    provider: "openai",
    sourceUrl: "https://openai.com/api/pricing/",
    verifiedAt: OPENAI_TEXT_VERIFIED_AT,
    apiDocFile: "api-responses.md",
    submitAspectField: "none",
    defaultAspect: "text",
    allowedAspects: [],
  },
  "gpt-5.5-pro": {
    modelId: "gpt-5.5-pro",
    provider: "openai",
    sourceUrl: "https://openai.com/api/pricing/",
    verifiedAt: OPENAI_TEXT_VERIFIED_AT,
    apiDocFile: "api-responses.md",
    submitAspectField: "none",
    defaultAspect: "text",
    allowedAspects: [],
  },
  "gpt-5.4": {
    modelId: "gpt-5.4",
    provider: "openai",
    sourceUrl: "https://openai.com/api/pricing/",
    verifiedAt: OPENAI_TEXT_VERIFIED_AT,
    apiDocFile: "api-responses.md",
    submitAspectField: "none",
    defaultAspect: "text",
    allowedAspects: [],
  },
  "gpt-5.4-pro": {
    modelId: "gpt-5.4-pro",
    provider: "openai",
    sourceUrl: "https://openai.com/api/pricing/",
    verifiedAt: OPENAI_TEXT_VERIFIED_AT,
    apiDocFile: "api-responses.md",
    submitAspectField: "none",
    defaultAspect: "text",
    allowedAspects: [],
  },
  "gpt-5.4-mini": {
    modelId: "gpt-5.4-mini",
    provider: "openai",
    sourceUrl: "https://openai.com/api/pricing/",
    verifiedAt: OPENAI_TEXT_VERIFIED_AT,
    apiDocFile: "api-responses.md",
    submitAspectField: "none",
    defaultAspect: "text",
    allowedAspects: [],
  },
  "gpt-5.4-nano": {
    modelId: "gpt-5.4-nano",
    provider: "openai",
    sourceUrl: "https://openai.com/api/pricing/",
    verifiedAt: OPENAI_TEXT_VERIFIED_AT,
    apiDocFile: "api-responses.md",
    submitAspectField: "none",
    defaultAspect: "text",
    allowedAspects: [],
  },
  [ELEVENLABS_MUSIC_MODEL_ID]: {
    modelId: ELEVENLABS_MUSIC_MODEL_ID,
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    verifiedAt: ELEVENLABS_VERIFIED_AT,
    apiDocFile: "api-elevenlabs-audio-models.md",
    label: "Music",
    mediaType: "audio",
    pricingStrategy: "elevenlabs-music-per-minute",
    pricingAuthority: "shared_policy",
    submitAspectField: "none",
    defaultAspect: "audio",
    allowedAspects: [],
    defaultDurationSeconds: 60,
    minDurationSeconds: ELEVENLABS_MUSIC_DURATION_MIN_SECONDS,
    maxDurationSeconds: ELEVENLABS_MUSIC_DURATION_MAX_SECONDS,
    generationLanes: ["music"],
    executionMode: "direct",
    submitHandler: "audio",
    defaultRoles: ["audio-music"],
    gridEligible: true,
  },
  [ELEVENLABS_SOUND_EFFECTS_MODEL_ID]: {
    modelId: ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    verifiedAt: ELEVENLABS_VERIFIED_AT,
    apiDocFile: "api-elevenlabs-audio-models.md",
    label: "Sound Effects",
    mediaType: "audio",
    pricingStrategy: "elevenlabs-sound-effect",
    pricingAuthority: "shared_policy",
    submitAspectField: "none",
    defaultAspect: "audio",
    allowedAspects: [],
    defaultDurationSeconds: 5,
    defaultGenerationCount: 1,
    minDurationSeconds: ELEVENLABS_SOUND_EFFECT_DURATION_MIN_SECONDS,
    maxDurationSeconds: ELEVENLABS_SOUND_EFFECT_DURATION_MAX_SECONDS,
    generationLanes: ["sfx"],
    executionMode: "direct",
    submitHandler: "audio",
    defaultRoles: ["audio-sfx"],
    gridEligible: true,
  },
  [ELEVENLABS_VOICEOVER_MODEL_ID]: {
    modelId: ELEVENLABS_VOICEOVER_MODEL_ID,
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    verifiedAt: ELEVENLABS_VERIFIED_AT,
    apiDocFile: "api-elevenlabs-audio-models.md",
    label: "Voiceover",
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
    defaultRoles: ["audio-voiceover"],
    gridEligible: true,
  },
  [ELEVENLABS_VOICE_CHANGER_MODEL_ID]: {
    modelId: ELEVENLABS_VOICE_CHANGER_MODEL_ID,
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    verifiedAt: ELEVENLABS_VERIFIED_AT,
    apiDocFile: "api-elevenlabs-audio-models.md",
    label: "Voice Changer",
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
    defaultRoles: ["audio-voice-changer"],
    gridEligible: true,
  },
  [ELEVENLABS_VOICE_DESIGN_MODEL_ID]: {
    modelId: ELEVENLABS_VOICE_DESIGN_MODEL_ID,
    provider: "elevenlabs",
    sourceUrl: "https://elevenlabs.io/docs",
    verifiedAt: ELEVENLABS_VERIFIED_AT,
    apiDocFile: "api-elevenlabs-audio-models.md",
    label: "Voice Design",
    mediaType: "audio",
    pricingAuthority: "metadata_only",
    submitAspectField: "none",
    defaultAspect: "audio",
    allowedAspects: [],
    generationLanes: ["voice-design"],
    executionMode: "direct",
    submitHandler: "audio",
    defaultRoles: ["audio-voice-design"],
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

const disabledHiddenCatalogRuntime = (
  metadata: ModelCatalogRuntimeMetadata
): ModelCatalogRuntimeMetadata => ({
  lifecycle: "disabled",
  surfaces: ["hidden_tool"],
  billable: false,
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
  [FAL_FLUX_2_KLEIN_9B_MODEL_ID]: activePickerPricingRuntime({
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
    submissionAdapterKey: "flux-2-klein",
    gridEligible: true,
    apiRouteSlug: "flux2klein",
  }),
  "fal-ai/flux-pro/v1/fill": disabledHiddenCatalogRuntime({
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
  }),
  "fal-ai/flux-kontext-lora/inpaint": disabledHiddenCatalogRuntime({
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
    submissionAdapterKey: "bria-background-remove",
    promptPolicy: "optional",
    gridEligible: false,
    apiRouteSlug: "bria-background-remove",
  }),
  "gpt-image-2": activePickerPricingRuntime({
    label: "GPT Image 2",
    mediaType: "image",
    pricingStrategy: "gpt-image-2-per-image",
    displayFamily: "Image",
    displayOrder: 110,
    pricingFamily: "Image",
    logoKey: "openai",
    createCharacterModeOrder: 50,
    supportsTextToImage: true,
    supportsImageToImage: true,
    generationLanes: ["text-to-image", "image-to-image"],
    executionMode: "direct",
    submitHandler: "default",
    submissionAdapterKey: "openai-gpt-image-2",
    gridEligible: true,
  }),
  [KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID]: activePickerPricingRuntime({
    label: "GPT Image 2 (Kie)",
    mediaType: "image",
    pricingStrategy: "kie-gpt-image-2-per-image",
    displayFamily: "Image",
    displayOrder: 120,
    pricingFamily: "Image",
    logoKey: "openai",
    providerModelId: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_PROVIDER_MODEL_ID,
    pairedModelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
    alwaysOnProviderRuntime: true,
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "default",
    submissionAdapterKey: "kie-gpt-image-2-text",
    gridEligible: true,
    apiRouteSlug: "kie-gpt-image-2",
  }),
  [KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID]: activePickerPricingRuntime({
    label: "GPT Image 2 Edit (Kie)",
    mediaType: "image",
    pricingStrategy: "kie-gpt-image-2-per-image",
    displayFamily: "Image",
    displayOrder: 125,
    pricingFamily: "Image",
    logoKey: "openai",
    providerModelId: KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_PROVIDER_MODEL_ID,
    pairedModelId: KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
    createCharacterModeOrder: 45,
    alwaysOnProviderRuntime: true,
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    submissionAdapterKey: "kie-gpt-image-2-edit",
    gridEligible: true,
    apiRouteSlug: "kie-gpt-image-2-edit",
  }),
  [FAL_NANO_BANANA_2_MODEL_ID]: activePickerPricingRuntime({
    label: "Nano Banana 2",
    mediaType: "image",
    pricingStrategy: "nano-banana-2-per-image",
    displayFamily: "Image",
    displayOrder: 140,
    pricingFamily: "Image",
    logoKey: "google",
    pairedModelId: FAL_NANO_BANANA_2_EDIT_MODEL_ID,
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "default",
    submissionAdapterKey: "nano-banana-2-text",
    gridEligible: true,
    apiRouteSlug: "nano-banana-2",
  }),
  [FAL_NANO_BANANA_2_EDIT_MODEL_ID]: activePickerPricingRuntime({
    label: "Nano Banana 2 Edit",
    mediaType: "image",
    pricingStrategy: "nano-banana-2-per-image",
    displayFamily: "Image",
    displayOrder: 150,
    pricingFamily: "Image",
    logoKey: "google",
    pairedModelId: FAL_NANO_BANANA_2_MODEL_ID,
    createCharacterModeOrder: 30,
    promptPolicy: "required",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    submissionAdapterKey: "nano-banana-2-edit",
    gridEligible: true,
    apiRouteSlug: "nano-banana-2-edit",
  }),
  [FAL_NANO_BANANA_PRO_MODEL_ID]: activePickerPricingRuntime({
    label: "Nano Banana Pro",
    mediaType: "image",
    pricingStrategy: "nano-banana-per-image",
    displayFamily: "Image",
    displayOrder: 160,
    pricingFamily: "Image",
    logoKey: "google",
    pairedModelId: FAL_NANO_BANANA_PRO_EDIT_MODEL_ID,
    admissionTier: "image_heavy",
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "default",
    submissionAdapterKey: "nano-banana-pro-text",
    gridEligible: true,
    apiRouteSlug: "nano-banana-pro",
  }),
  [FAL_NANO_BANANA_PRO_EDIT_MODEL_ID]: activePickerPricingRuntime({
    label: "Nano Banana Pro Edit",
    mediaType: "image",
    pricingStrategy: "nano-banana-per-image",
    displayFamily: "Image",
    displayOrder: 170,
    pricingFamily: "Image",
    logoKey: "google",
    pairedModelId: FAL_NANO_BANANA_PRO_MODEL_ID,
    createCharacterModeOrder: 40,
    promptPolicy: "required",
    admissionTier: "image_heavy",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    submissionAdapterKey: "nano-banana-pro-edit",
    gridEligible: true,
    apiRouteSlug: "nano-banana-pro-edit",
  }),
  [FAL_SEEDREAM_45_TEXT_MODEL_ID]: activePickerPricingRuntime({
    label: "Seedream 4.5",
    mediaType: "image",
    pricingStrategy: "seedream-per-image",
    displayFamily: "Image",
    displayOrder: 210,
    pricingFamily: "Image",
    logoKey: "seedream",
    pairedModelId: FAL_SEEDREAM_45_EDIT_MODEL_ID,
    defaultRoles: ["create-startup"],
    admissionTier: "image_heavy",
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "default",
    submissionAdapterKey: "seedream-text",
    gridEligible: true,
    apiRouteSlug: "seedream",
  }),
  [FAL_SEEDREAM_45_EDIT_MODEL_ID]: activePickerPricingRuntime({
    label: "Seedream 4.5 Edit",
    mediaType: "image",
    pricingStrategy: "seedream-per-image",
    displayFamily: "Image",
    displayOrder: 200,
    pricingFamily: "Image",
    logoKey: "seedream",
    pairedModelId: FAL_SEEDREAM_45_TEXT_MODEL_ID,
    defaultRoles: ["create-character-mode-startup", "edit-startup"],
    createCharacterModeOrder: 10,
    promptPolicy: "required",
    admissionTier: "image_heavy",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    submissionAdapterKey: "seedream-edit",
    gridEligible: true,
    apiRouteSlug: "seedream-edit",
  }),
  [FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID]: activePickerPricingRuntime({
    label: "Seedream 5 Lite",
    mediaType: "image",
    pricingStrategy: "seedream-5-lite-per-image",
    displayFamily: "Image",
    displayOrder: 180,
    pricingFamily: "Image",
    logoKey: "seedream",
    pairedModelId: FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID,
    supportsTextToImage: true,
    generationLanes: ["text-to-image"],
    executionMode: "queued",
    submitHandler: "default",
    submissionAdapterKey: "seedream-v5-lite-text",
    gridEligible: true,
    apiRouteSlug: "seedream-v5-lite",
  }),
  [FAL_SEEDREAM_5_LITE_EDIT_MODEL_ID]: activePickerPricingRuntime({
    label: "Seedream 5 Lite Edit",
    mediaType: "image",
    pricingStrategy: "seedream-5-lite-per-image",
    displayFamily: "Image",
    displayOrder: 190,
    pricingFamily: "Image",
    logoKey: "seedream",
    pairedModelId: FAL_SEEDREAM_5_LITE_TEXT_MODEL_ID,
    createCharacterModeOrder: 20,
    promptPolicy: "required",
    supportsImageToImage: true,
    generationLanes: ["image-to-image"],
    executionMode: "queued",
    submitHandler: "image",
    submissionAdapterKey: "seedream-v5-lite-edit",
    gridEligible: true,
    apiRouteSlug: "seedream-v5-lite-edit",
  }),
  [KIE_VEO_31_FAST_I2V_MODEL_ID]: activePickerPricingRuntime({
    label: "Veo 3.1 Fast",
    mediaType: "image-to-video",
    pricingStrategy: "veo-3-per-second",
    displayFamily: "Video",
    displayOrder: 10,
    pricingFamily: "Video",
    logoKey: "google",
    minDurationSeconds: 4,
    maxDurationSeconds: 8,
    defaultAudio: true,
    supportsImageToVideo: true,
    generationLanes: ["text-to-video", "image-to-video"],
    executionMode: "queued",
    submitHandler: "video",
    submissionAdapterKey: "kie-veo-31-fast-i2v",
    gridEligible: true,
    apiRouteSlug: "kie-veo",
  }),
  [KIE_KLING_30_MODEL_ID]: activePickerPricingRuntime({
    label: "Kling 3.0",
    mediaType: "image-to-video",
    pricingStrategy: "kling-3-per-second",
    displayFamily: "Video",
    displayOrder: 20,
    pricingFamily: "Video",
    logoKey: "kling",
    alwaysOnProviderRuntime: true,
    minDurationSeconds: 5,
    maxDurationSeconds: 15,
    defaultAudio: true,
    supportsImageToVideo: true,
    generationLanes: ["image-to-video"],
    executionMode: "queued",
    submitHandler: "video",
    submissionAdapterKey: "kie-kling-3",
    gridEligible: true,
    apiRouteSlug: "kie-kling",
  }),
  [KIE_SEEDANCE_2_MODEL_ID]: activePickerPricingRuntime({
    label: "Seedance 2.0",
    mediaType: "image-to-video",
    pricingStrategy: "seedance-2-per-second",
    displayFamily: "Video",
    displayOrder: 40,
    pricingFamily: "Video",
    logoKey: "seedream",
    alwaysOnProviderRuntime: true,
    minDurationSeconds: 5,
    maxDurationSeconds: 15,
    defaultAudio: true,
    supportsImageToVideo: true,
    generationLanes: ["text-to-video", "image-to-video"],
    executionMode: "queued",
    submitHandler: "video",
    submissionAdapterKey: "kie-seedance-2",
    gridEligible: true,
    apiRouteSlug: "kie-seedance-2",
  }),
  [KIE_SEEDANCE_2_FAST_MODEL_ID]: activePickerPricingRuntime({
    label: "Seedance 2.0 Fast",
    mediaType: "image-to-video",
    pricingStrategy: "seedance-2-fast-per-second",
    displayFamily: "Video",
    displayOrder: 50,
    pricingFamily: "Video",
    logoKey: "seedream",
    alwaysOnProviderRuntime: true,
    minDurationSeconds: 5,
    maxDurationSeconds: 15,
    defaultAudio: true,
    supportsImageToVideo: true,
    generationLanes: ["text-to-video", "image-to-video"],
    executionMode: "queued",
    submitHandler: "video",
    submissionAdapterKey: "kie-seedance-2",
    gridEligible: true,
    apiRouteSlug: "kie-seedance-2-fast",
  }),
  [FAL_OMNIHUMAN_V15_MODEL_ID]: activeHiddenPricingRuntime({
    label: "Lip Sync",
    mediaType: "image-to-video",
    pricingStrategy: "omnihuman-v15-per-second",
    displayFamily: "Video",
    displayOrder: 60,
    pricingFamily: "Video",
    logoKey: "seedream",
    minDurationSeconds: 1,
    maxDurationSeconds: 60,
    supportsImageToVideo: true,
    generationLanes: ["lip-sync"],
    executionMode: "queued",
    submitHandler: "video",
    submissionAdapterKey: "fal-omnihuman-v15",
    gridEligible: true,
    apiRouteSlug: "omnihuman-v15",
  }),
  "gpt-5.5": activeInternalPricingRuntime({
    label: "GPT-5.5",
    mediaType: "text",
    pricingStrategy: "openai-text-token",
    displayFamily: "Text",
    displayOrder: 280,
    pricingFamily: "Text",
    logoKey: "openai",
    generationLanes: ["text"],
    executionMode: "none",
    submitHandler: "unsupported",
    defaultRoles: ["ai-studio-text-prompt", "studio-agent-chat", "studio-agent-vision"],
    gridEligible: false,
  }),
  "gpt-5.5-pro": activeInternalPricingRuntime({
    label: "GPT-5.5 Pro",
    mediaType: "text",
    pricingStrategy: "openai-text-token",
    displayFamily: "Text",
    displayOrder: 290,
    pricingFamily: "Text",
    logoKey: "openai",
    generationLanes: ["text"],
    executionMode: "none",
    submitHandler: "unsupported",
    gridEligible: false,
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
    defaultRoles: ["style-extraction-fallback"],
    gridEligible: false,
  }),
  "gpt-5.4-pro": activeInternalPricingRuntime({
    label: "GPT-5.4 Pro",
    mediaType: "text",
    pricingStrategy: "openai-text-token",
    displayFamily: "Text",
    displayOrder: 305,
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
    defaultRoles: ["style-extraction-vision"],
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

export const getPairedModelId = (modelId: string): string | null =>
  getModelCatalogEntry(modelId)?.pairedModelId ?? null;

export const getReplacementModelId = (modelId: string): string | null =>
  getModelCatalogEntry(modelId)?.replacementModelId ?? null;

export const listCreateCharacterModeModelIds = (): string[] =>
  listModelCatalogEntries()
    .filter((entry) => typeof entry.createCharacterModeOrder === "number")
    .sort(
      (a, b) =>
        (a.createCharacterModeOrder ?? Number.MAX_SAFE_INTEGER) -
        (b.createCharacterModeOrder ?? Number.MAX_SAFE_INTEGER)
    )
    .map((entry) => entry.modelId);

export const getModelPromptPolicy = (modelId: string): ModelPromptPolicy | null =>
  getModelCatalogEntry(modelId)?.promptPolicy ?? null;

export const getModelAdmissionTier = (modelId: string): ModelAdmissionTier | null =>
  getModelCatalogEntry(modelId)?.admissionTier ?? null;

export const getModelSubmissionAdapterKey = (modelId: string): ModelSubmissionAdapterKey | null =>
  getModelCatalogEntry(modelId)?.submissionAdapterKey ?? null;

export const getModelDefaultRoles = (modelId: string): ModelDefaultRole[] =>
  getModelCatalogEntry(modelId)?.defaultRoles ?? [];

export const resolveModelIdForDefaultRole = (role: ModelDefaultRole): string | null =>
  listModelCatalogEntries().find((entry) => entry.defaultRoles?.includes(role))?.modelId ?? null;

export const resolveRequiredModelIdForDefaultRole = (role: ModelDefaultRole): string =>
  resolveModelIdForDefaultRole(role) ?? DEFAULT_ROLE_FALLBACK_MODEL_IDS[role];

export const resolveModelLabelById = (modelId: string): string | null =>
  getModelCatalogEntry(modelId)?.label ?? null;

export const resolveAudioMusicModelId = (): string | null =>
  resolveModelIdForDefaultRole("audio-music");

export const resolveRequiredAudioMusicModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("audio-music");

export const resolveCreateStartupModelId = (): string | null =>
  resolveModelIdForDefaultRole("create-startup");

export const resolveRequiredCreateStartupModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("create-startup");

export const resolveCreateCharacterModeStartupModelId = (): string | null =>
  resolveModelIdForDefaultRole("create-character-mode-startup");

export const resolveRequiredCreateCharacterModeStartupModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("create-character-mode-startup");

export const resolveEditStartupModelId = (): string | null =>
  resolveModelIdForDefaultRole("edit-startup");

export const resolveRequiredEditStartupModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("edit-startup");

export const resolveAudioSoundEffectsModelId = (): string | null =>
  resolveModelIdForDefaultRole("audio-sfx");

export const resolveRequiredAudioSoundEffectsModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("audio-sfx");

export const resolveAudioVoiceoverModelId = (): string | null =>
  resolveModelIdForDefaultRole("audio-voiceover");

export const resolveRequiredAudioVoiceoverModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("audio-voiceover");

export const resolveAudioVoiceChangerModelId = (): string | null =>
  resolveModelIdForDefaultRole("audio-voice-changer");

export const resolveRequiredAudioVoiceChangerModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("audio-voice-changer");

export const resolveAudioVoiceDesignModelId = (): string | null =>
  resolveModelIdForDefaultRole("audio-voice-design");

export const resolveRequiredAudioVoiceDesignModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("audio-voice-design");

export const resolveAiStudioTextPromptModelId = (): string | null =>
  resolveModelIdForDefaultRole("ai-studio-text-prompt");

export const resolveRequiredAiStudioTextPromptModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("ai-studio-text-prompt");

export const resolveStudioAgentDefaultModelId = (): string | null =>
  resolveModelIdForDefaultRole("studio-agent-chat");

export const resolveRequiredStudioAgentDefaultModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("studio-agent-chat");

export const resolveStudioAgentDefaultVisionModelId = (): string | null =>
  resolveModelIdForDefaultRole("studio-agent-vision");

export const resolveRequiredStudioAgentDefaultVisionModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("studio-agent-vision");

export const resolveStyleExtractionVisionModelId = (): string | null =>
  resolveModelIdForDefaultRole("style-extraction-vision");

export const resolveRequiredStyleExtractionVisionModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("style-extraction-vision");

export const resolveStyleExtractionFallbackVisionModelId = (): string | null =>
  resolveModelIdForDefaultRole("style-extraction-fallback");

export const resolveRequiredStyleExtractionFallbackVisionModelId = (): string =>
  resolveRequiredModelIdForDefaultRole("style-extraction-fallback");

export const isAlwaysOnProviderRuntimeModelId = (modelId: string): boolean =>
  getModelCatalogEntry(modelId)?.alwaysOnProviderRuntime === true;

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
