/**
 * Selector-subscribed output store for AI Studio shell surfaces.
 * Provides narrow subscriptions over output snapshots so non-grid UI avoids broad array coupling.
 */
import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import type { StudioOutput } from "../types";

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

const EMPTY_IDS: string[] = [];
const EMPTY_OUTPUT_MAP: Record<string, StudioOutput> = {};

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

const areSetsEqual = (left: Set<string>, right: Set<string>) => {
  if (left === right) return true;
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
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
  outputStoreListeners.forEach((listener) => listener());
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
  const indexes = buildIndexes({
    outputOrder,
    outputById,
    archivedOutputOrder,
    previous: previous.indexes,
  });

  if (
    previous.outputOrder === outputOrder &&
    previous.outputById === outputById &&
    previous.archivedOutputOrder === archivedOutputOrder &&
    previous.archivedOutputById === archivedOutputById &&
    previous.indexes === indexes
  ) {
    return;
  }

  outputStoreSnapshot = {
    outputOrder,
    outputById,
    archivedOutputOrder,
    archivedOutputById,
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
      let previousSelected = selectedRef.current;
      return subscribeAiStudioOutputs(() => {
        const nextSelected = selector(outputStoreSnapshot);
        if (isEqual(previousSelected, nextSelected)) {
          return;
        }
        previousSelected = nextSelected;
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
