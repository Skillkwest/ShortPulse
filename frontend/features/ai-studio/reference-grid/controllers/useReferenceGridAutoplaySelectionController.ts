/**
 * Autoplay selection controller for Reference Grid.
 * Encapsulates visible-video prioritization and autoplay-enabled id selection policy.
 */
import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";

const areIdListsEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

type UseReferenceGridAutoplaySelectionControllerArgs = {
  activeOutputId: string | null;
  suspendAutoplaySelection?: boolean;
  videoAttachBudget: number;
  perfDegradeLevel: 0 | 1 | 2;
  runNonUrgentUpdate: (updater: () => void) => void;
  setAutoplayEnabledIds: Dispatch<SetStateAction<string[]>>;
  videoVisibleKeySetRef: MutableRefObject<Set<string>>;
  videoOutputIdByKeyRef: MutableRefObject<Map<string, string>>;
  recomputeAutoplayBudgetRef: MutableRefObject<() => void>;
  desiredVideoAttachBudgetRef: MutableRefObject<number>;
  desiredVideoAttachBudget: number;
  autoplayEnabledIdsStateRef: MutableRefObject<string[]>;
  autoplayEnabledIds: string[];
};

type UseReferenceGridAutoplaySelectionControllerResult = {
  recomputeAutoplayBudget: () => void;
};

/**
 * Returns recompute callback and syncs related runtime refs used by adjacent controllers.
 */
export const useReferenceGridAutoplaySelectionController = ({
  activeOutputId,
  suspendAutoplaySelection = false,
  videoAttachBudget,
  perfDegradeLevel,
  runNonUrgentUpdate,
  setAutoplayEnabledIds,
  videoVisibleKeySetRef,
  videoOutputIdByKeyRef,
  recomputeAutoplayBudgetRef,
  desiredVideoAttachBudgetRef,
  desiredVideoAttachBudget,
  autoplayEnabledIdsStateRef,
  autoplayEnabledIds,
}: UseReferenceGridAutoplaySelectionControllerArgs): UseReferenceGridAutoplaySelectionControllerResult => {
  const recomputeAutoplayBudget = useCallback(() => {
    if (suspendAutoplaySelection) return;
    const visibleOutputIdSet = new Set<string>();
    videoVisibleKeySetRef.current.forEach((key) => {
      const outputId = videoOutputIdByKeyRef.current.get(key);
      if (outputId) {
        visibleOutputIdSet.add(outputId);
      }
    });
    const visibleVideoIds = Array.from(visibleOutputIdSet);
    const prioritizedVideoIds =
      activeOutputId && visibleVideoIds.includes(activeOutputId)
        ? [activeOutputId, ...visibleVideoIds.filter((id) => id !== activeOutputId)]
        : visibleVideoIds;
    if (perfDegradeLevel >= 2) {
      runNonUrgentUpdate(() => {
        setAutoplayEnabledIds((prev) => (prev.length === 0 ? prev : []));
      });
      return;
    }
    const nextEnabled = prioritizedVideoIds.slice(0, Math.max(0, videoAttachBudget));
    runNonUrgentUpdate(() => {
      setAutoplayEnabledIds((prev) => (areIdListsEqual(prev, nextEnabled) ? prev : nextEnabled));
    });
  }, [
    activeOutputId,
    perfDegradeLevel,
    runNonUrgentUpdate,
    setAutoplayEnabledIds,
    suspendAutoplaySelection,
    videoAttachBudget,
    videoOutputIdByKeyRef,
    videoVisibleKeySetRef,
  ]);

  useEffect(() => {
    recomputeAutoplayBudgetRef.current = recomputeAutoplayBudget;
  }, [recomputeAutoplayBudget, recomputeAutoplayBudgetRef]);

  useEffect(() => {
    desiredVideoAttachBudgetRef.current = desiredVideoAttachBudget;
  }, [desiredVideoAttachBudget, desiredVideoAttachBudgetRef]);

  useEffect(() => {
    autoplayEnabledIdsStateRef.current = autoplayEnabledIds;
  }, [autoplayEnabledIds, autoplayEnabledIdsStateRef]);

  return {
    recomputeAutoplayBudget,
  };
};
