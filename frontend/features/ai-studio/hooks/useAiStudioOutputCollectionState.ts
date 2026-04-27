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
import type { StudioOutput } from "../types";
import { setAiStudioOutputStoreSnapshot } from "./aiStudioOutputStore";

type OutputCollectionState = StudioOutputCollectionState;

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
};

const publishEmptyOutputStoreSnapshot = () => {
  setAiStudioOutputStoreSnapshot({
    outputOrder: EMPTY_STUDIO_OUTPUT_COLLECTION_STATE.order,
    outputById: EMPTY_STUDIO_OUTPUT_COLLECTION_STATE.byId,
    archivedOutputOrder: EMPTY_STUDIO_OUTPUT_COLLECTION_STATE.order,
    archivedOutputById: EMPTY_STUDIO_OUTPUT_COLLECTION_STATE.byId,
  });
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

  const outputStorePublishQueuedRef = useRef(false);
  const outputStorePublisherUnmountedRef = useRef(false);
  const outputStorePublishEpochRef = useRef(0);
  const activeAuthorityKeyRef = useRef<string>(authorityKey);

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
      const prevRows = denormalizeStudioOutputCollection(prevState);
      const resolved = typeof nextValue === "function" ? nextValue(prevRows) : nextValue;
      const nextState = normalizeStudioOutputCollection(resolved);
      if (areStudioOutputCollectionStatesEqual(prevState, nextState)) {
        activeOutputStateRef.current = prevState;
        return prevState;
      }
      activeOutputStateRef.current = nextState;
      return nextState;
    });
  }, []);

  const setArchivedOutputs = useCallback<Dispatch<SetStateAction<StudioOutput[]>>>((nextValue) => {
    setArchivedOutputState((prevState) => {
      const prevRows = denormalizeStudioOutputCollection(prevState);
      const resolved = typeof nextValue === "function" ? nextValue(prevRows) : nextValue;
      const nextState = normalizeStudioOutputCollection(resolved);
      if (areStudioOutputCollectionStatesEqual(prevState, nextState)) {
        archivedOutputStateRef.current = prevState;
        return prevState;
      }
      archivedOutputStateRef.current = nextState;
      return nextState;
    });
  }, []);

  useEffect(() => {
    activeOutputByIdRef.current = activeOutputById;
  }, [activeOutputById]);

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
    activeAuthorityKeyRef.current = authorityKey;
    outputStorePublishQueuedRef.current = false;
    outputStorePublishEpochRef.current += 1;
    activeOutputStateRef.current = EMPTY_STUDIO_OUTPUT_COLLECTION_STATE;
    archivedOutputStateRef.current = EMPTY_STUDIO_OUTPUT_COLLECTION_STATE;
    activeOutputByIdRef.current = EMPTY_STUDIO_OUTPUT_COLLECTION_STATE.byId;
    setActiveOutputState(EMPTY_STUDIO_OUTPUT_COLLECTION_STATE);
    setArchivedOutputState(EMPTY_STUDIO_OUTPUT_COLLECTION_STATE);
    publishEmptyOutputStoreSnapshot();
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
  };
};
