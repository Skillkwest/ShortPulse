/**
 * Loaded-media controller for Reference Grid cards.
 * Keeps media loaded bookkeeping and callback fan-out out of ReferenceGrid render composition.
 */
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

type UseReferenceGridLoadedMediaControllerArgs = {
  loadedIdsRef: MutableRefObject<Set<string>>;
  setLoadedMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  runNonUrgentUpdate: (updater: () => void) => void;
  onOutputMediaLoaded?: (id: string) => void;
};

type UseReferenceGridLoadedMediaControllerResult = {
  markLoaded: (id: string, options?: { notifyAutoSave?: boolean }) => void;
};

/**
 * Returns stable media-loaded marker with unchanged auto-save notification semantics.
 */
export const useReferenceGridLoadedMediaController = ({
  loadedIdsRef,
  setLoadedMap,
  runNonUrgentUpdate,
  onOutputMediaLoaded,
}: UseReferenceGridLoadedMediaControllerArgs): UseReferenceGridLoadedMediaControllerResult => {
  const markLoaded = useCallback(
    (id: string, options?: { notifyAutoSave?: boolean }) => {
      const shouldNotify = options?.notifyAutoSave ?? true;
      if (loadedIdsRef.current.has(id)) return;
      loadedIdsRef.current.add(id);
      runNonUrgentUpdate(() => {
        setLoadedMap((prev) => {
          if (prev[id]) return prev;
          return { ...prev, [id]: true };
        });
      });
      if (shouldNotify) {
        onOutputMediaLoaded?.(id);
      }
    },
    [loadedIdsRef, onOutputMediaLoaded, runNonUrgentUpdate, setLoadedMap]
  );

  return {
    markLoaded,
  };
};
