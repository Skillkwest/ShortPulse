/**
 * Shared model catalog type definitions for AI Studio client and server runtime.
 */
import type { ElevenLabsModelPricingAuthority } from "./elevenLabsModels";
import type { PricingStrategyId } from "./pricingTypes";
import type { ModelSubmissionAdapterKey } from "./submissionAdapterMetadata";

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
export type ModelStylePromptFamily = "nano_banana" | "seedream" | "generic";
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
  stylePromptFamily?: ModelStylePromptFamily;
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
