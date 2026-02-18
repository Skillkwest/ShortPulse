/**
 * Curated reference-id list helpers.
 * Keeps add/remove/reorder/prune logic deterministic and shared across state + drag/drop flows.
 */
import type { StudioOutput } from "../types";

export type CuratedReferencePlacement = "before" | "after" | "end";

const normalizeReferenceId = (value: string): string => value.trim();

const areReferenceListsEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/**
 * Adds a reference id to curated state, preserving insertion order and preventing duplicates.
 */
export const addCuratedReferenceId = (currentIds: string[], id: string): string[] => {
  const normalizedId = normalizeReferenceId(id);
  if (!normalizedId) return currentIds;
  if (currentIds.includes(normalizedId)) return currentIds;
  return [...currentIds, normalizedId];
};

/**
 * Removes a reference id from curated state.
 */
export const removeCuratedReferenceId = (currentIds: string[], id: string): string[] => {
  const normalizedId = normalizeReferenceId(id);
  if (!normalizedId) return currentIds;
  const nextIds = currentIds.filter((value) => value !== normalizedId);
  return nextIds.length === currentIds.length ? currentIds : nextIds;
};

/**
 * Reorders a curated reference around another target id (or to end).
 */
export const reorderCuratedReferenceId = (
  currentIds: string[],
  id: string,
  targetId: string | null,
  placement: CuratedReferencePlacement
): string[] => {
  const normalizedId = normalizeReferenceId(id);
  if (!normalizedId) return currentIds;
  if (!currentIds.includes(normalizedId)) return currentIds;

  const nextWithoutId = currentIds.filter((value) => value !== normalizedId);
  if (placement === "end") {
    const next = [...nextWithoutId, normalizedId];
    return areReferenceListsEqual(currentIds, next) ? currentIds : next;
  }

  const normalizedTargetId = targetId ? normalizeReferenceId(targetId) : "";
  if (normalizedTargetId === normalizedId) {
    return currentIds;
  }
  if (!normalizedTargetId || !nextWithoutId.includes(normalizedTargetId)) {
    const next = [...nextWithoutId, normalizedId];
    return areReferenceListsEqual(currentIds, next) ? currentIds : next;
  }

  const targetIndex = nextWithoutId.indexOf(normalizedTargetId);
  const insertIndex = placement === "before" ? targetIndex : targetIndex + 1;
  const next = [
    ...nextWithoutId.slice(0, insertIndex),
    normalizedId,
    ...nextWithoutId.slice(insertIndex),
  ];
  return areReferenceListsEqual(currentIds, next) ? currentIds : next;
};

/**
 * Drops curated ids that no longer exist in the output store.
 */
export const pruneCuratedReferenceIds = (
  currentIds: string[],
  validOutputIds: Iterable<string>
): string[] => {
  const validIdSet = new Set(Array.from(validOutputIds).map(normalizeReferenceId));
  const nextIds = currentIds.filter((id) => validIdSet.has(normalizeReferenceId(id)));
  return areReferenceListsEqual(currentIds, nextIds) ? currentIds : nextIds;
};

/**
 * Applies curated pin semantics to ordered output maps (`pinned=true` when curated, unset otherwise).
 */
export const syncCuratedPinnedOutputsByOrder = (
  order: string[],
  byId: Record<string, StudioOutput>,
  curatedIds: Iterable<string>
): Record<string, StudioOutput> => {
  const curatedIdSet = new Set(Array.from(curatedIds).map(normalizeReferenceId));
  let changed = false;
  let nextById = byId;
  order.forEach((outputId) => {
    const current = byId[outputId];
    if (!current) return;
    const shouldPin = curatedIdSet.has(outputId) ? true : undefined;
    if (current.pinned === shouldPin) return;
    if (!changed) {
      changed = true;
      nextById = { ...byId };
    }
    nextById[outputId] = {
      ...current,
      pinned: shouldPin,
    };
  });
  return changed ? nextById : byId;
};
