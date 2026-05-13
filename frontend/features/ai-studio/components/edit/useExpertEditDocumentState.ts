import React from "react";

import { clampLayerOpacity, defaultLayerTransform } from "./expertEditLayerTransformUtils";
import {
  formatLayerName,
  isExpertEditImageUrl,
  isLayerIndexInBounds,
  layerHasImage,
  LAYER_OPACITY_DEFAULT,
  resolveLayerIndexOrFallback,
  resolveLayersAfterContextMenuRemoveImage,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";
import type { ExpertEditLayerSessionState } from "./expertEditSessionState";
import { useExpertEditLayerInteractionRuntime } from "./useExpertEditLayerInteractionRuntime";
import { useExpertEditLayerImageDimensionRuntime } from "./useExpertEditLayerImageDimensionRuntime";
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
  const [foundationLayerId, setFoundationLayerId] = React.useState<string | null>(
    initialLayerState.foundationLayerId
  );
  const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(
    initialLayerState.selectedLayerIndex
  );

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

  const resolvedSelectedLayerIndex = resolveLayerIndexOrFallback({
    selectedLayerIndex,
    layerCount: layers.length,
  });
  const selectedLayer = layers[resolvedSelectedLayerIndex] ?? null;
  const selectedLayerImageUrl = isExpertEditImageUrl(selectedLayer?.imageUrl)
    ? selectedLayer.imageUrl.trim()
    : null;

  const {
    beginLayerRename,
    clearLayerEditing,
    dragOverLayerIndex,
    draggingLayerIndex,
    editingLayerIndex,
    editingLayerValue,
    handleCommitLayerRename,
    handleDeleteLayer,
    handleDeleteSelectedLayer,
    handleLayerDragEnd,
    handleLayerDragOver,
    handleLayerDragStart,
    handleLayerDrop,
    handleSelectLayer,
    setEditingLayerIndex,
    setEditingLayerValue,
  } = useExpertEditLayerInteractionRuntime({
    layers,
    foundationLayerId,
    resolvedSelectedLayerIndex,
    setLayers,
    setSelectedLayerIndex,
  });

  const populatedLayerCount = React.useMemo(
    () => layers.filter((layer) => layerHasImage(layer)).length,
    [layers]
  );
  const hasPrimaryCompositePreview = populatedLayerCount > 0;

  const { hasRenderableLayerImage, resolveLayerImageAspectRatio, seedLayerImageDimensions } =
    useExpertEditLayerImageDimensionRuntime({
      layers,
    });
  const selectedLayerHasRenderableImage = hasRenderableLayerImage(selectedLayer);

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
    seedLayerImageDimensions,
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
    selectedLayerHasRenderableImage,
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
