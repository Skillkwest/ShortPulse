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
  removeQuickSlotReference,
  type ReferenceProjectionState,
} from "../reference-projections";
import {
  abandonGenerationOutput,
  canAbandonGenerationOutput,
} from "../logic/generationAbandonment";
import type { StudioOutput } from "../types";

type UseAiStudioDeleteOutputControllerParams = {
  quickSlotIds: string[];
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  deleteOutputFromLifecycle: (id: string) => void;
  findOutputById: (id: string) => StudioOutput | null;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
  pendingFinalizeRemovalIdsRef: MutableRefObject<Set<string>>;
};

const shouldPersistFailedGeneratedRemoval = (output: StudioOutput | null): output is StudioOutput =>
  Boolean(
    output &&
    output.taskState === "fail" &&
    output.mediaSource === "generated" &&
    canAbandonGenerationOutput(output)
  );

/**
 * Returns AI Studio delete helpers that honor reference-grid suppression semantics.
 */
export const useAiStudioDeleteOutputController = ({
  quickSlotIds,
  setReferenceProjectionState,
  setActiveOutputId,
  deleteOutputFromLifecycle,
  findOutputById,
  updateOutputById,
  pendingFinalizeRemovalIdsRef,
}: UseAiStudioDeleteOutputControllerParams) => {
  const deleteOutput = useCallback(
    (id: string) => {
      const outputId = id.trim();
      if (!outputId) return;
      const output = findOutputById(outputId);
      if (shouldPersistFailedGeneratedRemoval(output)) {
        updateOutputById(outputId, (item) =>
          item.hiddenInReferenceGrid === true ? item : { ...item, hiddenInReferenceGrid: true }
        );
        setReferenceProjectionState((prev) => removeQuickSlotReference(prev, outputId));
        setActiveOutputId((prev) => (prev === outputId ? null : prev));
        pendingFinalizeRemovalIdsRef.current.delete(outputId);
        void abandonGenerationOutput({ output })
          .then(() => {
            deleteOutputFromLifecycle(outputId);
          })
          .catch((error) => {
            console.warn("[ai-studio] failed to persist failed-output removal", error);
          });
        return;
      }
      if (quickSlotIds.includes(outputId)) {
        setReferenceProjectionState((prev) => markReferenceRemovedFromAllRefs(prev, outputId));
        setActiveOutputId((prev) => (prev === outputId ? null : prev));
        return;
      }
      deleteOutputFromLifecycle(outputId);
    },
    [
      deleteOutputFromLifecycle,
      findOutputById,
      pendingFinalizeRemovalIdsRef,
      quickSlotIds,
      setActiveOutputId,
      setReferenceProjectionState,
      updateOutputById,
    ]
  );

  const forceDeleteOutput = useCallback(
    (id: string) => {
      const outputId = id.trim();
      if (!outputId) return;
      setReferenceProjectionState((prev) => markReferenceRemovedFromAllRefs(prev, outputId));
      setActiveOutputId((prev) => (prev === outputId ? null : prev));
      pendingFinalizeRemovalIdsRef.current.delete(outputId);
      deleteOutputFromLifecycle(outputId);
    },
    [
      deleteOutputFromLifecycle,
      pendingFinalizeRemovalIdsRef,
      setActiveOutputId,
      setReferenceProjectionState,
    ]
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
    forceDeleteOutput,
  };
};
