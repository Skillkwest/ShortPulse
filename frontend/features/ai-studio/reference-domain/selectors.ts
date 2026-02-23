/**
 * Reference-domain selectors.
 * Provides stable read models for all refs, quick slots, archived refs, and visible-grid ordering.
 */
import type { StudioOutput } from "../types";
import type { ReferenceEntity, ReferenceState } from "./types";

const mapEntitiesById = (state: ReferenceState, ids: Iterable<string>): ReferenceEntity[] => {
  const results: ReferenceEntity[] = [];
  for (const rawId of ids) {
    const id = rawId.trim();
    if (!id) continue;
    const entity = state.entities[id];
    if (!entity) continue;
    results.push(entity);
  }
  return results;
};

/**
 * Returns all reference entities in canonical insertion order.
 */
export const selectAllReferenceEntities = (state: ReferenceState): ReferenceEntity[] =>
  mapEntitiesById(state, state.ids).filter((entity) => !state.archivedIds.includes(entity.id));

/**
 * Returns active reference outputs in canonical insertion order.
 */
export const selectAllRefs = (state: ReferenceState): StudioOutput[] =>
  selectAllReferenceEntities(state).map((entity) => entity.output);

/**
 * Returns quick-slot entities in quick-slot order.
 */
export const selectQuickSlotEntities = (state: ReferenceState): ReferenceEntity[] => {
  const archivedSet = new Set(state.archivedIds);
  return mapEntitiesById(state, state.quickSlotIds).filter((entity) => !archivedSet.has(entity.id));
};

/**
 * Returns quick-slot outputs in quick-slot order.
 */
export const selectQuickSlots = (state: ReferenceState): StudioOutput[] =>
  selectQuickSlotEntities(state).map((entity) => entity.output);

/**
 * Returns archived entities in archive order.
 */
export const selectArchivedReferenceEntities = (state: ReferenceState): ReferenceEntity[] =>
  mapEntitiesById(state, state.archivedIds);

/**
 * Returns archived outputs in archive order.
 */
export const selectArchivedRefs = (state: ReferenceState): StudioOutput[] =>
  selectArchivedReferenceEntities(state).map((entity) => entity.output);

/**
 * Returns visible grid outputs with quick slots first followed by remaining active refs.
 */
export const selectVisibleGrid = (state: ReferenceState): StudioOutput[] => {
  const quickSlotEntities = selectQuickSlotEntities(state);
  const quickSlotIdSet = new Set(quickSlotEntities.map((entity) => entity.id));
  const remaining = selectAllReferenceEntities(state).filter(
    (entity) => !quickSlotIdSet.has(entity.id)
  );
  return [...quickSlotEntities, ...remaining].map((entity) => entity.output);
};
