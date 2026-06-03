/**
 * Shared model-duration normalization helpers.
 * Keeps UI state, payload submission, and pricing interpretation aligned to the same
 * allowed-duration contract for each model.
 */
import { getModelConfig, type ModelConfig } from "./modelRegistry";

type DurationConstrainedModelConfig = Pick<
  ModelConfig,
  | "allowedDurations"
  | "defaultDurationSeconds"
  | "maxDurationSeconds"
  | "mediaType"
  | "minDurationSeconds"
>;

const sortAllowedDurations = (values: readonly number[]): number[] =>
  [...values]
    .filter((value) => Number.isFinite(value))
    .map((value) => Number(value))
    .sort((left, right) => left - right);

export const normalizeDurationForModelConfig = (
  duration: number | null | undefined,
  config: DurationConstrainedModelConfig | null | undefined
): number | undefined => {
  if (typeof duration !== "number" || !Number.isFinite(duration) || duration <= 0) {
    return undefined;
  }

  const isAudioModel = config?.mediaType === "audio";
  let normalizedDuration = isAudioModel ? duration : Math.max(1, Math.round(duration));
  const allowedDurations = sortAllowedDurations(config?.allowedDurations ?? []);

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

  return isAudioModel ? Number(normalizedDuration.toFixed(3)) : normalizedDuration;
};

export const normalizeDurationForModel = (
  duration: number | null | undefined,
  modelId: string | null | undefined
): number | undefined =>
  normalizeDurationForModelConfig(duration, modelId ? getModelConfig(modelId) : null);
