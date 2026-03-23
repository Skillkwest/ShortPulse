/**
 * Right-rail duplicate-surface ownership controller for Reference Grid.
 * Centralizes which output ids should prefer Quick Slot over All Refs for visible and hydration work.
 */
import { useMemo } from "react";
import type { StudioOutput } from "../../types";

type UseReferenceGridSurfaceOwnershipControllerArgs = {
  visibleCuratedOutputs: StudioOutput[];
  nearViewportCuratedOutputs: StudioOutput[];
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
  visibleCuratedOutputs,
  nearViewportCuratedOutputs,
  quickSlotAdaptiveSurfaceEnabled,
}: UseReferenceGridSurfaceOwnershipControllerArgs): UseReferenceGridSurfaceOwnershipControllerResult => {
  const visibleQuickSlotIdSet = useMemo(
    () => new Set(visibleCuratedOutputs.map((item) => item.id)),
    [visibleCuratedOutputs]
  );

  const hydrationQuickSlotPreferredIdSet = useMemo(() => {
    if (!quickSlotAdaptiveSurfaceEnabled) {
      return visibleQuickSlotIdSet;
    }
    const nextPreferredIdSet = new Set(visibleQuickSlotIdSet);
    nearViewportCuratedOutputs.forEach((item) => {
      nextPreferredIdSet.add(item.id);
    });
    return nextPreferredIdSet;
  }, [nearViewportCuratedOutputs, quickSlotAdaptiveSurfaceEnabled, visibleQuickSlotIdSet]);

  return {
    visibleQuickSlotIdSet,
    hydrationQuickSlotPreferredIdSet,
  };
};
