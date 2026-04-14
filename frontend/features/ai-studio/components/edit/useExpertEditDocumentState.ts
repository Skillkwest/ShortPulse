import React from "react";

import { isKeyboardEventFromEditableTarget } from "./expertEditInteractionUtils";
import { clampLayerOpacity, defaultLayerTransform } from "./expertEditLayerTransformUtils";
import {
  formatLayerName,
  isAutoLayerName,
  isLayerIndexInBounds,
  isLayerReorderDrag,
  layerHasImage,
  LAYER_OPACITY_DEFAULT,
  LAYER_REORDER_DRAG_MIME,
  resolveLayerIndexOrFallback,
  resolveLayerReorderFromIndex,
  resolveLayersAfterContextMenuRemoveImage,
  resolveLayerStateAfterDelete,
  resolveLowestUnusedAutoLayerNumber,
  resolveReorderedLayerState,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";
import type { ExpertEditLayerSessionState } from "./expertEditSessionState";
import { resolveImageDimensionsFromUrl } from "./expertEditPanelViewContract";
import { useExpertEditPrimaryIngress } from "./useExpertEditPrimaryIngress";

type UseExpertEditDocumentStateParams = {
  initialLayerState: ExpertEditLayerSessionState;
  isMorePresetsSurfaceOpen: boolean;
  revokeObjectUrlSafe: (url: string) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
};

type CreateLayerArgs = {
  indexOneBased: number;
  imageUrl?: string | null;
  name?: string;
  opacity?: number;
  isAutoNamed?: boolean;
  ownsImageUrl?: boolean;
};

export function useExpertEditDocumentState({
  initialLayerState,
  isMorePresetsSurfaceOpen,
  revokeObjectUrlSafe,
  resolvePreviewUrlById,
}: UseExpertEditDocumentStateParams) {
  const layerIdCounterRef = React.useRef(initialLayerState.layerIdCounter);
  const [layers, setLayers] = React.useState<ExpertEditLayer[]>(() => [
    ...initialLayerState.layers,
  ]);
  const [layerImageDimensionCache, setLayerImageDimensionCache] = React.useState<
    Record<string, { url: string; width: number; height: number }>
  >({});
  const [foundationLayerId, setFoundationLayerId] = React.useState<string | null>(
    initialLayerState.foundationLayerId
  );
  const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(
    initialLayerState.selectedLayerIndex
  );
  const [editingLayerIndex, setEditingLayerIndex] = React.useState<number | null>(null);
  const [editingLayerValue, setEditingLayerValue] = React.useState("");
  const [draggingLayerIndex, setDraggingLayerIndex] = React.useState<number | null>(null);
  const [dragOverLayerIndex, setDragOverLayerIndex] = React.useState<number | null>(null);
  const draggingLayerIndexRef = React.useRef<number | null>(null);

  const createLayer = React.useCallback(
    ({
      indexOneBased,
      imageUrl,
      name,
      opacity = LAYER_OPACITY_DEFAULT,
      isAutoNamed = true,
      ownsImageUrl = false,
    }: CreateLayerArgs): ExpertEditLayer => ({
      id: `layer-${layerIdCounterRef.current++}`,
      name: name ?? formatLayerName(indexOneBased),
      imageUrl: imageUrl ?? null,
      opacity: clampLayerOpacity(opacity),
      isAutoNamed,
      ownsImageUrl,
      transform: defaultLayerTransform(),
    }),
    []
  );

  const clearLayerEditing = React.useCallback(() => {
    setEditingLayerIndex(null);
    setEditingLayerValue("");
  }, []);

  const resolvedSelectedLayerIndex = resolveLayerIndexOrFallback({
    selectedLayerIndex,
    layerCount: layers.length,
  });
  const selectedLayer = layers[resolvedSelectedLayerIndex] ?? null;
  const selectedLayerImageUrl = selectedLayer?.imageUrl ?? null;

  React.useEffect(() => {
    setLayerImageDimensionCache((previousCache) => {
      let didChange = false;
      const nextCache: Record<string, { url: string; width: number; height: number }> = {};
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
              },
            };
          });
        });
    });

    return () => {
      isCancelled = true;
    };
  }, [layerImageDimensionCache, layers]);

  const populatedLayerCount = React.useMemo(
    () => layers.filter((layer) => layerHasImage(layer)).length,
    [layers]
  );
  const hasPrimaryCompositePreview = populatedLayerCount > 0;

  const resolveLayerImageAspectRatio = React.useCallback(
    (layer: ExpertEditLayer | null) => {
      if (!layer?.imageUrl) return 1;
      const dimensions = layerImageDimensionCache[layer.id];
      if (!dimensions || dimensions.url !== layer.imageUrl || dimensions.height <= 0) {
        return 1;
      }
      return Math.max(0.0001, dimensions.width / dimensions.height);
    },
    [layerImageDimensionCache]
  );

  const hostPrimaryImageUrl = React.useMemo(
    () =>
      selectedLayerImageUrl ?? layers.find((layer) => Boolean(layer.imageUrl))?.imageUrl ?? null,
    [layers, selectedLayerImageUrl]
  );

  const {
    primaryDragActive,
    clearPrimaryDragActive,
    handlePrimaryFileSelection,
    handlePrimaryDragEnter,
    handlePrimaryDragOver,
    handlePrimaryDragLeave,
    handlePrimaryDrop,
  } = useExpertEditPrimaryIngress({
    layers,
    selectedLayerIndex,
    foundationLayerId,
    isMorePresetsSurfaceOpen,
    createLayer,
    setLayers,
    setSelectedLayerIndex,
    setEditingLayerIndex,
    setEditingLayerValue,
    revokeObjectUrlSafe,
    resolvePreviewUrlById,
  });

  const handleRemoveSelectedLayerImage = React.useCallback(() => {
    const selectedLayerId = selectedLayer?.id ?? null;
    if (!selectedLayerId) return;
    setLayers((previousLayers) =>
      resolveLayersAfterContextMenuRemoveImage({
        layers: previousLayers,
        selectedLayerId,
        foundationLayerId,
      })
    );
  }, [foundationLayerId, selectedLayer?.id]);

  const handleReorderLayers = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      const nextLayerState = resolveReorderedLayerState({
        layers,
        fromIndex,
        toIndex,
        resolvedSelectedLayerIndex,
        editingLayerIndex,
      });
      if (!nextLayerState) return;
      setLayers(nextLayerState.nextLayers);
      if (nextLayerState.nextSelectedLayerIndex !== undefined) {
        setSelectedLayerIndex(nextLayerState.nextSelectedLayerIndex);
      }
      if (nextLayerState.nextEditingLayerIndex !== undefined) {
        setEditingLayerIndex(nextLayerState.nextEditingLayerIndex);
      }
      draggingLayerIndexRef.current = null;
      setDragOverLayerIndex(null);
      setDraggingLayerIndex(null);
    },
    [editingLayerIndex, layers, resolvedSelectedLayerIndex]
  );

  const handleLayerDragStart = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      if (editingLayerIndex === index) {
        event.preventDefault();
        return;
      }
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(LAYER_REORDER_DRAG_MIME, String(index));
      draggingLayerIndexRef.current = index;
      setDraggingLayerIndex(index);
      setDragOverLayerIndex(index);
    },
    [editingLayerIndex]
  );

  const handleLayerDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      const isLayerReorderDragActive = isLayerReorderDrag({
        draggingLayerIndex: draggingLayerIndexRef.current,
        dataTransferTypes: Array.from(event.dataTransfer?.types ?? []),
      });
      if (!isLayerReorderDragActive) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      if (dragOverLayerIndex !== index) {
        setDragOverLayerIndex(index);
      }
    },
    [dragOverLayerIndex]
  );

  const handleLayerDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>, index: number) => {
      event.preventDefault();
      event.stopPropagation();
      const fromIndex = resolveLayerReorderFromIndex({
        transferIndexRaw: event.dataTransfer.getData(LAYER_REORDER_DRAG_MIME),
        draggingLayerIndexRef: draggingLayerIndexRef.current,
        draggingLayerIndex,
      });
      if (fromIndex == null) return;
      handleReorderLayers(fromIndex, index);
    },
    [draggingLayerIndex, handleReorderLayers]
  );

  const handleLayerDragEnd = React.useCallback(() => {
    draggingLayerIndexRef.current = null;
    setDraggingLayerIndex(null);
    setDragOverLayerIndex(null);
  }, []);

  const handleDeleteLayer = React.useCallback(
    (index: number) => {
      const nextLayerState = resolveLayerStateAfterDelete({
        layers,
        index,
        foundationLayerId,
        resolvedSelectedLayerIndex,
        editingLayerIndex,
      });
      if (!nextLayerState) return;
      setLayers(nextLayerState.normalizedLayers);
      clearLayerEditing();
      setEditingLayerIndex(nextLayerState.nextEditingLayerIndex);
      setSelectedLayerIndex(nextLayerState.nextSelectedLayerIndex);
    },
    [clearLayerEditing, editingLayerIndex, foundationLayerId, layers, resolvedSelectedLayerIndex]
  );

  const handleDeleteSelectedLayer = React.useCallback(() => {
    if (!isLayerIndexInBounds({ index: resolvedSelectedLayerIndex, layerCount: layers.length })) {
      return;
    }
    handleDeleteLayer(resolvedSelectedLayerIndex);
  }, [handleDeleteLayer, layers.length, resolvedSelectedLayerIndex]);

  React.useEffect(() => {
    if (!layers.length || typeof window === "undefined") return;
    const handleDeleteHotkey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isKeyboardEventFromEditableTarget(event)) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (!isLayerIndexInBounds({ index: resolvedSelectedLayerIndex, layerCount: layers.length })) {
        return;
      }
      event.preventDefault();
      handleDeleteSelectedLayer();
    };
    window.addEventListener("keydown", handleDeleteHotkey);
    return () => {
      window.removeEventListener("keydown", handleDeleteHotkey);
    };
  }, [handleDeleteSelectedLayer, layers.length, resolvedSelectedLayerIndex]);

  React.useEffect(() => {
    if (layers.length <= 0) {
      setFoundationLayerId((previous) => (previous === null ? previous : null));
      return;
    }
    const hasCurrentFoundation = foundationLayerId
      ? layers.some((layer) => layer.id === foundationLayerId)
      : false;
    const resolvedFoundationId = hasCurrentFoundation ? foundationLayerId : (layers[0]?.id ?? null);
    setFoundationLayerId((previous) =>
      previous === resolvedFoundationId ? previous : resolvedFoundationId
    );
  }, [foundationLayerId, layers]);

  React.useEffect(() => {
    if (!layers.length) {
      setSelectedLayerIndex(null);
      return;
    }
    if (!isLayerIndexInBounds({ index: selectedLayerIndex, layerCount: layers.length })) {
      setSelectedLayerIndex(0);
    }
  }, [layers.length, selectedLayerIndex]);

  const handleCommitLayerRename = React.useCallback(
    (index: number) => {
      const nextName = editingLayerValue.trim();
      if (nextName.length > 0) {
        const targetLayer = layers[index];
        if (!targetLayer) {
          clearLayerEditing();
          return;
        }
        const shouldRemainAutoNamed = isAutoLayerName(nextName);
        const mappedName = shouldRemainAutoNamed
          ? formatLayerName(
              resolveLowestUnusedAutoLayerNumber({
                layers,
                excludeLayerId: targetLayer.id,
              })
            )
          : nextName;
        const nextLayers = layers.map((layer, layerIndex) =>
          layerIndex === index
            ? {
                ...layer,
                name: mappedName,
                isAutoNamed: shouldRemainAutoNamed,
              }
            : layer
        );
        setLayers(nextLayers);
      }
      clearLayerEditing();
    },
    [clearLayerEditing, editingLayerValue, layers]
  );

  const beginLayerRename = React.useCallback((index: number, value: string) => {
    setEditingLayerIndex(index);
    setEditingLayerValue(value);
  }, []);

  const handleSelectLayer = React.useCallback((index: number) => {
    setSelectedLayerIndex(index);
  }, []);

  return {
    beginLayerRename,
    clearLayerEditing,
    clearPrimaryDragActive,
    createLayer,
    dragOverLayerIndex,
    draggingLayerIndex,
    editingLayerIndex,
    editingLayerValue,
    foundationLayerId,
    handleCommitLayerRename,
    handleDeleteLayer,
    handleDeleteSelectedLayer,
    handleLayerDragEnd,
    handleLayerDragOver,
    handleLayerDragStart,
    handleLayerDrop,
    handlePrimaryDragEnter,
    handlePrimaryDragLeave,
    handlePrimaryDragOver,
    handlePrimaryDrop,
    handlePrimaryFileSelection,
    handleRemoveSelectedLayerImage,
    handleSelectLayer,
    hasPrimaryCompositePreview,
    hostPrimaryImageUrl,
    layerIdCounterRef,
    layers,
    populatedLayerCount,
    primaryDragActive,
    resolveLayerImageAspectRatio,
    resolvedSelectedLayerIndex,
    selectedLayer,
    selectedLayerImageUrl,
    selectedLayerIndex,
    setEditingLayerValue,
    setLayers,
    setSelectedLayerIndex,
  };
}
