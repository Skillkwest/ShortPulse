/**
 * Stable prop bridge for high-frequency Canvas panel updates.
 * Keeps the rail Canvas contract referentially stable for right-rail memo boundaries
 * while letting the Canvas renderer subscribe to the latest camera and drag state.
 */
import { useEffect, useLayoutEffect, useState } from "react";
import type {
  CanvasPropertiesPanelLivePropsStore,
  CanvasPropertiesPanelProps,
} from "./canvasWorkspaceContracts";

type CanvasPropertiesPanelLivePropsStoreInternal = CanvasPropertiesPanelLivePropsStore & {
  publish: (nextSnapshot: CanvasPropertiesPanelProps) => void;
};

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

const createLivePropsStore = (
  initialSnapshot: CanvasPropertiesPanelProps
): CanvasPropertiesPanelLivePropsStoreInternal => {
  const listeners = new Set<() => void>();
  let snapshot = initialSnapshot;

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    publish: (nextSnapshot) => {
      if (Object.is(snapshot, nextSnapshot)) return;
      snapshot = nextSnapshot;
      listeners.forEach((listener) => listener());
    },
  };
};

/**
 * Returns a stable Canvas panel prop object whose store publishes fresh props.
 */
export const useCanvasPropertiesPanelLivePropsBridge = (
  props: CanvasPropertiesPanelProps
): CanvasPropertiesPanelProps => {
  const [store] = useState<CanvasPropertiesPanelLivePropsStoreInternal>(() =>
    createLivePropsStore(props)
  );
  const [stableProps] = useState<CanvasPropertiesPanelProps>(() => ({
    ...props,
    livePropsStore: store,
  }));

  useIsomorphicLayoutEffect(() => {
    store.publish({
      ...props,
      livePropsStore: store,
    });
  }, [props, store]);

  return stableProps;
};
