/**
 * Shared ordering helpers for the AI Studio styles library surfaces.
 * Keeps the page-level catalog order deterministic across the library panel and right rail.
 */
import type { ExpertEditStyleTile } from "../components/edit/expertEditStyles";
import {
  normalizeStylesLibraryOrderedIds,
  normalizeStylesLibraryStyleId,
  STYLES_LIBRARY_MAX_STYLE_ID_LENGTH,
} from "../../../lib/model-runtime/stylesLibraryOrder";

export {
  normalizeStylesLibraryOrderedIds,
  normalizeStylesLibraryStyleId,
  STYLES_LIBRARY_MAX_STYLE_ID_LENGTH,
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
): string[] => {
  const normalizedOrderedIds = normalizeStylesLibraryOrderedIds(orderedStyleIds);
  const normalizedStyleId = normalizeStylesLibraryStyleId(styleId);
  if (!normalizedStyleId) return normalizedOrderedIds;
  return normalizedOrderedIds.filter((entry) => entry !== normalizedStyleId);
};

export type StylesLibraryReorderPlacement = "before" | "after";

const resolveStylesLibraryReorderPlacement = (
  orderedStyleIds: readonly string[],
  sourceId: string,
  targetId: string,
  placement?: StylesLibraryReorderPlacement
): StylesLibraryReorderPlacement => {
  if (placement === "before" || placement === "after") return placement;
  const sourceIndex = orderedStyleIds.indexOf(sourceId);
  const targetIndex = orderedStyleIds.indexOf(targetId);
  return sourceIndex >= 0 && targetIndex >= 0 && sourceIndex < targetIndex ? "after" : "before";
};

/**
 * Reorders one persisted ordered-id list by moving the source id around the target id.
 */
export const reorderStylesLibraryOrderedIds = (
  orderedStyleIds: readonly string[],
  sourceId: string,
  targetId: string,
  placement?: StylesLibraryReorderPlacement
): string[] => {
  const normalizedOrderedIds = normalizeStylesLibraryOrderedIds(orderedStyleIds);
  const normalizedSourceId = normalizeStylesLibraryStyleId(sourceId);
  const normalizedTargetId = normalizeStylesLibraryStyleId(targetId);
  if (!normalizedSourceId || !normalizedTargetId) return normalizedOrderedIds;
  if (normalizedSourceId === normalizedTargetId) return normalizedOrderedIds;
  const sourceIndex = normalizedOrderedIds.indexOf(normalizedSourceId);
  const targetIndex = normalizedOrderedIds.indexOf(normalizedTargetId);
  if (sourceIndex < 0 || targetIndex < 0) return normalizedOrderedIds;
  const resolvedPlacement = resolveStylesLibraryReorderPlacement(
    normalizedOrderedIds,
    normalizedSourceId,
    normalizedTargetId,
    placement
  );
  const next = [...normalizedOrderedIds];
  const [moved] = next.splice(sourceIndex, 1);
  const nextTargetIndex = next.indexOf(normalizedTargetId);
  if (nextTargetIndex < 0) return normalizedOrderedIds;
  next.splice(resolvedPlacement === "after" ? nextTargetIndex + 1 : nextTargetIndex, 0, moved);
  return next;
};
