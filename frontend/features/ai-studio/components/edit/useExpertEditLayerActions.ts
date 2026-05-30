import React from "react";

import {
  composePrimaryStageLayersToBlob,
  type StageFlattenCameraTransformInput,
} from "../../logic/expertEditStageFlatten";
import { rememberObjectUrlBlob } from "../../utils/objectUrlBlobRegistry";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../../logic/editPromptPolicy";
import type { ExpertEditPanelViewProps } from "./expertEditPanelViewContract";
import { REMOVE_BACKGROUND_PENDING_TIMEOUT_MS } from "./expertEditPanelViewContract";
import { clearWindowTimeoutRef } from "./expertEditInteractionUtils";
import { defaultLayerTransform } from "./expertEditLayerTransformUtils";
import {
  formatLayerName,
  LAYER_OPACITY_DEFAULT,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";

type UseExpertEditLayerActionsParams = {
  layers: ExpertEditLayer[];
  foundationLayerId: string | null;
  selectedLayer: ExpertEditLayer | null;
  selectedLayerImageUrl: string | null;
  populatedLayerCount: number;
  createLayer: (args: { indexOneBased: number }) => ExpertEditLayer;
  layerIdCounterRef: React.MutableRefObject<number>;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  setSelectedLayerIndex: React.Dispatch<React.SetStateAction<number | null>>;
  clearLayerEditing: () => void;
  queuePanelHistoryBaselineFromCurrent: () => void;
  onAddFlattenedReferenceImage?: ExpertEditPanelViewProps["onAddFlattenedReferenceImage"];
  onRegenerateWithReferenceInputs?: ExpertEditPanelViewProps["onRegenerateWithReferenceInputs"];
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
  suppressNextPrimaryPublishUrlRef: React.MutableRefObject<string | null>;
  resolveStageFlattenSnapshot: () => {
    outputAspectRatio: number;
    camera?: StageFlattenCameraTransformInput | null;
  };
};

export function useExpertEditLayerActions({
  layers,
  foundationLayerId,
  selectedLayer,
  selectedLayerImageUrl,
  populatedLayerCount,
  createLayer,
  layerIdCounterRef,
  setLayers,
  setSelectedLayerIndex,
  clearLayerEditing,
  queuePanelHistoryBaselineFromCurrent,
  onAddFlattenedReferenceImage,
  onRegenerateWithReferenceInputs,
  showStatusToast,
  suppressNextPrimaryPublishUrlRef,
  resolveStageFlattenSnapshot,
}: UseExpertEditLayerActionsParams) {
  const [isFlattenPending, setIsFlattenPending] = React.useState(false);
  const [removeBackgroundPendingLayerId, setRemoveBackgroundPendingLayerId] = React.useState<
    string | null
  >(null);
  const removeBackgroundPendingTimeoutRef = React.useRef<number | null>(null);
  const removeBackgroundPendingSourceUrlRef = React.useRef<string | null>(null);

  const clearRemoveBackgroundPending = React.useCallback(() => {
    clearWindowTimeoutRef(removeBackgroundPendingTimeoutRef);
    removeBackgroundPendingSourceUrlRef.current = null;
    setRemoveBackgroundPendingLayerId(null);
  }, []);

  const beginRemoveBackgroundPending = React.useCallback(
    (layerId: string | null, sourceImageUrl: string | null) => {
      clearRemoveBackgroundPending();
      if (!layerId) return;
      setRemoveBackgroundPendingLayerId(layerId);
      removeBackgroundPendingSourceUrlRef.current = sourceImageUrl;
      removeBackgroundPendingTimeoutRef.current = window.setTimeout(() => {
        clearRemoveBackgroundPending();
      }, REMOVE_BACKGROUND_PENDING_TIMEOUT_MS);
    },
    [clearRemoveBackgroundPending]
  );

  React.useEffect(
    () => () => {
      clearWindowTimeoutRef(removeBackgroundPendingTimeoutRef);
    },
    []
  );

  const handleManualFlatten = React.useCallback(async () => {
    if (populatedLayerCount <= 0) {
      showStatusToast("Add at least one layer image before flattening.");
      return;
    }
    if (isFlattenPending) return;

    setIsFlattenPending(true);
    try {
      const flattenSnapshot = resolveStageFlattenSnapshot();
      const exportBlob = await composePrimaryStageLayersToBlob(layers, {
        mimeType: "image/png",
        outputAspectRatio: flattenSnapshot.outputAspectRatio,
        camera: flattenSnapshot.camera,
      });
      const flattenedLayerUrl = URL.createObjectURL(exportBlob);
      rememberObjectUrlBlob(flattenedLayerUrl, exportBlob);
      const flattenedReferenceGridUrl = onAddFlattenedReferenceImage
        ? URL.createObjectURL(exportBlob)
        : null;
      if (flattenedReferenceGridUrl) {
        rememberObjectUrlBlob(flattenedReferenceGridUrl, exportBlob);
      }
      const layerOne =
        layers.find((layer) => layer.id === foundationLayerId) ??
        layers[0] ??
        createLayer({ indexOneBased: layerIdCounterRef.current });
      const flattenedLayer: ExpertEditLayer = {
        ...layerOne,
        name: layerOne.isAutoNamed ? formatLayerName(1) : layerOne.name,
        isAutoNamed: layerOne.isAutoNamed,
        imageUrl: flattenedLayerUrl,
        opacity: LAYER_OPACITY_DEFAULT,
        ownsImageUrl: true,
        transform: defaultLayerTransform(),
      };
      suppressNextPrimaryPublishUrlRef.current = flattenedLayerUrl;
      queuePanelHistoryBaselineFromCurrent();
      setLayers([flattenedLayer]);
      setSelectedLayerIndex(0);
      clearLayerEditing();
      if (flattenedReferenceGridUrl) {
        try {
          onAddFlattenedReferenceImage?.({
            url: flattenedReferenceGridUrl,
            mimeType: exportBlob.type || "image/png",
          });
        } catch {
          showStatusToast(
            "Flattened layer saved to canvas, but not added to Reference Grid.",
            "warning"
          );
        }
      }
    } catch {
      showStatusToast("Unable to flatten layers.");
    } finally {
      setIsFlattenPending(false);
    }
  }, [
    clearLayerEditing,
    createLayer,
    foundationLayerId,
    isFlattenPending,
    layerIdCounterRef,
    layers,
    populatedLayerCount,
    queuePanelHistoryBaselineFromCurrent,
    resolveStageFlattenSnapshot,
    setLayers,
    setSelectedLayerIndex,
    onAddFlattenedReferenceImage,
    showStatusToast,
    suppressNextPrimaryPublishUrlRef,
  ]);

  const handleRemoveBackground = React.useCallback(() => {
    const run = async () => {
      const selectedLayerInput = selectedLayerImageUrl?.trim() ?? "";
      if (!selectedLayerInput) {
        showStatusToast("Select a layer with an image before removing background.");
        return;
      }
      if (!onRegenerateWithReferenceInputs) {
        showStatusToast("Remove background is unavailable in this session.");
        return;
      }
      const pendingLayerId = selectedLayer?.id ?? null;
      beginRemoveBackgroundPending(pendingLayerId, selectedLayer?.imageUrl ?? null);

      try {
        await onRegenerateWithReferenceInputs([selectedLayerInput], {
          modelIdOverride: BRIA_BACKGROUND_REMOVE_MODEL_ID,
          referenceInputsMode: "replace",
        });
      } catch {
        clearRemoveBackgroundPending();
        showStatusToast("Unable to remove background.");
      }
    };
    void run();
  }, [
    beginRemoveBackgroundPending,
    clearRemoveBackgroundPending,
    onRegenerateWithReferenceInputs,
    selectedLayer,
    selectedLayerImageUrl,
    showStatusToast,
  ]);

  return {
    isFlattenPending,
    removeBackgroundPendingLayerId,
    removeBackgroundPendingSourceUrlRef,
    clearRemoveBackgroundPending,
    handleManualFlatten,
    handleRemoveBackground,
  };
}
