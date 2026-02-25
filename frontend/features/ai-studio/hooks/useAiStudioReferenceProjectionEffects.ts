import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  pruneCuratedReferenceIds,
  syncCuratedPinnedOutputsByOrder,
} from "../logic/curatedReferences";
import {
  applyAllRefsSuppressionCompatibility,
  pruneReferenceProjectionState,
  type ReferenceProjectionState,
} from "../reference-projections";
import type { StudioOutput } from "../types";
import type { StudioOutputCollectionState } from "../reference-domain";

type UseAiStudioReferenceProjectionEffectsArgs = {
  referenceProjectionState: ReferenceProjectionState;
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  referenceProjectionStateRef: MutableRefObject<ReferenceProjectionState>;
  activeOutputOrder: string[];
  archivedOutputOrder: string[];
  curatedReferenceIds: string[];
  setActiveOutputState: Dispatch<SetStateAction<StudioOutputCollectionState>>;
  setArchivedOutputState: Dispatch<SetStateAction<StudioOutputCollectionState>>;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
};

export const useAiStudioReferenceProjectionEffects = ({
  referenceProjectionState,
  setReferenceProjectionState,
  referenceProjectionStateRef,
  activeOutputOrder,
  archivedOutputOrder,
  curatedReferenceIds,
  setActiveOutputState,
  setArchivedOutputState,
  setOutputs,
}: UseAiStudioReferenceProjectionEffectsArgs) => {
  useEffect(() => {
    referenceProjectionStateRef.current = referenceProjectionState;
  }, [referenceProjectionState, referenceProjectionStateRef]);

  useEffect(() => {
    const validOutputIds = [...activeOutputOrder, ...archivedOutputOrder];
    // Keep projection ids aligned with output lifecycle transitions (active + archived stores).
    // Guard with a deterministic no-op check to prevent render loops from redundant state commits.
    const nextQuickSlotIds = pruneCuratedReferenceIds(
      referenceProjectionState.quickSlotIds,
      validOutputIds
    );
    const withPrunedQuickSlots =
      nextQuickSlotIds === referenceProjectionState.quickSlotIds
        ? referenceProjectionState
        : {
            ...referenceProjectionState,
            quickSlotIds: nextQuickSlotIds,
          };
    const nextProjectionState = pruneReferenceProjectionState(withPrunedQuickSlots, validOutputIds);
    if (nextProjectionState === referenceProjectionState) return;
    setReferenceProjectionState(nextProjectionState);
  }, [
    activeOutputOrder,
    archivedOutputOrder,
    referenceProjectionState,
    setReferenceProjectionState,
  ]);

  useEffect(() => {
    const syncPinnedState = (
      prevState: StudioOutputCollectionState
    ): StudioOutputCollectionState => {
      const nextById = syncCuratedPinnedOutputsByOrder(
        prevState.order,
        prevState.byId,
        curatedReferenceIds
      );
      if (nextById === prevState.byId) return prevState;
      return {
        order: prevState.order,
        byId: nextById,
      };
    };
    setActiveOutputState(syncPinnedState);
    setArchivedOutputState(syncPinnedState);
  }, [curatedReferenceIds, setActiveOutputState, setArchivedOutputState]);

  useEffect(() => {
    setOutputs((prev) => applyAllRefsSuppressionCompatibility(prev, referenceProjectionState));
  }, [referenceProjectionState, setOutputs]);
};
