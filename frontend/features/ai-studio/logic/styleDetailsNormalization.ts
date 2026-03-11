/**
 * Normalization helpers for styles-library persisted detail payloads.
 * Keeps backward compatibility between legacy and extended metadata shapes.
 */
import type {
  StylesLibraryStyleDetails,
  StylesLibraryStyleDetailsMap,
  StylesLibraryStyleExtractionMeta,
  StylesLibraryStyleExtractionOutcome,
  StylesLibraryStyleProfile,
} from "../types";
import { STYLE_PROMPT_MAX_CHARACTERS } from "../components/style-creator/constants";

const MAX_STYLE_FIELD_LENGTH = 120;
const MAX_STYLE_PROMPT_LENGTH = STYLE_PROMPT_MAX_CHARACTERS;
const MAX_STYLE_PREVIEW_URL_LENGTH = 2_000_000;
const MAX_DESCRIPTOR_COUNT = 32;
const MAX_DESCRIPTOR_LENGTH = 120;

const clampString = (value: unknown, limit: number): string => {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (normalized.length <= limit) return normalized;
  return normalized.slice(0, limit).trim();
};

const normalizeDescriptorArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((entry) => {
    const descriptor = clampString(entry, MAX_DESCRIPTOR_LENGTH);
    if (!descriptor || seen.has(descriptor)) return;
    seen.add(descriptor);
    normalized.push(descriptor);
  });
  return normalized.slice(0, MAX_DESCRIPTOR_COUNT);
};

const normalizePreviewImageUrl = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  if (!normalized) return "";
  return normalized.length <= MAX_STYLE_PREVIEW_URL_LENGTH ? normalized : "";
};

const normalizeVersion1StyleProfile = (value: unknown): StylesLibraryStyleProfile | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const profile = value as Partial<StylesLibraryStyleProfile>;
  if (profile.version !== 1) return undefined;
  return {
    version: 1,
    medium: clampString(profile.medium, MAX_STYLE_FIELD_LENGTH) || null,
    lightingDescriptors: normalizeDescriptorArray(profile.lightingDescriptors),
    lensDepthDescriptors: normalizeDescriptorArray(profile.lensDepthDescriptors),
    colorDescriptors: normalizeDescriptorArray(profile.colorDescriptors),
    renderingDescriptors: normalizeDescriptorArray(profile.renderingDescriptors),
    textureDescriptors: normalizeDescriptorArray(profile.textureDescriptors),
    generalDescriptors: normalizeDescriptorArray(profile.generalDescriptors),
  };
};

const normalizeExtractionOutcome = (value: unknown): StylesLibraryStyleExtractionOutcome | null => {
  if (value === "success" || value === "fallback" || value === "blocked_source") return value;
  return null;
};

const normalizeExtractionMeta = (value: unknown): StylesLibraryStyleExtractionMeta | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const meta = value as Partial<StylesLibraryStyleExtractionMeta>;
  if (meta.version !== 1) return undefined;
  const outcome = normalizeExtractionOutcome(meta.outcome);
  if (!outcome) return undefined;
  const flow = meta.flow === "create_modal" || meta.flow === "library_drop" ? meta.flow : null;
  if (!flow) return undefined;
  const sourceUrlKind =
    meta.sourceUrlKind === "data" ||
    meta.sourceUrlKind === "url" ||
    meta.sourceUrlKind === "unknown"
      ? meta.sourceUrlKind
      : "unknown";
  const extractedAtIso = clampString(meta.extractedAtIso, 64);
  if (!extractedAtIso) return undefined;
  return {
    version: 1,
    outcome,
    flow,
    extractedAtIso,
    sourceUrlKind,
    extractor: "openai_prompt_style_extract",
  };
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
    styleProfile: normalizeVersion1StyleProfile(details?.styleProfile),
    extractionMeta: normalizeExtractionMeta(details?.extractionMeta),
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
    const styleId = rawId.trim();
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
      leftValue.previewImageUrl !== rightValue.previewImageUrl ||
      JSON.stringify(leftValue.styleProfile ?? null) !==
        JSON.stringify(rightValue.styleProfile ?? null) ||
      JSON.stringify(leftValue.extractionMeta ?? null) !==
        JSON.stringify(rightValue.extractionMeta ?? null)
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
