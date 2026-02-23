/**
 * Reference-domain reducer.
 * Provides deterministic transitions for reference entities, projection ids, and media/status updates.
 */
import type { ReferenceEntity, ReferenceReducerAction, ReferenceState } from "./types";

const normalizeId = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

const areListsEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const uniqueIds = (ids: Iterable<string>, allowedIds?: Set<string>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawId of ids) {
    const id = normalizeId(rawId);
    if (!id || seen.has(id)) continue;
    if (allowedIds && !allowedIds.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

const withMeta = (
  state: ReferenceState,
  updatedAt: string | null | undefined,
  overrides: Omit<ReferenceState, "meta">
): ReferenceState => ({
  ...overrides,
  meta: {
    version: state.meta.version + 1,
    lastUpdatedAt: updatedAt ?? state.meta.lastUpdatedAt,
  },
});

const updateEntity = (
  state: ReferenceState,
  id: string,
  updater: (entity: ReferenceEntity) => ReferenceEntity,
  updatedAt?: string | null
): ReferenceState => {
  const current = state.entities[id];
  if (!current) return state;
  const next = updater(current);
  if (next === current) return state;
  return withMeta(state, updatedAt, {
    ...state,
    entities: {
      ...state.entities,
      [id]: next,
    },
  });
};

const reorderIds = (
  current: string[],
  id: string,
  targetId: string | null,
  placement: "before" | "after" | "end"
): string[] => {
  if (!current.includes(id)) return current;
  const withoutId = current.filter((value) => value !== id);
  if (placement === "end") {
    return [...withoutId, id];
  }
  const normalizedTargetId = normalizeId(targetId);
  if (!normalizedTargetId || normalizedTargetId === id || !withoutId.includes(normalizedTargetId)) {
    return [...withoutId, id];
  }
  const targetIndex = withoutId.indexOf(normalizedTargetId);
  const insertIndex = placement === "before" ? targetIndex : targetIndex + 1;
  return [...withoutId.slice(0, insertIndex), id, ...withoutId.slice(insertIndex)];
};

/**
 * Builds an empty reference state.
 */
export const createEmptyReferenceState = (): ReferenceState => ({
  ids: [],
  entities: {},
  quickSlotIds: [],
  archivedIds: [],
  meta: {
    version: 0,
    lastUpdatedAt: null,
  },
});

/**
 * Reference-domain reducer entrypoint.
 */
export const referenceReducer = (
  state: ReferenceState,
  action: ReferenceReducerAction
): ReferenceState => {
  switch (action.type) {
    case "addMany": {
      if (action.entities.length === 0) return state;
      let ids = state.ids;
      let entities = state.entities;
      let changed = false;
      const touchedIds: string[] = [];
      for (const entity of action.entities) {
        const id = normalizeId(entity?.id ?? entity?.output?.id ?? "");
        if (!id) continue;
        touchedIds.push(id);
        const normalizedEntity: ReferenceEntity =
          entity.id === id && entity.output.id === id
            ? entity
            : {
                ...entity,
                id,
                output: {
                  ...entity.output,
                  id,
                },
              };
        if (entities[id] !== normalizedEntity) {
          if (!changed) {
            entities = { ...state.entities };
            changed = true;
          }
          entities[id] = normalizedEntity;
        }
        if (!ids.includes(id)) {
          if (ids === state.ids) ids = [...state.ids];
          ids.push(id);
          changed = true;
        }
      }

      if (!changed) return state;

      const touchedSet = new Set(uniqueIds(touchedIds));
      let archivedIds = state.archivedIds;
      let quickSlotIds = state.quickSlotIds;

      if (action.archived) {
        archivedIds = uniqueIds([...state.archivedIds, ...touchedSet]);
        quickSlotIds = state.quickSlotIds.filter((id) => !touchedSet.has(id));
      } else {
        archivedIds = state.archivedIds.filter((id) => !touchedSet.has(id));
      }

      return withMeta(state, action.updatedAt, {
        ids,
        entities,
        quickSlotIds,
        archivedIds,
      });
    }

    case "remove": {
      const id = normalizeId(action.id);
      if (!id || !state.entities[id]) return state;
      const nextEntities = { ...state.entities };
      delete nextEntities[id];
      return withMeta(state, action.updatedAt, {
        ids: state.ids.filter((value) => value !== id),
        entities: nextEntities,
        quickSlotIds: state.quickSlotIds.filter((value) => value !== id),
        archivedIds: state.archivedIds.filter((value) => value !== id),
      });
    }

    case "archive": {
      const id = normalizeId(action.id);
      if (!id || !state.entities[id] || state.archivedIds.includes(id)) return state;
      return withMeta(state, action.updatedAt, {
        ...state,
        quickSlotIds: state.quickSlotIds.filter((value) => value !== id),
        archivedIds: [...state.archivedIds, id],
      });
    }

    case "restore": {
      const id = normalizeId(action.id);
      if (!id || !state.archivedIds.includes(id)) return state;
      return withMeta(state, action.updatedAt, {
        ...state,
        archivedIds: state.archivedIds.filter((value) => value !== id),
      });
    }

    case "setQuickSlots": {
      const allowedIds = new Set(
        state.ids.filter((id) => state.entities[id] && !state.archivedIds.includes(id))
      );
      const nextQuickSlotIds = uniqueIds(action.ids, allowedIds);
      if (areListsEqual(state.quickSlotIds, nextQuickSlotIds)) return state;
      return withMeta(state, action.updatedAt, {
        ...state,
        quickSlotIds: nextQuickSlotIds,
      });
    }

    case "reorderQuickSlots": {
      const id = normalizeId(action.id);
      if (!id) return state;
      const nextQuickSlotIds = reorderIds(
        state.quickSlotIds,
        id,
        action.targetId,
        action.placement
      );
      if (areListsEqual(state.quickSlotIds, nextQuickSlotIds)) return state;
      return withMeta(state, action.updatedAt, {
        ...state,
        quickSlotIds: nextQuickSlotIds,
      });
    }

    case "setStatus": {
      const id = normalizeId(action.id);
      if (!id) return state;
      return updateEntity(
        state,
        id,
        (entity) => {
          if (entity.output.status === action.status) return entity;
          return {
            ...entity,
            output: {
              ...entity.output,
              status: action.status,
            },
          };
        },
        action.updatedAt
      );
    }

    case "hydrateMedia": {
      const id = normalizeId(action.id);
      if (!id) return state;
      const patchEntries = Object.entries(action.patch);
      if (patchEntries.length === 0) return state;
      return updateEntity(
        state,
        id,
        (entity) => {
          const outputPatch: Record<string, unknown> = {};
          let changed = false;
          for (const [key, value] of patchEntries) {
            if (entity.output[key as keyof typeof entity.output] === value) continue;
            changed = true;
            outputPatch[key] = value;
          }
          if (!changed) return entity;
          return {
            ...entity,
            output: {
              ...entity.output,
              ...outputPatch,
            },
          };
        },
        action.updatedAt
      );
    }

    default:
      return state;
  }
};
