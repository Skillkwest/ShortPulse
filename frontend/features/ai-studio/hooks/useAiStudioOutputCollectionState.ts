import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  areStudioOutputCollectionStatesEqual,
  denormalizeStudioOutputCollection,
  EMPTY_STUDIO_OUTPUT_COLLECTION_STATE,
  normalizeStudioOutputCollection,
  type StudioOutputCollectionState,
} from "../reference-domain";
import { sortStudioOutputsByCreatedAtDesc } from "../logic/outputOrdering";
import { limitReferenceGridVisibleOutputs } from "../reference-grid/logic/referenceGridLimits";
import type { StudioOutput } from "../types";
import { setAiStudioOutputStoreSnapshot } from "./aiStudioOutputStore";

type OutputCollectionState = StudioOutputCollectionState;

type OutputCollectionAuthorityState = {
  active: OutputCollectionState;
  archived: OutputCollectionState;
};

const normalizeActiveRows = (
  rows: StudioOutput[]
): {
  rows: StudioOutput[];
  state: StudioOutputCollectionState;
} => {
  const orderedRows = rows.every(
    (row) => typeof row.createdAt === "string" && row.createdAt.trim().length > 0
  )
    ? sortStudioOutputsByCreatedAtDesc(rows)
    : rows;
  const limited = limitReferenceGridVisibleOutputs(orderedRows);
  return {
    rows: limited.rows,
    state: normalizeStudioOutputCollection(limited.rows),
  };
};

type UseAiStudioOutputCollectionStateResult = {
  activeOutputState: OutputCollectionState;
  setActiveOutputState: Dispatch<SetStateAction<OutputCollectionState>>;
  archivedOutputState: OutputCollectionState;
  setArchivedOutputState: Dispatch<SetStateAction<OutputCollectionState>>;
  activeOutputStateRef: MutableRefObject<OutputCollectionState>;
  archivedOutputStateRef: MutableRefObject<OutputCollectionState>;
  activeOutputByIdRef: MutableRefObject<Record<string, StudioOutput>>;
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
  activeOutputById: Record<string, StudioOutput>;
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setOutputCollectionsForAuthority: (
    authorityKey: string,
    activeOutputs: StudioOutput[],
    archivedOutputs: StudioOutput[]
  ) => void;
};

export const useAiStudioOutputCollectionState = ({
  authorityKey = "session:pending",
}: {
  authorityKey?: string;
} = {}): UseAiStudioOutputCollectionStateResult => {
  const [activeOutputState, setActiveOutputState] = useState<OutputCollectionState>(
    EMPTY_STUDIO_OUTPUT_COLLECTION_STATE
  );
  const [archivedOutputState, setArchivedOutputState] = useState<OutputCollectionState>(
    EMPTY_STUDIO_OUTPUT_COLLECTION_STATE
  );

  const activeOutputStateRef = useRef<OutputCollectionState>(EMPTY_STUDIO_OUTPUT_COLLECTION_STATE);
  const archivedOutputStateRef = useRef<OutputCollectionState>(
    EMPTY_STUDIO_OUTPUT_COLLECTION_STATE
  );
  const activeOutputByIdRef = useRef<Record<string, StudioOutput>>({});
  const activeOutputsRef = useRef<StudioOutput[]>([]);
  const archivedOutputsRef = useRef<StudioOutput[]>([]);

  const outputStorePublishQueuedRef = useRef(false);
  const outputStorePublisherUnmountedRef = useRef(false);
  const outputStorePublishEpochRef = useRef(0);
  const activeAuthorityKeyRef = useRef<string>(authorityKey);
  const stateByAuthorityKeyRef = useRef<Record<string, OutputCollectionAuthorityState>>({
    [authorityKey]: {
      active: EMPTY_STUDIO_OUTPUT_COLLECTION_STATE,
      archived: EMPTY_STUDIO_OUTPUT_COLLECTION_STATE,
    },
  });

  const outputs = useMemo(
    () => denormalizeStudioOutputCollection(activeOutputState),
    [activeOutputState]
  );
  const archivedOutputs = useMemo(
    () => denormalizeStudioOutputCollection(archivedOutputState),
    [archivedOutputState]
  );
  const activeOutputById = useMemo(() => activeOutputState.byId, [activeOutputState.byId]);

  const syncOutputStoreSnapshot = useCallback(
    (nextActiveState: OutputCollectionState, nextArchivedState: OutputCollectionState) => {
      activeOutputStateRef.current = nextActiveState;
      archivedOutputStateRef.current = nextArchivedState;
      stateByAuthorityKeyRef.current[activeAuthorityKeyRef.current] = {
        active: nextActiveState,
        archived: nextArchivedState,
      };
      if (outputStorePublishQueuedRef.current) return;
      outputStorePublishQueuedRef.current = true;
      const publishEpoch = outputStorePublishEpochRef.current;
      const scheduleFlush =
        typeof queueMicrotask === "function"
          ? queueMicrotask
          : (task: () => void) => Promise.resolve().then(task);
      scheduleFlush(() => {
        outputStorePublishQueuedRef.current = false;
        if (publishEpoch !== outputStorePublishEpochRef.current) return;
        if (outputStorePublisherUnmountedRef.current) return;
        const latestActiveState = activeOutputStateRef.current;
        const latestArchivedState = archivedOutputStateRef.current;
        setAiStudioOutputStoreSnapshot({
          outputOrder: latestActiveState.order,
          outputById: latestActiveState.byId,
          archivedOutputOrder: latestArchivedState.order,
          archivedOutputById: latestArchivedState.byId,
        });
      });
    },
    []
  );

  const setOutputsState = useCallback<Dispatch<SetStateAction<StudioOutput[]>>>((nextValue) => {
    setActiveOutputState((prevState) => {
      const prevRows =
        activeOutputStateRef.current === prevState
          ? activeOutputsRef.current
          : denormalizeStudioOutputCollection(prevState);
      const resolved = typeof nextValue === "function" ? nextValue(prevRows) : nextValue;
      const normalized = normalizeActiveRows(resolved);
      const nextState = normalized.state;
      if (areStudioOutputCollectionStatesEqual(prevState, nextState)) {
        activeOutputStateRef.current = prevState;
        activeOutputsRef.current = prevRows;
        return prevState;
      }
      activeOutputStateRef.current = nextState;
      activeOutputsRef.current = normalized.rows;
      return nextState;
    });
  }, []);

  const setArchivedOutputs = useCallback<Dispatch<SetStateAction<StudioOutput[]>>>((nextValue) => {
    void nextValue;
    setArchivedOutputState((prevState) => {
      const nextState = EMPTY_STUDIO_OUTPUT_COLLECTION_STATE;
      if (areStudioOutputCollectionStatesEqual(prevState, nextState)) {
        archivedOutputStateRef.current = prevState;
        archivedOutputsRef.current = [];
        return prevState;
      }
      archivedOutputStateRef.current = nextState;
      archivedOutputsRef.current = [];
      return nextState;
    });
  }, []);

  const setOutputCollectionsForAuthority = useCallback(
    (targetAuthorityKey: string, activeRows: StudioOutput[], archivedRows: StudioOutput[]) => {
      void archivedRows;
      const nextActive = normalizeActiveRows(activeRows);
      const nextActiveState = nextActive.state;
      const nextArchivedRows: StudioOutput[] = [];
      const nextArchivedState = EMPTY_STUDIO_OUTPUT_COLLECTION_STATE;
      stateByAuthorityKeyRef.current[targetAuthorityKey] = {
        active: nextActiveState,
        archived: nextArchivedState,
      };
      if (activeAuthorityKeyRef.current !== targetAuthorityKey) return;

      activeOutputStateRef.current = nextActiveState;
      archivedOutputStateRef.current = nextArchivedState;
      activeOutputByIdRef.current = nextActiveState.byId;
      activeOutputsRef.current = nextActive.rows;
      archivedOutputsRef.current = nextArchivedRows;
      setActiveOutputState(nextActiveState);
      setArchivedOutputState(nextArchivedState);
      setAiStudioOutputStoreSnapshot({
        outputOrder: nextActiveState.order,
        outputById: nextActiveState.byId,
        archivedOutputOrder: nextArchivedState.order,
        archivedOutputById: nextArchivedState.byId,
      });
    },
    []
  );

  useEffect(() => {
    activeOutputByIdRef.current = activeOutputById;
  }, [activeOutputById]);

  useEffect(() => {
    activeOutputsRef.current = outputs;
    archivedOutputsRef.current = archivedOutputs;
  }, [archivedOutputs, outputs]);

  useEffect(() => {
    activeOutputStateRef.current = activeOutputState;
    archivedOutputStateRef.current = archivedOutputState;
    // Sync external selector store after commit in a passive effect.
    // Publishing from layout effects can create nested sync update loops when
    // selector subscribers schedule immediate re-renders during the same commit.
    syncOutputStoreSnapshot(activeOutputState, archivedOutputState);
  }, [activeOutputState, archivedOutputState, syncOutputStoreSnapshot]);

  useEffect(() => {
    // React StrictMode mounts, cleans up, and re-runs effects in development.
    // Re-arm the publisher on each mount so decoupled selector consumers continue receiving updates.
    outputStorePublisherUnmountedRef.current = false;
    outputStorePublishQueuedRef.current = false;
    outputStorePublishEpochRef.current += 1;
    return () => {
      outputStorePublisherUnmountedRef.current = true;
      outputStorePublishQueuedRef.current = false;
      outputStorePublishEpochRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (activeAuthorityKeyRef.current === authorityKey) return;
    stateByAuthorityKeyRef.current[activeAuthorityKeyRef.current] = {
      active: activeOutputStateRef.current,
      archived: archivedOutputStateRef.current,
    };
    activeAuthorityKeyRef.current = authorityKey;
    outputStorePublishQueuedRef.current = false;
    outputStorePublishEpochRef.current += 1;
    const restoredState = stateByAuthorityKeyRef.current[authorityKey] ?? {
      active: EMPTY_STUDIO_OUTPUT_COLLECTION_STATE,
      archived: EMPTY_STUDIO_OUTPUT_COLLECTION_STATE,
    };
    const nextState = {
      active: restoredState.active,
      archived: EMPTY_STUDIO_OUTPUT_COLLECTION_STATE,
    };
    stateByAuthorityKeyRef.current[authorityKey] = nextState;
    activeOutputStateRef.current = nextState.active;
    archivedOutputStateRef.current = nextState.archived;
    activeOutputByIdRef.current = nextState.active.byId;
    activeOutputsRef.current = denormalizeStudioOutputCollection(nextState.active);
    archivedOutputsRef.current = [];
    /* eslint-disable react-hooks/set-state-in-effect -- authority switches must restore the selected collection immediately after React commits the new key. */
    setActiveOutputState(nextState.active);
    setArchivedOutputState(nextState.archived);
    /* eslint-enable react-hooks/set-state-in-effect */
    setAiStudioOutputStoreSnapshot({
      outputOrder: nextState.active.order,
      outputById: nextState.active.byId,
      archivedOutputOrder: nextState.archived.order,
      archivedOutputById: nextState.archived.byId,
    });
  }, [authorityKey]);

  return {
    activeOutputState,
    setActiveOutputState,
    archivedOutputState,
    setArchivedOutputState,
    activeOutputStateRef,
    archivedOutputStateRef,
    activeOutputByIdRef,
    outputs,
    archivedOutputs,
    activeOutputById,
    setOutputsState,
    setArchivedOutputs,
    setOutputCollectionsForAuthority,
  };
};
