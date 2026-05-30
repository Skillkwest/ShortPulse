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
  pruneReferenceProjectionState,
  removeQuickSlotReference,
  reorderQuickSlotReference,
  shouldFinalizeRemovalOnQuickSlotDetach,
  type ReferenceProjectionState,
} from "../reference-projections";

type UseAiStudioReferenceGridStateActionsArgs = {
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
  outputsLength: number;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  pendingFinalizeRemovalIdsRef: MutableRefObject<Set<string>>;
};

export type DeletedMediaReferenceTarget = {
  mediaId: string;
  storagePath?: string | null;
  previewStoragePath?: string | null;
  previewPosterStoragePath?: string | null;
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
    placement: "start" | "before" | "after" | "end"
  ) => void;
  removeReferencesForDeletedMedia: (targets: DeletedMediaReferenceTarget[]) => void;
  clearCuratedReferences: () => void;
  resetReferenceGridState: () => void;
};

const normalizeId = (value: string | null | undefined): string =>
  typeof value === "string" ? value.trim() : "";

const collectNormalizedStoragePaths = (target: DeletedMediaReferenceTarget): string[] =>
  [target.storagePath, target.previewStoragePath, target.previewPosterStoragePath]
    .map((value) => normalizeId(value))
    .filter(Boolean);

const outputReferencesDeletedMedia = (
  output: StudioOutput,
  deletedMediaIds: Set<string>,
  deletedStoragePaths: Set<string>
): boolean => {
  if (output.savedMediaIds?.some((mediaId) => deletedMediaIds.has(normalizeId(mediaId)))) {
    return true;
  }
  return [
    output.previewStoragePath,
    output.fullStoragePath,
    output.previewPosterStoragePath,
    output.companionArtStoragePath,
  ].some((storagePath) => deletedStoragePaths.has(normalizeId(storagePath)));
};

export const useAiStudioReferenceGridStateActions = ({
  outputs,
  archivedOutputs,
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
    (id: string, targetId: string | null, placement: "start" | "before" | "after" | "end") => {
      setReferenceProjectionState((prev) =>
        reorderQuickSlotReference(prev, id, targetId, placement)
      );
    },
    [setReferenceProjectionState]
  );

  const removeReferencesForDeletedMedia = useCallback(
    (targets: DeletedMediaReferenceTarget[]) => {
      const deletedMediaIds = new Set(
        targets.map((target) => normalizeId(target.mediaId)).filter(Boolean)
      );
      const deletedStoragePaths = new Set(
        targets.flatMap((target) => collectNormalizedStoragePaths(target))
      );
      if (!deletedMediaIds.size && !deletedStoragePaths.size) return;

      const removedOutputIds = new Set(
        outputs
          .filter((output) =>
            outputReferencesDeletedMedia(output, deletedMediaIds, deletedStoragePaths)
          )
          .map((output) => output.id)
      );
      archivedOutputs.forEach((output) => {
        if (outputReferencesDeletedMedia(output, deletedMediaIds, deletedStoragePaths)) {
          removedOutputIds.add(output.id);
        }
      });
      if (!removedOutputIds.size) return;

      const nextOutputs = outputs.filter((output) => !removedOutputIds.has(output.id));
      const nextArchivedOutputs = archivedOutputs.filter(
        (output) => !removedOutputIds.has(output.id)
      );

      removedOutputIds.forEach((id) => {
        pendingFinalizeRemovalIdsRef.current.delete(id);
      });

      setOutputsState(nextOutputs);
      setArchivedOutputs(nextArchivedOutputs);
      setReferenceProjectionState((prev) =>
        pruneReferenceProjectionState(
          prev,
          nextOutputs.map((output) => output.id)
        )
      );
      setActiveOutputId((current) => (current && removedOutputIds.has(current) ? null : current));
    },
    [
      archivedOutputs,
      outputs,
      pendingFinalizeRemovalIdsRef,
      setActiveOutputId,
      setArchivedOutputs,
      setOutputsState,
      setReferenceProjectionState,
    ]
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
    removeReferencesForDeletedMedia,
    clearCuratedReferences,
    resetReferenceGridState,
  };
};
