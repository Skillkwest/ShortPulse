import { getModelConfig } from "../../../model-runtime/pricing";
import type { PricingParams } from "../../../model-runtime/pricingTypes";
import { getModelCatalogEntry } from "../../../model-runtime/modelCatalog";
import {
  isKieKling30MotionControlProviderModel,
  KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
} from "../../../model-runtime/klingMotionControlPricing";
import { normalizeDurationForModel as normalizeSharedDurationForModel } from "../../../model-runtime/modelDurationConstraints";
import { KIE_KLING_30_MODEL_ID } from "../../../model-runtime/providerModelIds";
import {
  FAL_FLUX_2_KLEIN_9B_MODEL_ID,
  FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID,
  FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID,
} from "../../../model-runtime/falModelIds";
import type { JsonObject } from "./types";
import { asBoolean, asNumber, asString } from "./utils";

const resolveImageDimensions = (
  payload: JsonObject
): { width: number; height: number } | undefined => {
  const imageSize = payload.image_size;
  if (imageSize && typeof imageSize === "object" && !Array.isArray(imageSize)) {
    const size = imageSize as Record<string, unknown>;
    const width = asNumber(size.width);
    const height = asNumber(size.height);
    if (width && height && width > 0 && height > 0) {
      return { width: Math.round(width), height: Math.round(height) };
    }
  }

  const width = asNumber(payload.width);
  const height = asNumber(payload.height);
  if (width && height && width > 0 && height > 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  return undefined;
};

const resolveContextImageDimensions = (
  context?: JsonObject | null
): { width: number; height: number } | undefined => {
  if (!context) return undefined;
  const width = asNumber(context.image_width) ?? asNumber(context.output_width);
  const height = asNumber(context.image_height) ?? asNumber(context.output_height);
  if (width && height && width > 0 && height > 0) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  return undefined;
};

const resolveContextDurationSeconds = (context?: JsonObject | null): number | undefined => {
  if (!context) return undefined;
  const direct =
    asNumber(context.duration_seconds) ??
    asNumber(context.source_duration_seconds) ??
    asNumber(context.audio_duration_seconds) ??
    asNumber(context.lip_sync_audio_duration_seconds);
  if (direct && direct > 0) return direct;
  const durationMs =
    asNumber(context.duration_ms) ??
    asNumber(context.source_duration_ms) ??
    asNumber(context.audio_duration_ms) ??
    asNumber(context.lip_sync_audio_duration_ms);
  if (durationMs && durationMs > 0) return durationMs / 1000;
  return undefined;
};

const shouldApplyCatalogDefaultDuration = ({
  modelId,
  pricingStrategy,
  generationCount,
}: {
  modelId: string;
  pricingStrategy?: string | null;
  generationCount?: number;
}): boolean => {
  if (modelId !== "eleven_text_to_sound_v2") return true;
  if (pricingStrategy !== "elevenlabs-sound-effect") return true;
  return !(generationCount && generationCount > 0);
};

const resolveExplicitImageSize = (payload: JsonObject): string | undefined => {
  const directSize = asString(payload.size) ?? asString(payload.image_size);
  return directSize?.trim().toLowerCase() || undefined;
};

const resolveInputImageCount = (payload: JsonObject): number | undefined => {
  const directCount = asNumber(payload.input_image_count);
  if (directCount && directCount > 0) {
    return Math.max(1, Math.round(directCount));
  }

  const images = payload.images;
  if (Array.isArray(images)) {
    const count = images.filter((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const image = entry as Record<string, unknown>;
      return Boolean(asString(image.image_url) ?? asString(image.file_id));
    }).length;
    if (count > 0) return count;
  }

  const urlFieldCount = ["image_urls", "input_urls"].reduce((count, field) => {
    const value = payload[field];
    if (!Array.isArray(value)) return count;
    return (
      count + value.filter((entry) => typeof entry === "string" && entry.trim().length > 0).length
    );
  }, 0);
  if (urlFieldCount > 0) return urlFieldCount;

  const singleUrlCount = ["image_url", "input_url"].filter((field) =>
    Boolean(asString(payload[field]))
  ).length;
  return singleUrlCount > 0 ? singleUrlCount : undefined;
};

const resolveInputVideoCount = (payload: JsonObject): number | undefined => {
  const directCount = asNumber(payload.input_video_count);
  if (directCount && directCount >= 0) {
    return Math.max(0, Math.round(directCount));
  }

  const videos = payload.reference_video_urls;
  if (!Array.isArray(videos)) return undefined;
  const count = videos.filter(
    (entry) => typeof entry === "string" && entry.trim().length > 0
  ).length;
  return count >= 0 ? count : undefined;
};

const resolveInputVideoDurationSeconds = (
  payload: JsonObject,
  context?: JsonObject | null
): number | undefined => {
  const direct =
    asNumber(payload.input_video_duration_seconds) ??
    asNumber(context?.input_video_duration_seconds) ??
    asNumber(context?.seedance_input_video_duration_seconds);
  if (direct && direct > 0) return Number(direct.toFixed(3));

  const durationMs =
    asNumber(payload.input_video_duration_ms) ??
    asNumber(context?.input_video_duration_ms) ??
    asNumber(context?.seedance_input_video_duration_ms);
  if (durationMs && durationMs > 0) return Number((durationMs / 1000).toFixed(3));

  return undefined;
};

const resolveMaskPresent = (payload: JsonObject): boolean | undefined => {
  const directMaskPresent = asBoolean(payload.mask_present);
  if (directMaskPresent !== undefined) return directMaskPresent;

  const mask = payload.mask;
  if (!mask || typeof mask !== "object" || Array.isArray(mask)) return undefined;
  const record = mask as Record<string, unknown>;
  return Boolean(asString(record.image_url) ?? asString(record.file_id));
};

const resolveAspectFromImageSize = (
  payload: JsonObject,
  modelId: string,
  dimensions?: { width: number; height: number }
): string | undefined => {
  const directAspect = asString(payload.aspect) ?? asString(payload.aspect_ratio);
  if (directAspect) return directAspect;

  const explicitSize = resolveExplicitImageSize(payload);
  if (explicitSize === "1024x1024") return "1:1";
  if (explicitSize === "1024x1536") return "9:16";
  if (explicitSize === "1536x1024") return "16:9";

  const width = dimensions?.width;
  const height = dimensions?.height;
  if (!width || !height) return undefined;

  if (width === height) return "1:1";
  if (width === 1200 && height === 900) return "4:3";
  if (width === 900 && height === 1200) return "3:4";
  if (width === 960 && height === 1200) return "4:5";
  if (width === 1344 && height === 756) return "16:9";
  if (width === 756 && height === 1344) return "9:16";
  return undefined;
};

const resolveResolution = (payload: JsonObject): string | undefined => {
  const resolution = asString(payload.resolution);
  if (resolution) return resolution;

  const quality = asString(payload.quality);
  if (quality) return quality;

  const mode = asString(payload.mode);
  if (mode && /^(480p|720p|1080p)$/i.test(mode.trim())) return mode.trim();

  const imageSize = asString(payload.image_size);
  if (!imageSize) return undefined;
  const normalized = imageSize.toLowerCase();
  if (normalized.includes("auto_4k")) return "auto_4K";
  if (normalized.includes("auto_3k")) return "auto_3K";
  if (normalized.includes("auto_2k")) return "auto_2K";
  if (normalized.includes("4k")) return "4K";
  if (normalized.includes("1080")) return "1080p";
  if (normalized.includes("720")) return "720p";
  if (normalized.includes("480")) return "480p";
  return undefined;
};

const inferAutoResolutionFromImageDimensions = (
  modelId: string,
  dimensions?: { width: number; height: number }
): string | undefined => {
  if (!dimensions) return undefined;
  const config = getModelConfig(modelId);
  const allowed = config?.allowedResolutions ?? [];
  if (
    !allowed.includes("auto_2K") &&
    !allowed.includes("auto_3K") &&
    !allowed.includes("auto_4K")
  ) {
    return undefined;
  }

  const imageArea = dimensions.width * dimensions.height;
  const autoAreas: Array<{ resolution: "auto_2K" | "auto_3K" | "auto_4K"; area: number }> = [
    { resolution: "auto_2K", area: 3_686_400 },
    { resolution: "auto_3K", area: 5_308_416 },
    { resolution: "auto_4K", area: 8_294_400 },
  ];

  const matched = autoAreas.find(
    ({ resolution, area }) => allowed.includes(resolution) && Math.abs(imageArea - area) <= 2
  );
  return matched?.resolution;
};

const normalizeAspectForModel = (
  aspect: string | undefined,
  modelId: string
): string | undefined => {
  if (!aspect) return undefined;
  const config = getModelConfig(modelId);
  const allowed = config?.allowedAspects ?? [];
  if (!allowed.length) return aspect;
  return allowed.includes(aspect) ? aspect : undefined;
};

const normalizeResolutionForModel = (
  resolution: string | undefined,
  modelId: string
): string | undefined => {
  if (!resolution) return undefined;
  const config = getModelConfig(modelId);
  const allowed = config?.allowedResolutions ?? [];
  if (!allowed.length) return resolution;
  const normalized = resolution.toLowerCase();
  const exact = allowed.find((value) => value.toLowerCase() === normalized);
  if (exact) return exact;

  if (normalized.includes("4k")) {
    return allowed.find((value) => value.toLowerCase().includes("4k")) ?? config?.defaultResolution;
  }
  if (normalized.includes("1080")) {
    return (
      allowed.find((value) => value.toLowerCase().includes("1080")) ?? config?.defaultResolution
    );
  }
  if (normalized.includes("720") || normalized.includes("high")) {
    return (
      allowed.find((value) => value.toLowerCase().includes("720")) ?? config?.defaultResolution
    );
  }
  if (normalized.includes("480")) {
    return (
      allowed.find((value) => value.toLowerCase().includes("480")) ?? config?.defaultResolution
    );
  }
  return config?.defaultResolution;
};

const normalizeDurationForModel = (
  duration: number | undefined,
  modelId: string
): number | undefined => normalizeSharedDurationForModel(duration, modelId);

const resolveBooleanAlias = (payload: JsonObject, aliases: string[]): boolean | undefined => {
  for (const alias of aliases) {
    const value = asBoolean(payload[alias]);
    if (value !== undefined) return value;
  }
  return undefined;
};

const resolveWebSearchFlag = (payload: JsonObject, modelId: string): boolean | undefined => {
  const aliasCandidates = [
    ...(getModelCatalogEntry(modelId)?.pricingParamAliases?.webSearch ?? []),
    "enable_web_search",
    "web_search",
    "enable_google_search",
  ];
  const aliasSet = new Set<string>();
  aliasCandidates.forEach((alias) => {
    const cleaned = alias.trim();
    if (cleaned.length) aliasSet.add(cleaned);
  });
  return resolveBooleanAlias(payload, Array.from(aliasSet));
};

const resolveFlux2KleinSourceVariantBaseId = (
  modelId: string,
  context?: JsonObject | null
): string | undefined => {
  if (modelId !== FAL_FLUX_2_KLEIN_9B_MODEL_ID || !context) return undefined;
  const sourceMode = asString(context.source_mode)?.trim().toLowerCase();
  switch (sourceMode) {
    case "style_preview":
      return FAL_FLUX_2_KLEIN_STYLE_PREVIEW_VARIANT_BASE_ID;
    case "audio_companion_art":
    case "audio_reference_background":
    case "companion_art":
      return FAL_FLUX_2_KLEIN_AUDIO_COMPANION_ART_VARIANT_BASE_ID;
    default:
      return undefined;
  }
};

const isKlingMotionControlPayload = (modelId: string, payload: JsonObject): boolean => {
  if (modelId !== KIE_KLING_30_MODEL_ID) return false;
  if (isKieKling30MotionControlProviderModel(asString(payload.model))) return true;

  const backgroundSource = asString(payload.background_source)?.trim().toLowerCase();
  const characterOrientation = asString(payload.character_orientation)?.trim().toLowerCase();
  if (backgroundSource === "input_video" && characterOrientation === "image") return true;

  return Array.isArray(payload.video_urls)
    ? payload.video_urls.some((entry) => typeof entry === "string" && entry.trim().length > 0)
    : Boolean(asString(payload.video_url));
};

export const summarizePayload = (payload: JsonObject): JsonObject => {
  const keys = [
    "aspect",
    "aspect_ratio",
    "duration",
    "duration_seconds",
    "generation_count",
    "n",
    "resolution",
    "quality",
    "input_fidelity",
    "input_image_count",
    "mask_present",
    "size",
    "mode",
    "source_duration_ms",
    "source_duration_seconds",
    "text",
    "text_characters",
    "generate_audio",
    "sound",
    "voice_ids",
    "image_size",
    "model",
  ] as const;
  return keys.reduce((acc, key) => {
    if (payload[key] !== undefined) {
      acc[key] = payload[key];
    }
    return acc;
  }, {} as JsonObject);
};

export const buildPricingParams = (
  modelId: string,
  payload: JsonObject,
  options?: {
    shortpulseContext?: JsonObject | null;
  }
): Omit<PricingParams, "modelId"> => {
  const params: Omit<PricingParams, "modelId"> = {};
  const config = getModelConfig(modelId);
  const sourceVariantBaseId = resolveFlux2KleinSourceVariantBaseId(
    modelId,
    options?.shortpulseContext
  );
  if (sourceVariantBaseId) {
    params.variantBaseId = sourceVariantBaseId;
  }
  if (isKlingMotionControlPayload(modelId, payload)) {
    params.variantBaseId = KIE_KLING_30_MOTION_CONTROL_VARIANT_ID;
  }

  const imageDimensions =
    resolveImageDimensions(payload) ?? resolveContextImageDimensions(options?.shortpulseContext);
  if (imageDimensions) {
    params.imageWidth = imageDimensions.width;
    params.imageHeight = imageDimensions.height;
  }

  const explicitImageSize = resolveExplicitImageSize(payload);
  if (explicitImageSize) {
    params.size = explicitImageSize;
  }

  const aspect = normalizeAspectForModel(
    resolveAspectFromImageSize(payload, modelId, imageDimensions),
    modelId
  );
  if (aspect) params.aspect = aspect;

  const durationRaw =
    asNumber(payload.duration_seconds) ??
    asNumber(payload.duration) ??
    resolveContextDurationSeconds(options?.shortpulseContext);
  const duration = normalizeDurationForModel(durationRaw, modelId);
  if (duration) params.durationSeconds = duration;

  const generationCount = asNumber(payload.generation_count);
  if (generationCount && generationCount > 0) {
    params.generationCount = Math.max(1, Math.round(generationCount));
  }
  const openAiGenerationCount = asNumber(payload.n);
  if (!params.generationCount && openAiGenerationCount && openAiGenerationCount > 0) {
    params.generationCount = Math.max(1, Math.round(openAiGenerationCount));
  }

  const rawResolution =
    resolveResolution(payload) ?? inferAutoResolutionFromImageDimensions(modelId, imageDimensions);
  const resolution = normalizeResolutionForModel(rawResolution, modelId);
  if (resolution) params.resolution = resolution;
  if (typeof resolution === "string" && ["low", "medium", "high"].includes(resolution)) {
    params.quality = resolution;
  }
  const inputFidelity = asString(payload.input_fidelity);
  if (inputFidelity) params.inputFidelity = inputFidelity;
  const inputImageCount = resolveInputImageCount(payload);
  if (inputImageCount) params.inputImageCount = inputImageCount;
  const inputVideoCount = resolveInputVideoCount(payload);
  if (inputVideoCount !== undefined) params.inputVideoCount = inputVideoCount;
  const inputVideoDurationSeconds = resolveInputVideoDurationSeconds(
    payload,
    options?.shortpulseContext
  );
  if (inputVideoDurationSeconds !== undefined) {
    params.inputVideoDurationSeconds = inputVideoDurationSeconds;
    if (!params.sourceDurationSeconds) {
      params.sourceDurationSeconds = inputVideoDurationSeconds;
    }
  }
  const maskPresent = resolveMaskPresent(payload);
  if (maskPresent !== undefined) params.maskPresent = maskPresent;

  const mode = asString(payload.mode);
  if (mode) params.mode = mode;

  const audio =
    asBoolean(payload.generate_audio) ?? asBoolean(payload.sound) ?? asBoolean(payload.audio);
  if (audio !== undefined) params.audio = audio;

  const voiceIds = payload.voice_ids;
  if (
    Array.isArray(voiceIds) &&
    voiceIds.filter((item) => typeof item === "string" && item.trim().length > 0).length > 0
  ) {
    params.voiceControl = true;
  }

  const webSearch = resolveWebSearchFlag(payload, modelId);
  if (webSearch !== undefined) params.webSearch = webSearch;

  const sourceDurationSeconds =
    asNumber(payload.source_duration_seconds) ??
    (() => {
      const sourceDurationMs = asNumber(payload.source_duration_ms);
      if (!sourceDurationMs || sourceDurationMs <= 0) return undefined;
      return sourceDurationMs / 1000;
    })();
  if (sourceDurationSeconds && sourceDurationSeconds > 0) {
    params.sourceDurationSeconds = Number(sourceDurationSeconds.toFixed(3));
  }

  const directTextCharacters = asNumber(payload.text_characters);
  if (directTextCharacters && directTextCharacters > 0) {
    params.textCharacters = Math.max(1, Math.round(directTextCharacters));
  } else {
    const text = asString(payload.text);
    if (text) {
      params.textCharacters = text.length;
    }
  }

  if (
    !params.durationSeconds &&
    config?.defaultDurationSeconds &&
    shouldApplyCatalogDefaultDuration({
      modelId,
      pricingStrategy: config.pricingStrategy,
      generationCount: params.generationCount,
    })
  ) {
    params.durationSeconds = config.defaultDurationSeconds;
  }
  if (!params.resolution && config?.defaultResolution) {
    params.resolution = config.defaultResolution;
  }
  if (!params.generationCount && config?.defaultGenerationCount) {
    params.generationCount = config.defaultGenerationCount;
  }
  if (!params.sourceDurationSeconds && config?.defaultSourceDurationSeconds) {
    params.sourceDurationSeconds = config.defaultSourceDurationSeconds;
  }
  if (!params.textCharacters && config?.defaultTextCharacters) {
    params.textCharacters = config.defaultTextCharacters;
  }
  if (params.audio === undefined && config?.defaultAudio !== undefined) {
    params.audio = config.defaultAudio;
  }
  if (!params.aspect && config?.defaultAspect) {
    params.aspect = config.defaultAspect;
  }

  return params;
};
