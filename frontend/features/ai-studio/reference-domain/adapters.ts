/**
 * Reference-domain adapters.
 * Bridges existing StudioOutput collections with canonical reference entities and state.
 */
import type { StudioOutput } from "../types";
import type { ReferenceEntity, ReferenceEntityKind, ReferenceState } from "./types";
import { createEmptyReferenceState } from "./reducer";

export type StudioOutputCollectionState = {
  order: string[];
  byId: Record<string, StudioOutput>;
};

export const EMPTY_STUDIO_OUTPUT_COLLECTION_STATE: StudioOutputCollectionState = {
  order: [],
  byId: {},
};

const normalizeId = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

const uniqueIds = (ids: Iterable<string>): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawId of ids) {
    const id = normalizeId(rawId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
};

/**
 * Normalizes StudioOutput arrays into deterministic order + by-id state.
 */
export const normalizeStudioOutputCollection = (
  rows: StudioOutput[]
): StudioOutputCollectionState => {
  const byId: Record<string, StudioOutput> = {};
  const order: string[] = [];
  for (const item of rows) {
    if (!item) continue;
    const id = normalizeId(item.id);
    if (!id || byId[id]) continue;
    byId[id] = item;
    order.push(id);
  }
  return {
    order,
    byId,
  };
};

/**
 * Converts normalized output collection state back to ordered rows.
 */
export const denormalizeStudioOutputCollection = (
  state: StudioOutputCollectionState
): StudioOutput[] =>
  state.order.map((id) => state.byId[id]).filter((item): item is StudioOutput => Boolean(item));

/**
 * Checks normalized collection equality by order and object identity.
 */
export const areStudioOutputCollectionStatesEqual = (
  left: StudioOutputCollectionState,
  right: StudioOutputCollectionState
): boolean => {
  if (left === right) return true;
  if (left.order.length !== right.order.length) return false;
  for (let index = 0; index < left.order.length; index += 1) {
    if (left.order[index] !== right.order[index]) return false;
  }
  if (left.byId === right.byId) return true;
  if (Object.keys(left.byId).length !== Object.keys(right.byId).length) return false;
  for (const id of left.order) {
    if (left.byId[id] !== right.byId[id]) return false;
  }
  return true;
};

/**
 * Derives canonical reference kind from a StudioOutput.
 */
export const deriveReferenceEntityKind = (output: StudioOutput): ReferenceEntityKind => {
  if (output.mode === "text" || output.mediaSource === "prompt") return "promptReference";
  if (output.mediaSource === "library") return "libraryMedia";
  if (output.mediaSource === "generated") return "generated";
  return "upload";
};

/**
 * Adapts a StudioOutput to canonical ReferenceEntity.
 */
export const toReferenceEntity = (output: StudioOutput): ReferenceEntity => ({
  id: normalizeId(output.id),
  kind: deriveReferenceEntityKind(output),
  output,
});

/**
 * Adapts a ReferenceEntity to legacy StudioOutput.
 */
export const fromReferenceEntity = (entity: ReferenceEntity): StudioOutput => entity.output;

/**
 * Builds canonical ReferenceState from existing active/archived StudioOutput rows.
 */
export const buildReferenceStateFromStudioOutputs = ({
  activeOutputs,
  archivedOutputs,
  quickSlotIds,
  lastUpdatedAt,
}: {
  activeOutputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
  quickSlotIds: string[];
  lastUpdatedAt?: string | null;
}): ReferenceState => {
  const base = createEmptyReferenceState();
  const ids: string[] = [];
  const entities: Record<string, ReferenceEntity> = {};
  const archivedIds: string[] = [];

  for (const output of activeOutputs) {
    const id = normalizeId(output.id);
    if (!id || entities[id]) continue;
    ids.push(id);
    entities[id] = toReferenceEntity({
      ...output,
      id,
    });
  }

  for (const output of archivedOutputs) {
    const id = normalizeId(output.id);
    if (!id || entities[id]) continue;
    ids.push(id);
    archivedIds.push(id);
    entities[id] = toReferenceEntity({
      ...output,
      id,
    });
  }

  const archivedIdSet = new Set(archivedIds);
  const activeIdSet = new Set(ids.filter((id) => !archivedIdSet.has(id)));
  const normalizedQuickSlotIds = uniqueIds(quickSlotIds).filter((id) => activeIdSet.has(id));

  return {
    ...base,
    ids,
    entities,
    quickSlotIds: normalizedQuickSlotIds,
    archivedIds,
    meta: {
      ...base.meta,
      lastUpdatedAt: lastUpdatedAt ?? null,
    },
  };
};
