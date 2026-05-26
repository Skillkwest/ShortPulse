import React from "react";

import { isKeyboardEventFromEditableTarget } from "./expertEditInteractionUtils";
import {
  formatLayerName,
  isAutoLayerName,
  isLayerIndexInBounds,
  isLayerReorderDrag,
  LAYER_REORDER_DRAG_MIME,
  resolveLayerReorderFromIndex,
  resolveLayerStateAfterDelete,
  resolveLowestUnusedAutoLayerNumber,
  resolveReorderedLayerState,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";

type UseExpertEditLayerInteractionRuntimeParams = {
  layers: ExpertEditLayer[];
  foundationLayerId: string | null;
  resolvedSelectedLayerIndex: number;
  queuePanelHistoryBaselineFromCurrent: () => void;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  setSelectedLayerIndex: React.Dispatch<React.SetStateAction<number | null>>;
};

export function useExpertEditLayerInteractionRuntime({
  layers,
  foundationLayerId,
  resolvedSelectedLayerIndex,
  queuePanelHistoryBaselineFromCurrent,
  setLayers,
  setSelectedLayerIndex,
}: UseExpertEditLayerInteractionRuntimeParams) {
  const [editingLayerIndex, setEditingLayerIndex] = React.useState<number | null>(null);
  const [editingLayerValue, setEditingLayerValue] = React.useState("");
  const [draggingLayerIndex, setDraggingLayerIndex] = React.useState<number | null>(null);
  const [dragOverLayerIndex, setDragOverLayerIndex] = React.useState<number | null>(null);
  const draggingLayerIndexRef = React.useRef<number | null>(null);

  const clearLayerEditing = React.useCallback(() => {
    setEditingLayerIndex(null);
    setEditingLayerValue("");
  }, []);

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
      queuePanelHistoryBaselineFromCurrent();
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
    [
      editingLayerIndex,
      layers,
      queuePanelHistoryBaselineFromCurrent,
      resolvedSelectedLayerIndex,
      setLayers,
      setSelectedLayerIndex,
    ]
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
      queuePanelHistoryBaselineFromCurrent();
      setLayers(nextLayerState.normalizedLayers);
      clearLayerEditing();
      setEditingLayerIndex(nextLayerState.nextEditingLayerIndex);
      setSelectedLayerIndex(nextLayerState.nextSelectedLayerIndex);
    },
    [
      clearLayerEditing,
      editingLayerIndex,
      foundationLayerId,
      layers,
      queuePanelHistoryBaselineFromCurrent,
      resolvedSelectedLayerIndex,
      setLayers,
      setSelectedLayerIndex,
    ]
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
        queuePanelHistoryBaselineFromCurrent();
        setLayers(nextLayers);
      }
      clearLayerEditing();
    },
    [clearLayerEditing, editingLayerValue, layers, queuePanelHistoryBaselineFromCurrent, setLayers]
  );

  const beginLayerRename = React.useCallback((index: number, value: string) => {
    setEditingLayerIndex(index);
    setEditingLayerValue(value);
  }, []);

  const handleSelectLayer = React.useCallback(
    (index: number) => {
      setSelectedLayerIndex(index);
    },
    [setSelectedLayerIndex]
  );

  return {
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
  };
}
