/**
 * Shared image-resolution helpers for AI Studio image workflows.
 * Keeps per-model option labeling, clamping, and normalization in one place.
 */
import { getModelConfig } from "./modelRegistry";
import {
  normalizeOpenAiGptImage2Quality,
  normalizeOpenAiGptImage2ResolutionPreset,
  OPENAI_GPT_IMAGE_2_MODEL_ID,
  OPENAI_GPT_IMAGE_2_UI_ALLOWED_RESOLUTIONS,
} from "../../../lib/model-runtime/openAiImage2";

export const MODEL_DEFAULT_IMAGE_RESOLUTION = "model_default";
export const SEEDREAM_AUTO_2K_IMAGE_SIZE = "auto_2K";
export const SEEDREAM_AUTO_3K_IMAGE_SIZE = "auto_3K";
export const SEEDREAM_AUTO_4K_IMAGE_SIZE = "auto_4K";

export type ImageResolutionOption = {
  value: string;
  label: string;
};

const IMAGE_RESOLUTION_LABELS: Record<string, string> = {
  [MODEL_DEFAULT_IMAGE_RESOLUTION]: "Model default",
  [SEEDREAM_AUTO_2K_IMAGE_SIZE]: "2K",
  [SEEDREAM_AUTO_3K_IMAGE_SIZE]: "3K",
  [SEEDREAM_AUTO_4K_IMAGE_SIZE]: "4K",
  "0.5K": "0.5K",
  "1K": "1K",
  "2K": "2K",
  "4K": "4K",
};

export const formatImageResolutionLabel = (value: string): string => {
  return IMAGE_RESOLUTION_LABELS[value] ?? value;
};

export const getImageResolutionOptions = (modelId: string | null): ImageResolutionOption[] => {
  if (modelId === OPENAI_GPT_IMAGE_2_MODEL_ID) {
    return OPENAI_GPT_IMAGE_2_UI_ALLOWED_RESOLUTIONS.map((value) => ({
      value,
      label: formatImageResolutionLabel(value),
    }));
  }
  const config = modelId ? getModelConfig(modelId) : null;
  const values = config?.allowedResolutions?.length
    ? config.allowedResolutions
    : [MODEL_DEFAULT_IMAGE_RESOLUTION];
  return values.map((value) => ({ value, label: formatImageResolutionLabel(value) }));
};

const getImageResolutionPriority = (value: string): number => {
  const normalized = value.trim().toLowerCase();
  if (normalized === "high") return 500;
  if (normalized === "auto_4k" || normalized === "4k") return 500;
  if (normalized === "medium") return 400;
  if (normalized === "auto_3k" || normalized === "3k") return 450;
  if (normalized === "auto_2k" || normalized === "2k") return 400;
  if (normalized === "low") return 200;
  if (normalized === "1080p") return 350;
  if (normalized === "720p") return 300;
  if (normalized === "1k") return 200;
  if (normalized === "0.5k") return 150;
  if (normalized === MODEL_DEFAULT_IMAGE_RESOLUTION) return 0;

  const kiloMatch = normalized.match(/^(\d+)k$/);
  if (kiloMatch) {
    const numeric = Number(kiloMatch[1]);
    if (Number.isFinite(numeric)) {
      return 200 + numeric;
    }
  }

  return 100;
};

export const getHighestImageResolutionForModel = (modelId: string | null): string => {
  const options = getImageResolutionOptions(modelId);
  if (!options.length) {
    return MODEL_DEFAULT_IMAGE_RESOLUTION;
  }

  return options.reduce((best, option) => {
    if (getImageResolutionPriority(option.value) > getImageResolutionPriority(best.value)) {
      return option;
    }
    return best;
  }).value;
};

export const clampImageResolutionForModel = (
  modelId: string | null,
  value: string | null | undefined
): string => {
  if (modelId === OPENAI_GPT_IMAGE_2_MODEL_ID) {
    return normalizeOpenAiGptImage2ResolutionPreset(value);
  }
  const config = modelId ? getModelConfig(modelId) : null;
  const allowed = config?.allowedResolutions;
  if (!allowed?.length) {
    return MODEL_DEFAULT_IMAGE_RESOLUTION;
  }
  if (value && allowed.includes(value)) {
    return value;
  }
  if (config?.defaultResolution && allowed.includes(config.defaultResolution)) {
    return config.defaultResolution;
  }
  return allowed[0];
};

export const isModelDefaultImageResolution = (value: string | null | undefined): boolean => {
  return !value || value === MODEL_DEFAULT_IMAGE_RESOLUTION;
};

export const isSeedreamAutoImageSize = (
  value: string | null | undefined
): value is
  | typeof SEEDREAM_AUTO_2K_IMAGE_SIZE
  | typeof SEEDREAM_AUTO_3K_IMAGE_SIZE
  | typeof SEEDREAM_AUTO_4K_IMAGE_SIZE => {
  return (
    value === SEEDREAM_AUTO_2K_IMAGE_SIZE ||
    value === SEEDREAM_AUTO_3K_IMAGE_SIZE ||
    value === SEEDREAM_AUTO_4K_IMAGE_SIZE
  );
};

export const normalizeImageResolutionForPricing = (
  value: string | null | undefined
): string | undefined => {
  if (!value || isModelDefaultImageResolution(value)) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "low") return "1K";
  if (normalized === "medium") return "2K";
  if (normalized === "high") return "4K";
  if (normalized === "auto_4k" || normalized === "4k") return "4K";
  if (normalized === "auto_3k" || normalized === "3k") return "3K";
  if (normalized === "auto_2k" || normalized === "2k") return "2K";
  if (normalized === "0.5k") return "0.5K";
  if (normalized === "1k") return "1K";
  return value;
};

export const normalizeImageResolutionForCanonicalBilledPricing = (
  modelId: string | null,
  value: string | null | undefined
): string | undefined => {
  const clampedValue = clampImageResolutionForModel(modelId, value);
  if (!clampedValue || isModelDefaultImageResolution(clampedValue)) return undefined;
  if (modelId === OPENAI_GPT_IMAGE_2_MODEL_ID) {
    return normalizeOpenAiGptImage2Quality(clampedValue);
  }

  const config = modelId ? getModelConfig(modelId) : null;
  const allowed = config?.allowedResolutions ?? [];
  if (allowed.includes(clampedValue)) {
    return clampedValue;
  }

  return normalizeImageResolutionForPricing(clampedValue);
};

export const normalizeNanoBanana2Resolution = (
  value: string | null | undefined,
  fallback: "0.5K" | "1K" | "2K" | "4K" = "1K"
): "0.5K" | "1K" | "2K" | "4K" => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("4k")) return "4K";
  if (normalized.includes("2k")) return "2K";
  if (normalized.includes("0.5k") || normalized === "0.5" || normalized === "half") return "0.5K";
  if (normalized.includes("1k")) return "1K";
  return fallback;
};

export const normalizeNanoBananaProResolution = (
  value: string | null | undefined,
  fallback: "1K" | "2K" | "4K" = "1K"
): "1K" | "2K" | "4K" => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized.includes("4k")) return "4K";
  if (normalized.includes("2k")) return "2K";
  if (normalized.includes("1k")) return "1K";
  return fallback;
};

export const resolveImageResolutionLongestEdgePx = (
  value: string | null | undefined
): number | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === MODEL_DEFAULT_IMAGE_RESOLUTION) return null;
  if (normalized === "low") return 1024;
  if (normalized === "medium") return 2048;
  if (normalized === "high") return 3840;
  if (normalized === "0.5k" || normalized === "0.5" || normalized === "half") return 512;
  if (normalized === "1k") return 1024;
  if (normalized === "auto_2k" || normalized === "2k") return 2048;
  if (normalized === "auto_3k" || normalized === "3k") return 3072;
  if (normalized === "auto_4k" || normalized === "4k") return 4096;

  const kiloMatch = normalized.match(/^(\d+(?:\.\d+)?)k$/);
  if (!kiloMatch) return null;
  const kiloValue = Number(kiloMatch[1]);
  if (!Number.isFinite(kiloValue) || kiloValue <= 0) return null;
  return Math.max(1, Math.round(kiloValue * 1024));
};
