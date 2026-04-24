/**
 * Shared ordering helpers for the AI Studio styles library surfaces.
 * Keeps the page-level catalog order deterministic across the library panel and right rail.
 */
import type { ExpertEditStyleTile } from "../components/edit/expertEditStyles";

/**
 * Normalizes an ordered style-id list for persistence-safe reads/writes.
 */
export const normalizeStylesLibraryOrderedIds = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== "string") return;
    const styleId = entry.trim();
    if (!styleId || seen.has(styleId)) return;
    seen.add(styleId);
    normalized.push(styleId);
  });
  return normalized;
};

/**
 * Merges remote/local ordering while preserving the local sequence as the current source of truth.
 */
export const mergeStylesLibraryOrderedIds = (
  remoteValue: string[],
  localValue: string[]
): string[] => {
  const normalizedLocal = normalizeStylesLibraryOrderedIds(localValue);
  const localSet = new Set(normalizedLocal);
  const appendedRemote = normalizeStylesLibraryOrderedIds(remoteValue).filter(
    (styleId) => !localSet.has(styleId)
  );
  return [...normalizedLocal, ...appendedRemote];
};

/**
 * Orders the visible styles catalog against a persisted id sequence and appends unseen styles.
 */
export const resolveOrderedStylesCatalog = (
  styles: readonly ExpertEditStyleTile[],
  orderedStyleIds: readonly string[]
): ExpertEditStyleTile[] => {
  if (styles.length === 0) return [];
  const normalizedOrderedIds = normalizeStylesLibraryOrderedIds(orderedStyleIds);
  if (normalizedOrderedIds.length === 0) return [...styles];
  const styleById = new Map(styles.map((style) => [style.id, style] as const));
  const orderedStyles = normalizedOrderedIds
    .map((styleId) => styleById.get(styleId))
    .filter((style): style is ExpertEditStyleTile => Boolean(style));
  const orderedStyleIdSet = new Set(orderedStyles.map((style) => style.id));
  const appendedStyles = styles.filter((style) => !orderedStyleIdSet.has(style.id));
  return [...orderedStyles, ...appendedStyles];
};

/**
 * Removes one style id from a persisted ordered-id list.
 */
export const removeStylesLibraryOrderedId = (
  orderedStyleIds: readonly string[],
  styleId: string
): string[] =>
  normalizeStylesLibraryOrderedIds(orderedStyleIds).filter((entry) => entry !== styleId.trim());

/**
 * Reorders one persisted ordered-id list by moving the source id before the target id.
 */
export const reorderStylesLibraryOrderedIds = (
  orderedStyleIds: readonly string[],
  sourceId: string,
  targetId: string
): string[] => {
  const normalizedOrderedIds = normalizeStylesLibraryOrderedIds(orderedStyleIds);
  if (sourceId === targetId) return normalizedOrderedIds;
  const sourceIndex = normalizedOrderedIds.indexOf(sourceId);
  const targetIndex = normalizedOrderedIds.indexOf(targetId);
  if (sourceIndex < 0 || targetIndex < 0) return normalizedOrderedIds;
  const next = [...normalizedOrderedIds];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};
