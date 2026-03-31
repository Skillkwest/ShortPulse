/**
 * Right-rail duplicate-surface ownership controller for Reference Grid.
 * Centralizes which output ids should prefer Quick Slot over All Refs for visible and hydration work.
 */
import { useMemo } from "react";

type UseReferenceGridSurfaceOwnershipControllerArgs = {
  visibleCuratedOutputIds: string[];
  nearViewportCuratedOutputIds: string[];
  quickSlotAdaptiveSurfaceEnabled: boolean;
};

type UseReferenceGridSurfaceOwnershipControllerResult = {
  visibleQuickSlotIdSet: Set<string>;
  hydrationQuickSlotPreferredIdSet: Set<string>;
};

/**
 * Returns memoized Quick Slot ownership sets for visible duplicates and hydration scheduling.
 */
export const useReferenceGridSurfaceOwnershipController = ({
  visibleCuratedOutputIds,
  nearViewportCuratedOutputIds,
  quickSlotAdaptiveSurfaceEnabled,
}: UseReferenceGridSurfaceOwnershipControllerArgs): UseReferenceGridSurfaceOwnershipControllerResult => {
  const visibleQuickSlotIdSet = useMemo(
    () => new Set(visibleCuratedOutputIds),
    [visibleCuratedOutputIds]
  );

  const hydrationQuickSlotPreferredIdSet = useMemo(() => {
    if (!quickSlotAdaptiveSurfaceEnabled) {
      return visibleQuickSlotIdSet;
    }
    const nextPreferredIdSet = new Set(visibleQuickSlotIdSet);
    nearViewportCuratedOutputIds.forEach((id) => {
      nextPreferredIdSet.add(id);
    });
    return nextPreferredIdSet;
  }, [nearViewportCuratedOutputIds, quickSlotAdaptiveSurfaceEnabled, visibleQuickSlotIdSet]);

  return {
    visibleQuickSlotIdSet,
    hydrationQuickSlotPreferredIdSet,
  };
};
