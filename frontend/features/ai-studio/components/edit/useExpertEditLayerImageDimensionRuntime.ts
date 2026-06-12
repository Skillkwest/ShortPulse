import React from "react";

import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";
import { resolveImageDimensionsFromUrl } from "./expertEditPanelViewContract";

export type LayerImageDimensionCacheEntry = {
  url: string;
  width: number;
  height: number;
  isRenderable: boolean;
  source: "seed" | "probe";
};

type LayerImageDimensionCache = Record<string, LayerImageDimensionCacheEntry>;

type UseExpertEditLayerImageDimensionRuntimeParams = {
  layers: ExpertEditLayer[];
};

export const shouldApplySeededLayerImageDimensions = ({
  current,
  url,
  dimensions,
}: {
  current: LayerImageDimensionCacheEntry | undefined;
  url: string;
  dimensions: { width: number; height: number };
}): boolean => {
  if (!current || current.url !== url) return true;
  if (current.source === "probe") return false;
  return current.width !== dimensions.width || current.height !== dimensions.height;
};

export const shouldProbeLayerImageDimensions = ({
  imageUrl,
  cached,
}: {
  imageUrl: string | null | undefined;
  cached: LayerImageDimensionCacheEntry | undefined;
}): boolean => {
  if (!imageUrl) return false;
  return !cached || cached.url !== imageUrl || cached.source !== "probe";
};

export function useExpertEditLayerImageDimensionRuntime({
  layers,
}: UseExpertEditLayerImageDimensionRuntimeParams) {
  const [layerImageDimensionCache, setLayerImageDimensionCache] =
    React.useState<LayerImageDimensionCache>({});

  const seedLayerImageDimensions = React.useCallback(
    (layerId: string, url: string, dimensions: { width: number; height: number }) => {
      if (!(dimensions.width > 0) || !(dimensions.height > 0)) return;
      setLayerImageDimensionCache((previousCache) => {
        const current = previousCache[layerId];
        if (!shouldApplySeededLayerImageDimensions({ current, url, dimensions })) {
          return previousCache;
        }
        return {
          ...previousCache,
          [layerId]: {
            url,
            width: dimensions.width,
            height: dimensions.height,
            isRenderable: true,
            source: "seed",
          },
        };
      });
    },
    []
  );

  React.useEffect(() => {
    setLayerImageDimensionCache((previousCache) => {
      let didChange = false;
      const nextCache: LayerImageDimensionCache = {};
      layers.forEach((layer) => {
        if (!layer.imageUrl) return;
        const cached = previousCache[layer.id];
        if (!cached || cached.url !== layer.imageUrl) {
          didChange = true;
          return;
        }
        nextCache[layer.id] = cached;
      });
      if (!didChange && Object.keys(previousCache).length === Object.keys(nextCache).length) {
        return previousCache;
      }
      return nextCache;
    });
  }, [layers]);

  React.useEffect(() => {
    const pendingLayers = layers.filter((layer) => {
      const cached = layerImageDimensionCache[layer.id];
      return shouldProbeLayerImageDimensions({
        imageUrl: layer.imageUrl,
        cached,
      });
    });
    if (pendingLayers.length <= 0) return;

    let isCancelled = false;
    pendingLayers.forEach((layer) => {
      const imageUrl = layer.imageUrl;
      if (!imageUrl) return;
      void resolveImageDimensionsFromUrl(imageUrl)
        .then((dimensions) => {
          if (isCancelled) return;
          setLayerImageDimensionCache((previousCache) => {
            const current = previousCache[layer.id];
            if (
              current &&
              current.url === imageUrl &&
              current.width === dimensions.width &&
              current.height === dimensions.height &&
              current.source === "probe"
            ) {
              return previousCache;
            }
            return {
              ...previousCache,
              [layer.id]: {
                url: imageUrl,
                width: dimensions.width,
                height: dimensions.height,
                isRenderable: true,
                source: "probe",
              },
            };
          });
        })
        .catch(() => {
          if (isCancelled) return;
          setLayerImageDimensionCache((previousCache) => {
            const current = previousCache[layer.id];
            if (current && current.url === imageUrl) {
              return previousCache;
            }
            return {
              ...previousCache,
              [layer.id]: {
                url: imageUrl,
                width: 1,
                height: 1,
                isRenderable: false,
                source: "probe",
              },
            };
          });
        });
    });

    return () => {
      isCancelled = true;
    };
  }, [layerImageDimensionCache, layers]);

  const resolveLayerImageAspectRatio = React.useCallback(
    (layer: ExpertEditLayer | null) => {
      if (!layer?.imageUrl) return 1;
      const dimensions = layerImageDimensionCache[layer.id];
      if (
        !dimensions ||
        dimensions.url !== layer.imageUrl ||
        !dimensions.isRenderable ||
        dimensions.height <= 0
      ) {
        return 1;
      }
      return Math.max(0.0001, dimensions.width / dimensions.height);
    },
    [layerImageDimensionCache]
  );

  const hasRenderableLayerImage = React.useCallback(
    (layer: ExpertEditLayer | null) => {
      if (!layer?.imageUrl) return false;
      const dimensions = layerImageDimensionCache[layer.id];
      return Boolean(dimensions && dimensions.url === layer.imageUrl && dimensions.isRenderable);
    },
    [layerImageDimensionCache]
  );

  return {
    hasRenderableLayerImage,
    resolveLayerImageAspectRatio,
    seedLayerImageDimensions,
  };
}
