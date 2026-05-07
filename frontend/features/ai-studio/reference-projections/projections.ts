/**
 * Reference projection helpers.
 * Provides deterministic transitions and selectors for all refs and quick-slot surfaces.
 */
import type { StudioOutput } from "../types";
import {
  addCuratedReferenceId,
  removeCuratedReferenceId,
  reorderCuratedReferenceId,
} from "../logic/curatedReferences";
import type { ReferenceProjectionState } from "./types";

const normalizeId = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

const uniqueIds = (ids: Iterable<string>): string[] => {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const raw of ids) {
    const id = normalizeId(raw);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    deduped.push(id);
  }
  return deduped;
};

const removeIdFromList = (ids: string[], id: string): string[] => {
  const normalizedId = normalizeId(id);
  if (!normalizedId) return ids;
  const next = ids.filter((value) => value !== normalizedId);
  return next.length === ids.length ? ids : next;
};

const areListsEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

/**
 * Builds empty projection state.
 */
export const createEmptyReferenceProjectionState = (): ReferenceProjectionState => ({
  quickSlotIds: [],
  removedFromAllRefsIds: [],
});

/**
 * Adds a reference to quick slots and clears all-refs suppression for that id.
 */
export const addQuickSlotReference = (
  state: ReferenceProjectionState,
  id: string
): ReferenceProjectionState => {
  const nextQuickSlotIds = addCuratedReferenceId(state.quickSlotIds, id);
  const nextRemovedIds = removeIdFromList(state.removedFromAllRefsIds, id);
  if (
    areListsEqual(nextQuickSlotIds, state.quickSlotIds) &&
    areListsEqual(nextRemovedIds, state.removedFromAllRefsIds)
  ) {
    return state;
  }
  return {
    quickSlotIds: nextQuickSlotIds,
    removedFromAllRefsIds: nextRemovedIds,
  };
};

/**
 * Removes a reference from quick slots.
 */
export const removeQuickSlotReference = (
  state: ReferenceProjectionState,
  id: string
): ReferenceProjectionState => {
  const nextQuickSlotIds = removeCuratedReferenceId(state.quickSlotIds, id);
  const nextRemovedIds = removeIdFromList(state.removedFromAllRefsIds, id);
  if (
    areListsEqual(nextQuickSlotIds, state.quickSlotIds) &&
    areListsEqual(nextRemovedIds, state.removedFromAllRefsIds)
  ) {
    return state;
  }
  return {
    quickSlotIds: nextQuickSlotIds,
    removedFromAllRefsIds: nextRemovedIds,
  };
};

/**
 * Reorders quick slots around a target id.
 */
export const reorderQuickSlotReference = (
  state: ReferenceProjectionState,
  id: string,
  targetId: string | null,
  placement: "before" | "after" | "end"
): ReferenceProjectionState => {
  const nextQuickSlotIds = reorderCuratedReferenceId(state.quickSlotIds, id, targetId, placement);
  if (areListsEqual(nextQuickSlotIds, state.quickSlotIds)) return state;
  return {
    ...state,
    quickSlotIds: nextQuickSlotIds,
  };
};

/**
 * Clears all quick-slot ids.
 */
export const clearQuickSlotReferences = (
  state: ReferenceProjectionState
): ReferenceProjectionState => {
  if (state.quickSlotIds.length === 0 && state.removedFromAllRefsIds.length === 0) return state;
  return {
    quickSlotIds: [],
    removedFromAllRefsIds: [],
  };
};

/**
 * Marks a quick-slot reference as removed from all-refs projection.
 */
export const markReferenceRemovedFromAllRefs = (
  state: ReferenceProjectionState,
  id: string
): ReferenceProjectionState => {
  const normalizedId = normalizeId(id);
  if (!normalizedId) return state;
  if (!state.quickSlotIds.includes(normalizedId)) return state;
  if (state.removedFromAllRefsIds.includes(normalizedId)) return state;
  return {
    ...state,
    removedFromAllRefsIds: [...state.removedFromAllRefsIds, normalizedId],
  };
};

/**
 * Indicates whether a reference id is currently suppressed from all-refs projection.
 */
export const isReferenceSuppressedFromAllRefs = (
  state: ReferenceProjectionState,
  id: string
): boolean => {
  const normalizedId = normalizeId(id);
  if (!normalizedId) return false;
  return state.removedFromAllRefsIds.includes(normalizedId);
};

/**
 * Returns whether removing a quick-slot should finalize deletion from active outputs.
 */
export const shouldFinalizeRemovalOnQuickSlotDetach = (
  state: ReferenceProjectionState,
  id: string
): boolean => isReferenceSuppressedFromAllRefs(state, id);

/**
 * Drops stale projection ids when outputs are removed/archived.
 */
export const pruneReferenceProjectionState = (
  state: ReferenceProjectionState,
  validOutputIds: Iterable<string>
): ReferenceProjectionState => {
  const validIdSet = new Set(uniqueIds(validOutputIds));
  const nextQuickSlotIds = state.quickSlotIds.filter((id) => validIdSet.has(id));
  const nextRemovedIds = state.removedFromAllRefsIds.filter((id) => validIdSet.has(id));
  if (
    areListsEqual(nextQuickSlotIds, state.quickSlotIds) &&
    areListsEqual(nextRemovedIds, state.removedFromAllRefsIds)
  ) {
    return state;
  }
  return {
    quickSlotIds: nextQuickSlotIds,
    removedFromAllRefsIds: nextRemovedIds,
  };
};

/**
 * Resolves all-refs projection from active outputs.
 */
export const selectAllRefsProjection = (
  outputs: StudioOutput[],
  state: ReferenceProjectionState
): StudioOutput[] => {
  if (!state.removedFromAllRefsIds.length) return outputs;
  const removedSet = new Set(state.removedFromAllRefsIds);
  return outputs.filter((item) => !removedSet.has(item.id));
};

/**
 * Resolves the canonical visible All Refs projection from active outputs.
 */
export const selectVisibleAllRefsProjection = (
  outputs: StudioOutput[],
  state: ReferenceProjectionState
): StudioOutput[] => {
  const explicitProjection = selectAllRefsProjection(outputs, state);
  return explicitProjection.filter((item) => item.hiddenInReferenceGrid !== true);
};

/**
 * Resolves quick-slot projection from active outputs and quick-slot ids.
 */
export const selectQuickSlotProjection = (
  outputs: StudioOutput[],
  state: ReferenceProjectionState
): StudioOutput[] => {
  if (!state.quickSlotIds.length) return [];
  const byId = new Map(outputs.map((item) => [item.id, item]));
  return state.quickSlotIds
    .map((id) => byId.get(id))
    .filter((item): item is StudioOutput => Boolean(item));
};
