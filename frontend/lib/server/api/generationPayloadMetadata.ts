import { getModelConfig } from "../../model-runtime/pricing";
import { stripHiddenVideoShotModePromptPrefix } from "../../model-runtime/videoShotModePromptVisibility";

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

const asObject = (value: unknown): JsonObject | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;

const resolveGenerationReplayDisplayPrompt = (payload: JsonObject): string | null => {
  const generationReplay =
    asObject(payload.generation_replay) ?? asObject(payload.generationReplay);
  return stripHiddenVideoShotModePromptPrefix(asString(generationReplay?.displayPrompt));
};

const resolveWorkflowReloadDisplayPrompt = (payload: JsonObject): string | null => {
  const workflowReload = asObject(payload.workflow_reload) ?? asObject(payload.workflowReload);
  const prompt = asObject(workflowReload?.prompt);
  return stripHiddenVideoShotModePromptPrefix(asString(prompt?.display));
};

const resolveVisiblePromptCandidate = (value: unknown): string | null => {
  const normalized = asString(value);
  return stripHiddenVideoShotModePromptPrefix(normalized);
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
  resolveGenerationReplayDisplayPrompt(payload) ??
  resolveWorkflowReloadDisplayPrompt(payload) ??
  resolveVisiblePromptCandidate(payload.display_prompt) ??
  resolveVisiblePromptCandidate(payload.displayPrompt) ??
  resolveVisiblePromptCandidate(payload.prompt) ??
  resolveVisiblePromptCandidate(payload.input) ??
  resolveVisiblePromptCandidate(payload.description) ??
  `${routeLabel} generation`;

export const resolveGenerationAspectFromPayload = (payload: JsonObject): string | null =>
  asString(payload.aspect_ratio) ?? asString(payload.aspect);

export const resolveGenerationResolutionFromPayload = (payload: JsonObject): string | null =>
  asString(payload.resolution);
