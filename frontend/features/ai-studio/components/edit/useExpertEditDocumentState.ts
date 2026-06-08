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
import type { ResolveInternalReferenceDrop } from "../../logic/referenceSource/internalReferenceSource";

type UseExpertEditDocumentStateParams = {
  initialLayerState: ExpertEditLayerSessionState;
  isMorePresetsSurfaceOpen: boolean;
  revokeObjectUrlSafe: (url: string) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  resolveInternalReferenceImageDropSource?: ResolveInternalReferenceDrop;
  queuePanelHistoryBaselineFromCurrent: () => void;
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
  resolveInternalReferenceImageDropSource,
  queuePanelHistoryBaselineFromCurrent,
}: UseExpertEditDocumentStateParams) {
  const layerIdCounterRef = React.useRef(initialLayerState.layerIdCounter);
  const [layerIdCounter, setLayerIdCounter] = React.useState(initialLayerState.layerIdCounter);
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
    }: CreateLayerArgs): ExpertEditLayer => {
      const nextIdCounter = layerIdCounterRef.current + 1;
      const nextLayer: ExpertEditLayer = {
        id: `layer-${layerIdCounterRef.current}`,
        name: name ?? formatLayerName(indexOneBased),
        imageUrl: imageUrl ?? null,
        opacity: clampLayerOpacity(opacity),
        isAutoNamed,
        ownsImageUrl,
        transform: defaultLayerTransform(),
      };
      layerIdCounterRef.current = nextIdCounter;
      setLayerIdCounter(nextIdCounter);
      return nextLayer;
    },
    []
  );

  const resolvedSelectedLayerIndex = resolveLayerIndexOrFallback({
    selectedLayerIndex,
    layerCount: layers.length,
  });
  const selectedLayer = layers[resolvedSelectedLayerIndex] ?? null;
  const selectedLayerImageUrl =
    isExpertEditImageUrl(selectedLayer?.imageUrl) && typeof selectedLayer?.imageUrl === "string"
      ? selectedLayer.imageUrl.trim()
      : null;

  const {
    beginLayerRename,
    clearLayerEditing,
    clearLayerDragState,
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
    queuePanelHistoryBaselineFromCurrent,
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

  const hostPrimaryImageUrl = React.useMemo(() => {
    const foundationLayer = foundationLayerId
      ? (layers.find((layer) => layer.id === foundationLayerId) ?? null)
      : null;
    return isExpertEditImageUrl(foundationLayer?.imageUrl) &&
      typeof foundationLayer?.imageUrl === "string"
      ? foundationLayer.imageUrl.trim()
      : null;
  }, [foundationLayerId, layers]);

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
    queuePanelHistoryBaselineFromCurrent,
    setLayers,
    setFoundationLayerId,
    setSelectedLayerIndex,
    setEditingLayerIndex,
    setEditingLayerValue,
    revokeObjectUrlSafe,
    resolvePreviewUrlById,
    resolveInternalReferenceImageDropSource,
    seedLayerImageDimensions,
  });

  const handleClearAllLayers = React.useCallback(() => {
    if (!layers.length) return;
    queuePanelHistoryBaselineFromCurrent();
    setLayers([]);
    setFoundationLayerId(null);
    setSelectedLayerIndex(null);
    layerIdCounterRef.current = 1;
    setLayerIdCounter(1);
    clearLayerEditing();
    clearLayerDragState();
    clearPrimaryDragActive();
  }, [
    clearLayerDragState,
    clearLayerEditing,
    clearPrimaryDragActive,
    layers.length,
    queuePanelHistoryBaselineFromCurrent,
    setLayers,
    setSelectedLayerIndex,
  ]);

  const handleRemoveSelectedLayerImage = React.useCallback(() => {
    const selectedLayerId = selectedLayer?.id ?? null;
    if (!selectedLayerId) return;
    queuePanelHistoryBaselineFromCurrent();
    setLayers((previousLayers) =>
      resolveLayersAfterContextMenuRemoveImage({
        layers: previousLayers,
        selectedLayerId,
        foundationLayerId,
      })
    );
  }, [foundationLayerId, queuePanelHistoryBaselineFromCurrent, selectedLayer?.id]);

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
      if (layerIdCounterRef.current !== 1) {
        layerIdCounterRef.current = 1;
        setLayerIdCounter(1);
      }
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
    setFoundationLayerId,
    handleCommitLayerRename,
    handleClearAllLayers,
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
    layerIdCounter,
    setLayerIdCounter,
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
