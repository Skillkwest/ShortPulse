import React from "react";

import type { ExpertEditLayer } from "./expertEditLayerSessionUtils";
import { resolveImageDimensionsFromUrl } from "./expertEditPanelViewContract";

type LayerImageDimensionCache = Record<
  string,
  { url: string; width: number; height: number; isRenderable: boolean }
>;

type UseExpertEditLayerImageDimensionRuntimeParams = {
  layers: ExpertEditLayer[];
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
        if (
          current &&
          current.url === url &&
          current.width === dimensions.width &&
          current.height === dimensions.height
        ) {
          return previousCache;
        }
        return {
          ...previousCache,
          [layerId]: {
            url,
            width: dimensions.width,
            height: dimensions.height,
            isRenderable: true,
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
      if (!layer.imageUrl) return false;
      const cached = layerImageDimensionCache[layer.id];
      return !cached || cached.url !== layer.imageUrl;
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
              current.height === dimensions.height
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
