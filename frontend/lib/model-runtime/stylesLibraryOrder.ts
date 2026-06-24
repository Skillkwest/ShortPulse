/**
 * Runtime-safe Styles Library ordering helpers shared by API routes and AI Studio UI.
 */
import { BUILT_IN_STYLE_ID_MAX_LENGTH } from "./builtInStyles";

export const STYLES_LIBRARY_MAX_STYLE_ID_LENGTH = BUILT_IN_STYLE_ID_MAX_LENGTH;

/**
 * Normalizes one Styles Library id for persistence-safe reads/writes.
 */
export const normalizeStylesLibraryStyleId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const styleId = value.trim();
  if (!styleId || styleId.length > STYLES_LIBRARY_MAX_STYLE_ID_LENGTH) return null;
  return styleId;
};

/**
 * Normalizes an ordered style-id list for persistence-safe reads/writes.
 */
export const normalizeStylesLibraryOrderedIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((entry) => {
    const styleId = normalizeStylesLibraryStyleId(entry);
    if (!styleId || seen.has(styleId)) return;
    seen.add(styleId);
    normalized.push(styleId);
  });
  return normalized;
};
