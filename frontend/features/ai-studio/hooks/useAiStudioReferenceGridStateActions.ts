/**
 * Reference-grid state action bundle for AI Studio.
 * Encapsulates archive/restore limits and curated projection actions.
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
  activeOutputId: string | null;
  outputsLength: number;
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  pendingFinalizeRemovalIdsRef: MutableRefObject<Set<string>>;
  config: {
    softArchiveEnabled: boolean;
    activeLimit: number;
    archivePreviewKeepCount: number;
    defaultActiveLimit: number;
  };
};

type UseAiStudioReferenceGridStateActionsResult = {
  archiveOlderOutputs: (activeRows: StudioOutput[]) => StudioOutput[];
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

const toIsoNow = () => new Date().toISOString();

export const useAiStudioReferenceGridStateActions = ({
  activeOutputId,
  outputsLength,
  setActiveOutputId,
  setOutputsState,
  setArchivedOutputs,
  setReferenceProjectionState,
  pendingFinalizeRemovalIdsRef,
  config,
}: UseAiStudioReferenceGridStateActionsArgs): UseAiStudioReferenceGridStateActionsResult => {
  const compactArchivedOutputs = useCallback(
    (rows: StudioOutput[]): StudioOutput[] => {
      if (!rows.length) return rows;
      const keepCount = Math.max(0, config.archivePreviewKeepCount);
      if (rows.length <= keepCount) return rows;
      let changed = false;
      const next = rows.map((item, index) => {
        if (index < keepCount) return item;
        if (!item.previewUrl && !item.localObjectUrl) return item;
        changed = true;
        return {
          ...item,
          previewUrl: undefined,
          localObjectUrl: null,
          archiveReason: item.archiveReason ?? "cleanup",
        };
      });
      return changed ? next : rows;
    },
    [config.archivePreviewKeepCount]
  );

  const archiveOlderOutputs = useCallback(
    (activeRows: StudioOutput[]): StudioOutput[] => {
      const activeLimit = Number.isFinite(config.activeLimit)
        ? Math.max(20, config.activeLimit)
        : config.defaultActiveLimit;
      if (!config.softArchiveEnabled || activeRows.length <= activeLimit) {
        return activeRows;
      }
      const nextActive: StudioOutput[] = [];
      const newlyArchived: StudioOutput[] = [];
      activeRows.forEach((item, index) => {
        const canArchive =
          index >= activeLimit &&
          item.id !== activeOutputId &&
          !item.pinned &&
          item.taskState !== "pending" &&
          item.taskState !== "running";
        if (!canArchive) {
          nextActive.push(item);
          return;
        }
        newlyArchived.push({
          ...item,
          archivedAt: item.archivedAt ?? toIsoNow(),
          archiveReason: item.archiveReason ?? "soft_limit",
        });
      });
      if (!newlyArchived.length) return activeRows;
      setArchivedOutputs((prev) => compactArchivedOutputs([...newlyArchived, ...prev]));
      logMediaPerf("media.grid.archive.transition", {
        surface: "reference-grid",
        archived_count: newlyArchived.length,
        active_count: nextActive.length,
      });
      return nextActive;
    },
    [
      activeOutputId,
      compactArchivedOutputs,
      config.activeLimit,
      config.defaultActiveLimit,
      config.softArchiveEnabled,
      setArchivedOutputs,
    ]
  );

  const restoreArchivedOutput = useCallback(
    (outputId: string) => {
      setArchivedOutputs((prev) => {
        const target = prev.find((item) => item.id === outputId) ?? null;
        if (!target) return prev;
        setOutputsState((current) =>
          archiveOlderOutputs([
            {
              ...target,
              archivedAt: null,
              archiveReason: null,
            },
            ...current,
          ])
        );
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
    [archiveOlderOutputs, outputsLength, setActiveOutputId, setArchivedOutputs, setOutputsState]
  );

  const restoreAllArchivedOutputs = useCallback(() => {
    let moved: StudioOutput[] = [];
    setArchivedOutputs((prev) => {
      moved = prev;
      return [];
    });
    if (!moved.length) return;
    setOutputsState((prev) =>
      archiveOlderOutputs([
        ...moved.map((item) => ({
          ...item,
          archivedAt: null,
          archiveReason: null,
        })),
        ...prev,
      ])
    );
    logMediaPerf("media.grid.archive.transition", {
      surface: "reference-grid",
      restored_count: moved.length,
      active_count_hint: outputsLength + moved.length,
      archived_count_hint: 0,
    });
  }, [archiveOlderOutputs, outputsLength, setArchivedOutputs, setOutputsState]);

  const setOutputs = useCallback<Dispatch<SetStateAction<StudioOutput[]>>>(
    (nextValue) => {
      setOutputsState((prev) => {
        const resolved = typeof nextValue === "function" ? nextValue(prev) : nextValue;
        return archiveOlderOutputs(resolved);
      });
    },
    [archiveOlderOutputs, setOutputsState]
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
    archiveOlderOutputs,
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
