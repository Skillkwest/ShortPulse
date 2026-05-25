/**
 * Shared AI Studio state config and storage helpers.
 * Centralizes state defaults and session-storage keys so `useAiStudioState` remains focused on orchestration.
 */
import { DEFAULT_KLING_DURATION_SECONDS, getModelConfig } from "../logic/pricing";

export const VIDEO_DEFAULT_DURATION_SECONDS = DEFAULT_KLING_DURATION_SECONDS;
export const VIDEO_DURATION_STORAGE_KEY = "aiStudioVideoDuration";
export const VIDEO_RESOLUTION_STORAGE_KEY = "aiStudioVideoResolution";
export const IMAGE_RESOLUTION_STORAGE_KEY = "aiStudioImageResolution";

const readSessionStorageValue = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(key);
};

/**
 * Reads a string preference from session storage with a stable fallback.
 */
export const readSessionStorageStringPreference = (key: string, fallback: string): string => {
  return readSessionStorageValue(key) ?? fallback;
};

/**
 * Reads a numeric preference from session storage with a stable fallback.
 */
export const readSessionStorageNumberPreference = (key: string, fallback: number): number => {
  const raw = readSessionStorageValue(key);
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Reports whether any stored video preference currently exists.
 */
export const hasStoredVideoPreferences = (): boolean => {
  return Boolean(
    readSessionStorageValue(VIDEO_DURATION_STORAGE_KEY) ||
    readSessionStorageValue(VIDEO_RESOLUTION_STORAGE_KEY)
  );
};

/**
 * Resolves the fallback video duration for a model id.
 */
export const getDefaultDurationSecondsForModel = (modelId: string | null): number => {
  if (!modelId) return VIDEO_DEFAULT_DURATION_SECONDS;
  const config = getModelConfig(modelId);
  return config?.defaultDurationSeconds ?? VIDEO_DEFAULT_DURATION_SECONDS;
};
