/**
 * Normalization helpers for styles-library persisted detail payloads.
 * Keeps backward compatibility while reducing stored details to the core style fields.
 */
import type { StylesLibraryStyleDetails, StylesLibraryStyleDetailsMap } from "../types";
import { STYLE_PROMPT_MAX_CHARACTERS } from "../components/style-creator/constants";
import { normalizeStylesLibraryStyleId } from "./stylesLibraryCatalog";

const MAX_STYLE_FIELD_LENGTH = 120;
const MAX_STYLE_PROMPT_LENGTH = STYLE_PROMPT_MAX_CHARACTERS;
const MAX_STYLE_PREVIEW_URL_LENGTH = 2_000_000;

const clampString = (value: unknown, limit: number): string => {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit).trim();
};

const normalizePreviewImageUrl = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (!normalized) return "";
  return normalized.length <= MAX_STYLE_PREVIEW_URL_LENGTH ? normalized : "";
};

/**
 * Normalizes one style-details row for persistence-safe reads/writes.
 */
export const normalizeStyleDetails = (value: unknown): StylesLibraryStyleDetails => {
  const details = value as Partial<StylesLibraryStyleDetails> | null | undefined;
  return {
    style: clampString(details?.style, MAX_STYLE_FIELD_LENGTH),
    title: clampString(details?.title, MAX_STYLE_FIELD_LENGTH),
    referenceImageName: clampString(details?.referenceImageName, MAX_STYLE_FIELD_LENGTH),
    stylePrompt: clampString(details?.stylePrompt, MAX_STYLE_PROMPT_LENGTH),
    previewImageUrl: normalizePreviewImageUrl(details?.previewImageUrl),
  };
};

/**
 * Normalizes the full per-user style details map.
 */
export const normalizeStyleDetailsMap = (value: unknown): StylesLibraryStyleDetailsMap => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const entries = Object.entries(value as Record<string, unknown>);
  const normalized: StylesLibraryStyleDetailsMap = {};
  entries.forEach(([rawId, rawDetails]) => {
    const styleId = normalizeStylesLibraryStyleId(rawId);
    if (!styleId) return;
    normalized[styleId] = normalizeStyleDetails(rawDetails);
  });
  return normalized;
};

/**
 * Equality helper used to avoid redundant writes.
 */
export const areStyleDetailMapsEqual = (
  left: StylesLibraryStyleDetailsMap,
  right: StylesLibraryStyleDetailsMap
): boolean => {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.length !== rightKeys.length) return false;
  for (let index = 0; index < leftKeys.length; index += 1) {
    if (leftKeys[index] !== rightKeys[index]) return false;
    const key = leftKeys[index];
    const leftValue = left[key];
    const rightValue = right[key];
    if (!rightValue) return false;
    if (
      leftValue.style !== rightValue.style ||
      leftValue.title !== rightValue.title ||
      leftValue.referenceImageName !== rightValue.referenceImageName ||
      leftValue.stylePrompt !== rightValue.stylePrompt ||
      leftValue.previewImageUrl !== rightValue.previewImageUrl
    ) {
      return false;
    }
  }
  return true;
};

/**
 * Merge helper: local overrides take precedence over remote.
 */
export const mergeStyleDetailsMaps = (
  remoteValue: StylesLibraryStyleDetailsMap,
  localValue: StylesLibraryStyleDetailsMap
): StylesLibraryStyleDetailsMap => ({
  ...remoteValue,
  ...localValue,
});
