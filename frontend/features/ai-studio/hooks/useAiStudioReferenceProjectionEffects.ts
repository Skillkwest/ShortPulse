import { useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import {
  pruneCuratedReferenceIds,
  syncCuratedPinnedOutputsByOrder,
} from "../logic/curatedReferences";
import {
  pruneReferenceProjectionState,
  resolveReferenceProjectionIds,
  type ReferenceProjectionState,
} from "../reference-projections";
import type { StudioOutputCollectionState } from "../reference-domain";

type UseAiStudioReferenceProjectionEffectsArgs = {
  referenceProjectionState: ReferenceProjectionState;
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  referenceProjectionStateRef: MutableRefObject<ReferenceProjectionState>;
  activeOutputState: StudioOutputCollectionState;
  archivedOutputState: StudioOutputCollectionState;
  curatedReferenceIds: string[];
  deferProjectionPrune?: boolean;
  setActiveOutputState: Dispatch<SetStateAction<StudioOutputCollectionState>>;
  setArchivedOutputState: Dispatch<SetStateAction<StudioOutputCollectionState>>;
};

const areListsEqual = (left: string[], right: string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const useAiStudioReferenceProjectionEffects = ({
  referenceProjectionState,
  setReferenceProjectionState,
  referenceProjectionStateRef,
  activeOutputState,
  archivedOutputState,
  curatedReferenceIds,
  deferProjectionPrune = false,
  setActiveOutputState,
  setArchivedOutputState,
}: UseAiStudioReferenceProjectionEffectsArgs) => {
  useEffect(() => {
    referenceProjectionStateRef.current = referenceProjectionState;
  }, [referenceProjectionState, referenceProjectionStateRef]);

  useEffect(() => {
    const activeOutputOrder = activeOutputState.order;
    const archivedOutputOrder = archivedOutputState.order;
    const validOutputIds = [...activeOutputOrder, ...archivedOutputOrder];
    const projectionOutputs = [
      ...activeOutputOrder
        .map((id) => activeOutputState.byId[id])
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
      ...archivedOutputOrder
        .map((id) => archivedOutputState.byId[id])
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    ];
    const hasProjectionStateToValidate =
      referenceProjectionState.quickSlotIds.length > 0 ||
      referenceProjectionState.removedFromAllRefsIds.length > 0;
    const hasOutputAuthorityToValidateAgainst = validOutputIds.length > 0;
    if (
      !deferProjectionPrune &&
      hasProjectionStateToValidate &&
      !hasOutputAuthorityToValidateAgainst
    ) {
      return;
    }
    const resolvedQuickSlotIds = resolveReferenceProjectionIds(
      referenceProjectionState.quickSlotIds,
      projectionOutputs,
      { preserveUnresolved: deferProjectionPrune }
    );
    const resolvedRemovedFromAllRefsIds = resolveReferenceProjectionIds(
      referenceProjectionState.removedFromAllRefsIds,
      projectionOutputs,
      { preserveUnresolved: deferProjectionPrune }
    );
    const withResolvedIds =
      areListsEqual(resolvedQuickSlotIds, referenceProjectionState.quickSlotIds) &&
      areListsEqual(resolvedRemovedFromAllRefsIds, referenceProjectionState.removedFromAllRefsIds)
        ? referenceProjectionState
        : {
            quickSlotIds: resolvedQuickSlotIds,
            removedFromAllRefsIds: resolvedRemovedFromAllRefsIds,
          };
    if (deferProjectionPrune) {
      if (withResolvedIds !== referenceProjectionState) {
        setReferenceProjectionState(withResolvedIds);
      }
      return;
    }
    // Keep projection ids aligned with output lifecycle transitions (active + archived stores).
    // Guard with a deterministic no-op check to prevent render loops from redundant state commits.
    const nextQuickSlotIds = pruneCuratedReferenceIds(withResolvedIds.quickSlotIds, validOutputIds);
    const withPrunedQuickSlots =
      nextQuickSlotIds === withResolvedIds.quickSlotIds
        ? withResolvedIds
        : {
            ...withResolvedIds,
            quickSlotIds: nextQuickSlotIds,
          };
    const nextProjectionState = pruneReferenceProjectionState(withPrunedQuickSlots, validOutputIds);
    if (nextProjectionState === referenceProjectionState) return;
    setReferenceProjectionState(nextProjectionState);
  }, [
    activeOutputState,
    archivedOutputState,
    deferProjectionPrune,
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
};
