/**
 * Loaded-media controller for Reference Grid cards.
 * Keeps media loaded bookkeeping and callback fan-out out of ReferenceGrid render composition.
 */
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { incrementFreezeInvestigationCounter } from "../../logic/freezeInvestigationTelemetry";

type UseReferenceGridLoadedMediaControllerArgs = {
  loadedIdsRef: MutableRefObject<Set<string>>;
  setLoadedMap: Dispatch<SetStateAction<Record<string, boolean>>>;
  runNonUrgentUpdate: (updater: () => void) => void;
  onOutputMediaLoaded?: (id: string) => void;
  stabilizeLoadingVisual?: boolean;
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
  stabilizeLoadingVisual = false,
}: UseReferenceGridLoadedMediaControllerArgs): UseReferenceGridLoadedMediaControllerResult => {
  const pendingAnimationFrameIdsRef = useRef<number[]>([]);
  const flushLoadedMapForId = useCallback(
    (id: string) => {
      runNonUrgentUpdate(() => {
        setLoadedMap((prev) => {
          if (prev[id]) return prev;
          incrementFreezeInvestigationCounter("referenceGrid.loadedMap.commit");
          return { ...prev, [id]: true };
        });
      });
    },
    [runNonUrgentUpdate, setLoadedMap]
  );
  const scheduleLoadedMapCommit = useCallback(
    (id: string) => {
      if (!stabilizeLoadingVisual) {
        flushLoadedMapForId(id);
        return;
      }
      if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
        flushLoadedMapForId(id);
        return;
      }
      // Commit loaded-map state after two paint frames so the loading overlay exits cleanly.
      const firstFrameId = window.requestAnimationFrame(() => {
        pendingAnimationFrameIdsRef.current = pendingAnimationFrameIdsRef.current.filter(
          (frameId) => frameId !== firstFrameId
        );
        const secondFrameId = window.requestAnimationFrame(() => {
          pendingAnimationFrameIdsRef.current = pendingAnimationFrameIdsRef.current.filter(
            (frameId) => frameId !== secondFrameId
          );
          flushLoadedMapForId(id);
        });
        pendingAnimationFrameIdsRef.current.push(secondFrameId);
      });
      pendingAnimationFrameIdsRef.current.push(firstFrameId);
    },
    [flushLoadedMapForId, stabilizeLoadingVisual]
  );
  const markLoaded = useCallback(
    (id: string, options?: { notifyAutoSave?: boolean }) => {
      const shouldNotify = options?.notifyAutoSave ?? true;
      if (loadedIdsRef.current.has(id)) return;
      loadedIdsRef.current.add(id);
      scheduleLoadedMapCommit(id);
      if (shouldNotify) {
        onOutputMediaLoaded?.(id);
      }
    },
    [loadedIdsRef, onOutputMediaLoaded, scheduleLoadedMapCommit]
  );
  useEffect(
    () => () => {
      if (typeof window === "undefined" || typeof window.cancelAnimationFrame !== "function")
        return;
      pendingAnimationFrameIdsRef.current.forEach((frameId) => {
        window.cancelAnimationFrame(frameId);
      });
      pendingAnimationFrameIdsRef.current = [];
    },
    []
  );

  return {
    markLoaded,
  };
};
