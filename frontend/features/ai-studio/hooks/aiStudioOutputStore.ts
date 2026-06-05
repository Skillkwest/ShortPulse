/**
 * Selector-subscribed output store for AI Studio shell surfaces.
 * Provides narrow subscriptions over output snapshots so non-grid UI avoids broad array coupling.
 */
import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import type { StudioOutput } from "../types";
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../logic/freezeInvestigationTelemetry";

export type AiStudioOutputIndexes = {
  inFlightIds: Set<string>;
  failedIds: Set<string>;
  activeCount: number;
  archivedCount: number;
};

export type AiStudioOutputStoreSnapshot = {
  outputOrder: string[];
  outputById: Record<string, StudioOutput>;
  archivedOutputOrder: string[];
  archivedOutputById: Record<string, StudioOutput>;
  indexes: AiStudioOutputIndexes;
};

export type OutputSelector<T> = (snapshot: AiStudioOutputStoreSnapshot) => T;

type OutputStoreListener = () => void;
type ReferenceGridOutputProjectionState = {
  quickSlotIds?: readonly string[];
  removedFromAllRefsIds?: readonly string[];
};
type VisibleAllRefsOutputIdsCache = {
  outputOrder: string[] | null;
  outputById: Record<string, StudioOutput> | null;
  removedFromAllRefsKey: string;
  result: string[];
};
type QuickSlotOutputIdsCache = {
  outputById: Record<string, StudioOutput> | null;
  quickSlotKey: string;
  result: string[];
};

const EMPTY_IDS: string[] = [];
const EMPTY_OUTPUT_MAP: Record<string, StudioOutput> = {};
const STRING_ARRAY_CACHE_SEPARATOR = "\u0000";

const createInitialIndexes = (): AiStudioOutputIndexes => ({
  inFlightIds: new Set<string>(),
  failedIds: new Set<string>(),
  activeCount: 0,
  archivedCount: 0,
});

const createInitialSnapshot = (): AiStudioOutputStoreSnapshot => ({
  outputOrder: EMPTY_IDS,
  outputById: EMPTY_OUTPUT_MAP,
  archivedOutputOrder: EMPTY_IDS,
  archivedOutputById: EMPTY_OUTPUT_MAP,
  indexes: createInitialIndexes(),
});

let outputStoreSnapshot: AiStudioOutputStoreSnapshot = createInitialSnapshot();
const outputStoreListeners = new Set<OutputStoreListener>();
let isNotifyingOutputStoreListeners = false;
let hasPendingOutputStoreNotify = false;
let visibleAllRefsOutputIdsCache: VisibleAllRefsOutputIdsCache = {
  outputOrder: null,
  outputById: null,
  removedFromAllRefsKey: "",
  result: EMPTY_IDS,
};
let quickSlotOutputIdsCache: QuickSlotOutputIdsCache = {
  outputById: null,
  quickSlotKey: "",
  result: EMPTY_IDS,
};

const areSetsEqual = (left: Set<string>, right: Set<string>) => {
  if (left === right) return true;
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
};

const areStringArraysEqual = (left: string[], right: string[]) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const createStringArrayCacheKey = (values: readonly string[] | undefined): string =>
  values && values.length > 0 ? values.join(STRING_ARRAY_CACHE_SEPARATOR) : "";

const areOutputEntityArraysEqual = (left: StudioOutput[], right: StudioOutput[]) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const areOutputMapsEquivalent = (
  left: Record<string, StudioOutput>,
  right: Record<string, StudioOutput>,
  order: string[]
) => {
  if (left === right) return true;
  if (Object.keys(left).length !== Object.keys(right).length) return false;
  for (const id of order) {
    if (left[id] !== right[id]) return false;
  }
  return true;
};

const areOutputMapsEqualForIds = (
  left: Record<string, StudioOutput>,
  right: Record<string, StudioOutput>,
  ids: readonly string[]
) => {
  if (left === right) return true;
  for (const id of ids) {
    if ((left[id] ?? null) !== (right[id] ?? null)) return false;
  }
  return true;
};

const buildIndexes = ({
  outputOrder,
  outputById,
  archivedOutputOrder,
  previous,
}: {
  outputOrder: string[];
  outputById: Record<string, StudioOutput>;
  archivedOutputOrder: string[];
  previous: AiStudioOutputIndexes;
}): AiStudioOutputIndexes => {
  const nextInFlightIds = new Set<string>();
  const nextFailedIds = new Set<string>();

  outputOrder.forEach((id) => {
    const item = outputById[id];
    if (!item) return;
    if (item.taskState === "pending" || item.taskState === "running") {
      nextInFlightIds.add(id);
    }
    if (item.taskState === "fail") {
      nextFailedIds.add(id);
    }
  });

  const inFlightIds = areSetsEqual(nextInFlightIds, previous.inFlightIds)
    ? previous.inFlightIds
    : nextInFlightIds;
  const failedIds = areSetsEqual(nextFailedIds, previous.failedIds)
    ? previous.failedIds
    : nextFailedIds;
  const activeCount = outputOrder.length;
  const archivedCount = archivedOutputOrder.length;

  if (
    inFlightIds === previous.inFlightIds &&
    failedIds === previous.failedIds &&
    activeCount === previous.activeCount &&
    archivedCount === previous.archivedCount
  ) {
    return previous;
  }

  return {
    inFlightIds,
    failedIds,
    activeCount,
    archivedCount,
  };
};

const notifyOutputStoreListeners = () => {
  incrementFreezeInvestigationCounter("outputStore.notify.calls");
  if (isNotifyingOutputStoreListeners) {
    hasPendingOutputStoreNotify = true;
    incrementFreezeInvestigationCounter("outputStore.notify.reentrant");
    return;
  }
  isNotifyingOutputStoreListeners = true;
  try {
    do {
      hasPendingOutputStoreNotify = false;
      const listeners = Array.from(outputStoreListeners);
      setFreezeInvestigationGauge("outputStore.listenerCount", listeners.length);
      listeners.forEach((listener) => {
        if (!outputStoreListeners.has(listener)) return;
        listener();
      });
    } while (hasPendingOutputStoreNotify);
  } finally {
    isNotifyingOutputStoreListeners = false;
  }
};

export const getAiStudioOutputSnapshot = (): AiStudioOutputStoreSnapshot => outputStoreSnapshot;

export const subscribeAiStudioOutputs = (listener: OutputStoreListener): (() => void) => {
  outputStoreListeners.add(listener);
  return () => {
    outputStoreListeners.delete(listener);
  };
};

export const setAiStudioOutputStoreSnapshot = ({
  outputOrder,
  outputById,
  archivedOutputOrder,
  archivedOutputById,
}: Omit<AiStudioOutputStoreSnapshot, "indexes">) => {
  const previous = outputStoreSnapshot;
  const sameOutputOrder =
    previous.outputOrder === outputOrder || areStringArraysEqual(previous.outputOrder, outputOrder);
  const sameArchivedOutputOrder =
    previous.archivedOutputOrder === archivedOutputOrder ||
    areStringArraysEqual(previous.archivedOutputOrder, archivedOutputOrder);
  const sameOutputById =
    previous.outputById === outputById ||
    (sameOutputOrder && areOutputMapsEquivalent(previous.outputById, outputById, outputOrder));
  const sameArchivedOutputById =
    previous.archivedOutputById === archivedOutputById ||
    (sameArchivedOutputOrder &&
      areOutputMapsEquivalent(
        previous.archivedOutputById,
        archivedOutputById,
        archivedOutputOrder
      ));

  const nextOutputOrder = sameOutputOrder ? previous.outputOrder : outputOrder;
  const nextOutputById = sameOutputById ? previous.outputById : outputById;
  const nextArchivedOutputOrder = sameArchivedOutputOrder
    ? previous.archivedOutputOrder
    : archivedOutputOrder;
  const nextArchivedOutputById = sameArchivedOutputById
    ? previous.archivedOutputById
    : archivedOutputById;
  const indexes = buildIndexes({
    outputOrder: nextOutputOrder,
    outputById: nextOutputById,
    archivedOutputOrder: nextArchivedOutputOrder,
    previous: previous.indexes,
  });

  if (
    previous.outputOrder === nextOutputOrder &&
    previous.outputById === nextOutputById &&
    previous.archivedOutputOrder === nextArchivedOutputOrder &&
    previous.archivedOutputById === nextArchivedOutputById &&
    previous.indexes === indexes
  ) {
    return;
  }

  incrementFreezeInvestigationCounter("outputStore.snapshot.publish");
  setFreezeInvestigationGauge("outputStore.activeCount", nextOutputOrder.length);
  setFreezeInvestigationGauge("outputStore.archivedCount", nextArchivedOutputOrder.length);
  setFreezeInvestigationGauge("outputStore.inFlightCount", indexes.inFlightIds.size);
  outputStoreSnapshot = {
    outputOrder: nextOutputOrder,
    outputById: nextOutputById,
    archivedOutputOrder: nextArchivedOutputOrder,
    archivedOutputById: nextArchivedOutputById,
    indexes,
  };
  notifyOutputStoreListeners();
};

export const getAiStudioOutputById = (id: string | null | undefined): StudioOutput | null => {
  if (!id) return null;
  const snapshot = outputStoreSnapshot;
  return snapshot.outputById[id] ?? snapshot.archivedOutputById[id] ?? null;
};

export const resetAiStudioOutputStore = () => {
  outputStoreSnapshot = createInitialSnapshot();
  notifyOutputStoreListeners();
};

/**
 * Projects store-backed All Refs ids without materializing full output rows.
 * Inputs: output store snapshot plus Reference Grid projection ids.
 * Output: stable visible All Refs output ids, excluding hidden and removed rows.
 * Side effects: updates dev-only freeze-investigation counters.
 */
export const selectVisibleAllRefsOutputIdsFromStoreSnapshot = (
  snapshot: AiStudioOutputStoreSnapshot,
  state: ReferenceGridOutputProjectionState
): string[] => {
  const removedFromAllRefsKey = createStringArrayCacheKey(state.removedFromAllRefsIds);
  if (
    visibleAllRefsOutputIdsCache.outputOrder === snapshot.outputOrder &&
    visibleAllRefsOutputIdsCache.outputById === snapshot.outputById &&
    visibleAllRefsOutputIdsCache.removedFromAllRefsKey === removedFromAllRefsKey
  ) {
    incrementFreezeInvestigationCounter("referenceGrid.outputProjection.allRefs.cacheHit");
    return visibleAllRefsOutputIdsCache.result;
  }

  incrementFreezeInvestigationCounter("referenceGrid.outputProjection.allRefs.scan");
  setFreezeInvestigationGauge(
    "referenceGrid.outputProjection.allRefs.inputCount",
    snapshot.outputOrder.length
  );
  const removedFromAllRefsIds = state.removedFromAllRefsIds ?? EMPTY_IDS;
  const removedSet =
    removedFromAllRefsIds.length > 0 ? new Set<string>(removedFromAllRefsIds) : null;
  const nextIds: string[] = [];
  for (const id of snapshot.outputOrder) {
    const item = snapshot.outputById[id];
    if (!item) continue;
    if (item.hiddenInReferenceGrid === true) continue;
    if (removedSet?.has(id)) continue;
    nextIds.push(id);
  }
  const result = areStringArraysEqual(visibleAllRefsOutputIdsCache.result, nextIds)
    ? visibleAllRefsOutputIdsCache.result
    : nextIds;
  visibleAllRefsOutputIdsCache = {
    outputOrder: snapshot.outputOrder,
    outputById: snapshot.outputById,
    removedFromAllRefsKey,
    result,
  };
  return result;
};

/**
 * Projects store-backed Quick Slot ids through the normalized output map.
 * Inputs: output store snapshot plus ordered quick-slot ids.
 * Output: stable Quick Slot output ids, excluding hidden or missing active rows.
 * Side effects: updates dev-only freeze-investigation counters.
 */
export const selectQuickSlotOutputIdsFromStoreSnapshot = (
  snapshot: AiStudioOutputStoreSnapshot,
  state: ReferenceGridOutputProjectionState
): string[] => {
  const quickSlotIds = state.quickSlotIds ?? EMPTY_IDS;
  if (quickSlotIds.length === 0) return EMPTY_IDS;
  const quickSlotKey = createStringArrayCacheKey(quickSlotIds);
  if (
    quickSlotOutputIdsCache.outputById === snapshot.outputById &&
    quickSlotOutputIdsCache.quickSlotKey === quickSlotKey
  ) {
    incrementFreezeInvestigationCounter("referenceGrid.outputProjection.quickSlot.cacheHit");
    return quickSlotOutputIdsCache.result;
  }

  incrementFreezeInvestigationCounter("referenceGrid.outputProjection.quickSlot.lookup");
  setFreezeInvestigationGauge(
    "referenceGrid.outputProjection.quickSlot.inputCount",
    quickSlotIds.length
  );
  const nextIds: string[] = [];
  for (const id of quickSlotIds) {
    const item = snapshot.outputById[id];
    if (!item || item.hiddenInReferenceGrid === true) continue;
    nextIds.push(id);
  }
  const result = areStringArraysEqual(quickSlotOutputIdsCache.result, nextIds)
    ? quickSlotOutputIdsCache.result
    : nextIds;
  quickSlotOutputIdsCache = {
    outputById: snapshot.outputById,
    quickSlotKey,
    result,
  };
  return result;
};

const defaultSelectorEquality = <T>(left: T, right: T) => Object.is(left, right);

/**
 * Subscribes to an output selector and only re-renders when that selector changes.
 */
export const useOutputSelector = <T>(
  selector: OutputSelector<T>,
  isEqual: (left: T, right: T) => boolean = defaultSelectorEquality
): T => {
  const selectedRef = useRef<T>(selector(outputStoreSnapshot));

  const subscribe = useCallback(
    (notify: () => void) => {
      return subscribeAiStudioOutputs(() => {
        incrementFreezeInvestigationCounter("outputStore.selectorNotify.calls");
        const previousSelected = selectedRef.current;
        const nextSelected = selector(outputStoreSnapshot);
        if (isEqual(previousSelected, nextSelected)) {
          incrementFreezeInvestigationCounter("outputStore.selectorNotify.skipped");
          return;
        }
        incrementFreezeInvestigationCounter("outputStore.selectorNotify.changed");
        selectedRef.current = nextSelected;
        notify();
      });
    },
    [isEqual, selector]
  );

  const getSnapshot = useCallback(() => {
    const nextSelected = selector(outputStoreSnapshot);
    if (isEqual(selectedRef.current, nextSelected)) {
      return selectedRef.current;
    }
    selectedRef.current = nextSelected;
    return nextSelected;
  }, [isEqual, selector]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

/**
 * Reads a single output by id from the selector store.
 */
export const useOutputById = (id: string | null | undefined): StudioOutput | null =>
  useOutputSelector(
    useCallback(
      (snapshot: AiStudioOutputStoreSnapshot) => {
        if (!id) return null;
        return snapshot.outputById[id] ?? snapshot.archivedOutputById[id] ?? null;
      },
      [id]
    )
  );

/**
 * Reads active/archived output counts from indexed selector state.
 */
export const useOutputCounts = () => {
  const counts = useOutputSelector(
    (snapshot) => [snapshot.indexes.activeCount, snapshot.indexes.archivedCount] as const,
    (left, right) => left[0] === right[0] && left[1] === right[1]
  );
  return useMemo(
    () => ({
      activeCount: counts[0],
      archivedCount: counts[1],
    }),
    [counts]
  );
};

/**
 * Reads a denormalized slice of outputs by explicit ids while preserving item identity equality.
 */
export const useOutputsByIds = (
  ids: readonly string[],
  options?: { includeArchived?: boolean }
): StudioOutput[] => {
  const includeArchived = options?.includeArchived ?? false;
  return useOutputSelector(
    useCallback(
      (snapshot: AiStudioOutputStoreSnapshot) =>
        ids
          .map(
            (id) =>
              snapshot.outputById[id] ??
              (includeArchived ? snapshot.archivedOutputById[id] : undefined)
          )
          .filter((item): item is StudioOutput => Boolean(item)),
      [ids, includeArchived]
    ),
    areOutputEntityArraysEqual
  );
};

/**
 * Reads a normalized id->output map for explicit ids while preserving entity identity equality.
 */
export const useOutputMapByIds = (
  ids: readonly string[],
  options?: { includeArchived?: boolean }
): Record<string, StudioOutput> => {
  const includeArchived = options?.includeArchived ?? false;
  return useOutputSelector(
    useCallback(
      (snapshot: AiStudioOutputStoreSnapshot) => {
        const next: Record<string, StudioOutput> = {};
        ids.forEach((id) => {
          const item =
            snapshot.outputById[id] ??
            (includeArchived ? snapshot.archivedOutputById[id] : undefined);
          if (item) {
            next[id] = item;
          }
        });
        return next;
      },
      [ids, includeArchived]
    ),
    (left, right) => areOutputMapsEqualForIds(left, right, ids)
  );
};

/**
 * Reads a denormalized slice of visible outputs for windowed render consumers.
 */
export const useVisibleOutputWindow = (start: number, end: number): StudioOutput[] =>
  useOutputSelector(
    useCallback(
      (snapshot) => {
        const safeStart = Math.max(0, Math.floor(start));
        const safeEnd = Math.max(safeStart, Math.floor(end));
        const visibleIds = snapshot.outputOrder.slice(safeStart, safeEnd);
        return visibleIds
          .map((id) => snapshot.outputById[id])
          .filter((item): item is StudioOutput => Boolean(item));
      },
      [end, start]
    ),
    (left, right) => {
      if (left === right) return true;
      if (left.length !== right.length) return false;
      return left.every((item, index) => item === right[index]);
    }
  );
