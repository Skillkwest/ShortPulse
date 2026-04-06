import { getModelConfig } from "../../../model-runtime/pricing";

type JsonObject = Record<string, unknown>;

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]+/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const readGenerationDurationSeconds = (payload: JsonObject): number | null => {
  const durationSeconds = asNumber(payload.duration_seconds);
  if (durationSeconds !== null) return Math.max(1, Math.round(durationSeconds));
  const duration = asNumber(payload.duration);
  if (duration !== null) return Math.max(1, Math.round(duration));
  return null;
};

export const resolveGenerationModeFromPayload = (
  modelId: string,
  payload: JsonObject
): "image" | "video" => {
  const config = getModelConfig(modelId);
  if (config?.mediaType === "video" || config?.mediaType === "image-to-video") {
    return "video";
  }
  if (config?.mediaType === "image" || config?.mediaType === "multi") {
    return "image";
  }

  if (readGenerationDurationSeconds(payload) !== null) return "video";
  const lowered = modelId.toLowerCase();
  if (
    lowered.includes("video") ||
    lowered.includes("seedance") ||
    lowered.includes("kling") ||
    lowered.includes("veo")
  ) {
    return "video";
  }
  return "image";
};

export const resolveGenerationPromptFromPayload = (
  routeLabel: string,
  payload: JsonObject
): string =>
  asString(payload.prompt) ??
  asString(payload.input) ??
  asString(payload.description) ??
  `${routeLabel} generation`;

export const resolveGenerationAspectFromPayload = (payload: JsonObject): string | null =>
  asString(payload.aspect_ratio) ?? asString(payload.aspect);

export const resolveGenerationResolutionFromPayload = (payload: JsonObject): string | null =>
  asString(payload.resolution);
