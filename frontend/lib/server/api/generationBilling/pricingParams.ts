import { getModelConfig } from "../../../../features/ai-studio/logic/pricing";
import type { PricingParams } from "../../../../features/ai-studio/logic/pricingTypes";
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

const resolveAspectFromImageSize = (
  payload: JsonObject,
  dimensions?: { width: number; height: number }
): string | undefined => {
  const directAspect = asString(payload.aspect) ?? asString(payload.aspect_ratio);
  if (directAspect) return directAspect;

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

  const imageSize = asString(payload.image_size);
  if (!imageSize) return undefined;
  const normalized = imageSize.toLowerCase();
  if (normalized.includes("4k")) return "4K";
  if (normalized.includes("1080")) return "1080p";
  if (normalized.includes("720")) return "720p";
  if (normalized.includes("480")) return "480p";
  return undefined;
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
): number | undefined => {
  if (!duration || !Number.isFinite(duration)) return undefined;
  const config = getModelConfig(modelId);
  let normalizedDuration = Math.max(1, Math.round(duration));

  const allowedDurations = [...(config?.allowedDurations ?? [])]
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);
  if (allowedDurations.length > 0) {
    if (allowedDurations.includes(normalizedDuration)) return normalizedDuration;
    const nextHighest = allowedDurations.find((value) => value >= normalizedDuration);
    return nextHighest ?? allowedDurations[allowedDurations.length - 1];
  }

  if (typeof config?.minDurationSeconds === "number") {
    normalizedDuration = Math.max(config.minDurationSeconds, normalizedDuration);
  }
  if (typeof config?.maxDurationSeconds === "number") {
    normalizedDuration = Math.min(config.maxDurationSeconds, normalizedDuration);
  }
  return normalizedDuration;
};

export const summarizePayload = (payload: JsonObject): JsonObject => {
  const keys = [
    "aspect",
    "aspect_ratio",
    "duration",
    "duration_seconds",
    "resolution",
    "generate_audio",
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
  payload: JsonObject
): Omit<PricingParams, "modelId"> => {
  const params: Omit<PricingParams, "modelId"> = {};
  const config = getModelConfig(modelId);

  const imageDimensions = resolveImageDimensions(payload);
  if (imageDimensions) {
    params.imageWidth = imageDimensions.width;
    params.imageHeight = imageDimensions.height;
  }

  const aspect = normalizeAspectForModel(
    resolveAspectFromImageSize(payload, imageDimensions),
    modelId
  );
  if (aspect) params.aspect = aspect;

  const durationRaw = asNumber(payload.duration_seconds) ?? asNumber(payload.duration);
  const duration = normalizeDurationForModel(durationRaw, modelId);
  if (duration) params.durationSeconds = duration;

  const resolution = normalizeResolutionForModel(resolveResolution(payload), modelId);
  if (resolution) params.resolution = resolution;

  const audio = asBoolean(payload.generate_audio) ?? asBoolean(payload.audio);
  if (audio !== undefined) params.audio = audio;

  const voiceIds = payload.voice_ids;
  if (
    Array.isArray(voiceIds) &&
    voiceIds.filter((item) => typeof item === "string" && item.trim().length > 0).length > 0
  ) {
    params.voiceControl = true;
  }

  const webSearch = asBoolean(payload.enable_web_search) ?? asBoolean(payload.web_search);
  if (webSearch !== undefined) params.webSearch = webSearch;

  if (!params.durationSeconds && config?.defaultDurationSeconds) {
    params.durationSeconds = config.defaultDurationSeconds;
  }
  if (!params.resolution && config?.defaultResolution) {
    params.resolution = config.defaultResolution;
  }
  if (params.audio === undefined && config?.defaultAudio !== undefined) {
    params.audio = config.defaultAudio;
  }
  if (!params.aspect && config?.defaultAspect) {
    params.aspect = config.defaultAspect;
  }

  return params;
};
