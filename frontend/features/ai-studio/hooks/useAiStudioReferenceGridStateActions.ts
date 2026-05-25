/**
 * Reference-grid state action bundle for AI Studio.
 * Encapsulates archive/restore and curated projection actions.
 */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { logMediaPerf } from "../../../lib/mediaPerfTelemetry";
import type { StudioOutput } from "../types";
import {
  addQuickSlotReference,
  clearQuickSlotReferences,
  removeQuickSlotReference,
  reorderQuickSlotReference,
  shouldFinalizeRemovalOnQuickSlotDetach,
  type ReferenceProjectionState,
} from "../reference-projections";

type UseAiStudioReferenceGridStateActionsArgs = {
  outputsLength: number;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  pendingFinalizeRemovalIdsRef: MutableRefObject<Set<string>>;
};

type UseAiStudioReferenceGridStateActionsResult = {
  restoreArchivedOutput: (outputId: string) => void;
  restoreAllArchivedOutputs: () => void;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  addCuratedReference: (id: string) => void;
  removeCuratedReference: (id: string) => void;
  reorderCuratedReference: (
    id: string,
    targetId: string | null,
    placement: "before" | "after" | "end"
  ) => void;
  clearCuratedReferences: () => void;
  resetReferenceGridState: () => void;
};

export const useAiStudioReferenceGridStateActions = ({
  outputsLength,
  setActiveOutputId,
  setOutputsState,
  setArchivedOutputs,
  setReferenceProjectionState,
  pendingFinalizeRemovalIdsRef,
}: UseAiStudioReferenceGridStateActionsArgs): UseAiStudioReferenceGridStateActionsResult => {
  const restoreArchivedOutput = useCallback(
    (outputId: string) => {
      setArchivedOutputs((prev) => {
        const target = prev.find((item) => item.id === outputId) ?? null;
        if (!target) return prev;
        setOutputsState((current) => [
          {
            ...target,
            archivedAt: null,
            archiveReason: null,
          },
          ...current,
        ]);
        setActiveOutputId(target.id);
        logMediaPerf("media.grid.archive.transition", {
          surface: "reference-grid",
          restored_count: 1,
          active_count_hint: outputsLength + 1,
          archived_count_hint: Math.max(0, prev.length - 1),
        });
        return target ? prev.filter((item) => item.id !== outputId) : prev;
      });
    },
    [outputsLength, setActiveOutputId, setArchivedOutputs, setOutputsState]
  );

  const restoreAllArchivedOutputs = useCallback(() => {
    let moved: StudioOutput[] = [];
    setArchivedOutputs((prev) => {
      moved = prev;
      return [];
    });
    if (!moved.length) return;
    setOutputsState((prev) => [
      ...moved.map((item) => ({
        ...item,
        archivedAt: null,
        archiveReason: null,
      })),
      ...prev,
    ]);
    logMediaPerf("media.grid.archive.transition", {
      surface: "reference-grid",
      restored_count: moved.length,
      active_count_hint: outputsLength + moved.length,
      archived_count_hint: 0,
    });
  }, [outputsLength, setArchivedOutputs, setOutputsState]);

  const setOutputs = useCallback<Dispatch<SetStateAction<StudioOutput[]>>>(
    (nextValue) => {
      setOutputsState(nextValue);
    },
    [setOutputsState]
  );

  const addCuratedReference = useCallback(
    (id: string) => {
      setReferenceProjectionState((prev) => addQuickSlotReference(prev, id));
    },
    [setReferenceProjectionState]
  );

  const removeCuratedReference = useCallback(
    (id: string) => {
      setReferenceProjectionState((prev) => {
        if (shouldFinalizeRemovalOnQuickSlotDetach(prev, id)) {
          pendingFinalizeRemovalIdsRef.current.add(id);
        }
        return removeQuickSlotReference(prev, id);
      });
    },
    [pendingFinalizeRemovalIdsRef, setReferenceProjectionState]
  );

  const reorderCuratedReference = useCallback(
    (id: string, targetId: string | null, placement: "before" | "after" | "end") => {
      setReferenceProjectionState((prev) =>
        reorderQuickSlotReference(prev, id, targetId, placement)
      );
    },
    [setReferenceProjectionState]
  );

  const clearCuratedReferences = useCallback(() => {
    setReferenceProjectionState((prev) => {
      prev.removedFromAllRefsIds.forEach((id) => {
        pendingFinalizeRemovalIdsRef.current.add(id);
      });
      return clearQuickSlotReferences(prev);
    });
  }, [pendingFinalizeRemovalIdsRef, setReferenceProjectionState]);

  const resetReferenceGridState = useCallback(() => {
    setOutputsState([]);
    setArchivedOutputs([]);
    setActiveOutputId(null);
    clearCuratedReferences();
  }, [clearCuratedReferences, setActiveOutputId, setArchivedOutputs, setOutputsState]);

  return {
    restoreArchivedOutput,
    restoreAllArchivedOutputs,
    setOutputs,
    addCuratedReference,
    removeCuratedReference,
    reorderCuratedReference,
    clearCuratedReferences,
    resetReferenceGridState,
  };
};
