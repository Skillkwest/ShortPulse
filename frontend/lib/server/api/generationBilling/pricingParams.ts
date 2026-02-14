import { getModelConfig } from "../../../../features/ai-studio/logic/pricing";
import type { PricingParams } from "../../../../features/ai-studio/logic/pricingTypes";
import type { JsonObject } from "./types";
import { asBoolean, asNumber, asString } from "./utils";

const resolveAspectFromImageSize = (payload: JsonObject): string | undefined => {
  const directAspect = asString(payload.aspect) ?? asString(payload.aspect_ratio);
  if (directAspect) return directAspect;

  const imageSize = payload.image_size;
  if (!imageSize || typeof imageSize !== "object") return undefined;
  const size = imageSize as Record<string, unknown>;
  const width = asNumber(size.width);
  const height = asNumber(size.height);
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

export const summarizePayload = (payload: JsonObject): JsonObject => {
  const keys = [
    "aspect",
    "aspect_ratio",
    "duration",
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

  const aspect = resolveAspectFromImageSize(payload);
  if (aspect) params.aspect = aspect;

  const duration = asNumber(payload.duration_seconds) ?? asNumber(payload.duration);
  if (duration) params.durationSeconds = duration;

  const resolution = resolveResolution(payload);
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

  const config = getModelConfig(modelId);
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
