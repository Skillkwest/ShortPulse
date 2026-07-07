/**
 * Reference-grid state action bundle for AI Studio.
 * Encapsulates Reference Grid output and curated projection actions.
 */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
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
import {
  buildReferenceGridPartialCapMessage,
  limitReferenceGridVisibleOutputs,
} from "../reference-grid/logic/referenceGridLimits";

type UseAiStudioReferenceGridStateActionsArgs = {
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  pendingFinalizeRemovalIdsRef: MutableRefObject<Set<string>>;
  setUiError?: Dispatch<SetStateAction<string | null>>;
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
  setActiveOutputId,
  setOutputsState,
  setArchivedOutputs,
  setReferenceProjectionState,
  pendingFinalizeRemovalIdsRef,
  setUiError,
}: UseAiStudioReferenceGridStateActionsArgs): UseAiStudioReferenceGridStateActionsResult => {
  const restoreArchivedOutput = useCallback(
    (outputId: string) => {
      setArchivedOutputs((prev) => prev.filter((item) => item.id !== outputId));
    },
    [setArchivedOutputs]
  );

  const restoreAllArchivedOutputs = useCallback(() => {
    setArchivedOutputs([]);
  }, [setArchivedOutputs]);

  const setOutputs = useCallback<Dispatch<SetStateAction<StudioOutput[]>>>(
    (nextValue) => {
      setOutputsState((prev) => {
        const resolved = typeof nextValue === "function" ? nextValue(prev) : nextValue;
        const limited = limitReferenceGridVisibleOutputs(resolved);
        if (limited.trimmedCount > 0) {
          setUiError?.(buildReferenceGridPartialCapMessage(limited.trimmedCount));
        }
        return limited.rows;
      });
    },
    [setOutputsState, setUiError]
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
