/**
 * AI Studio delete-output controller.
 * Preserves quick-slot suppression semantics while finalizing true deletions once references are fully detached.
 */
import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  markReferenceRemovedFromAllRefs,
  type ReferenceProjectionState,
} from "../reference-projections";

type UseAiStudioDeleteOutputControllerParams = {
  quickSlotIds: string[];
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  deleteOutputFromLifecycle: (id: string) => void;
  pendingFinalizeRemovalIdsRef: MutableRefObject<Set<string>>;
};

/**
 * Returns AI Studio delete helpers that honor reference-grid suppression semantics.
 */
export const useAiStudioDeleteOutputController = ({
  quickSlotIds,
  setReferenceProjectionState,
  setActiveOutputId,
  deleteOutputFromLifecycle,
  pendingFinalizeRemovalIdsRef,
}: UseAiStudioDeleteOutputControllerParams) => {
  const deleteOutput = useCallback(
    (id: string) => {
      const outputId = id.trim();
      if (!outputId) return;
      if (quickSlotIds.includes(outputId)) {
        setReferenceProjectionState((prev) => markReferenceRemovedFromAllRefs(prev, outputId));
        setActiveOutputId((prev) => (prev === outputId ? null : prev));
        return;
      }
      deleteOutputFromLifecycle(outputId);
    },
    [deleteOutputFromLifecycle, quickSlotIds, setActiveOutputId, setReferenceProjectionState]
  );

  useEffect(() => {
    if (pendingFinalizeRemovalIdsRef.current.size === 0) return;
    const quickSlotIdSet = new Set(quickSlotIds);
    const readyToFinalize = [...pendingFinalizeRemovalIdsRef.current].filter(
      (candidateId) => !quickSlotIdSet.has(candidateId)
    );
    if (!readyToFinalize.length) return;
    readyToFinalize.forEach((candidateId) =>
      pendingFinalizeRemovalIdsRef.current.delete(candidateId)
    );
    readyToFinalize.forEach((candidateId) => {
      deleteOutputFromLifecycle(candidateId);
    });
  }, [deleteOutputFromLifecycle, pendingFinalizeRemovalIdsRef, quickSlotIds]);

  return {
    deleteOutput,
  };
};
