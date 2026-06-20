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

const REMOVE_BACKGROUND_INTENT_COALESCE_MS = 180;

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
  const removeBackgroundIntentTimeoutRef = React.useRef<number | null>(null);
  const removeBackgroundIntentRef = React.useRef<{
    layer: ExpertEditLayer | null;
    imageUrl: string;
    sourceImageUrl: string | null;
  } | null>(null);
  const isFlattenOperationInFlightRef = React.useRef(false);
  const hasRemoveBackgroundSubmissionStartedRef = React.useRef(false);
  const queuedRemoveBackgroundAfterFlattenRef = React.useRef(false);
  const latestActionStateRef = React.useRef({
    layers,
    foundationLayerId,
    selectedLayer,
    selectedLayerImageUrl,
    populatedLayerCount,
  });

  latestActionStateRef.current = {
    layers,
    foundationLayerId,
    selectedLayer,
    selectedLayerImageUrl,
    populatedLayerCount,
  };

  const clearRemoveBackgroundPending = React.useCallback(() => {
    clearWindowTimeoutRef(removeBackgroundPendingTimeoutRef);
    hasRemoveBackgroundSubmissionStartedRef.current = false;
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
      clearWindowTimeoutRef(removeBackgroundIntentTimeoutRef);
    },
    []
  );

  const clearScheduledRemoveBackgroundIntent = React.useCallback(() => {
    clearWindowTimeoutRef(removeBackgroundIntentTimeoutRef);
    removeBackgroundIntentRef.current = null;
  }, []);

  const runFlattenOperation = React.useCallback(async () => {
    const {
      layers: latestLayers,
      foundationLayerId: latestFoundationLayerId,
      populatedLayerCount: latestPopulatedLayerCount,
    } = latestActionStateRef.current;

    if (latestPopulatedLayerCount <= 0) {
      showStatusToast("Add at least one layer image before flattening.");
      return null;
    }

    try {
      const flattenSnapshot = resolveStageFlattenSnapshot();
      const exportBlob = await composePrimaryStageLayersToBlob(latestLayers, {
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
        latestLayers.find((layer) => layer.id === latestFoundationLayerId) ??
        latestLayers[0] ??
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
      latestActionStateRef.current = {
        ...latestActionStateRef.current,
        layers: [flattenedLayer],
        selectedLayer: flattenedLayer,
        selectedLayerImageUrl: flattenedLayerUrl,
        populatedLayerCount: 1,
      };
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
      return flattenedLayer;
    } catch {
      showStatusToast("Unable to flatten layers.");
      return null;
    }
  }, [
    clearLayerEditing,
    createLayer,
    layerIdCounterRef,
    queuePanelHistoryBaselineFromCurrent,
    resolveStageFlattenSnapshot,
    setLayers,
    setSelectedLayerIndex,
    onAddFlattenedReferenceImage,
    showStatusToast,
    suppressNextPrimaryPublishUrlRef,
  ]);

  const submitRemoveBackgroundForLayer = React.useCallback(
    async ({
      layer,
      imageUrl,
      sourceImageUrl,
    }: {
      layer: ExpertEditLayer | null;
      imageUrl: string;
      sourceImageUrl: string | null;
    }) => {
      const selectedLayerInput = imageUrl.trim();
      if (!selectedLayerInput) return;
      if (!onRegenerateWithReferenceInputs) return;

      beginRemoveBackgroundPending(layer?.id ?? null, sourceImageUrl);
      hasRemoveBackgroundSubmissionStartedRef.current = true;

      try {
        await onRegenerateWithReferenceInputs([selectedLayerInput], {
          modelIdOverride: BRIA_BACKGROUND_REMOVE_MODEL_ID,
          referenceInputsMode: "replace",
        });
      } catch {
        clearRemoveBackgroundPending();
        showStatusToast("Unable to remove background.");
      }
    },
    [
      beginRemoveBackgroundPending,
      clearRemoveBackgroundPending,
      onRegenerateWithReferenceInputs,
      showStatusToast,
    ]
  );

  const handleManualFlatten = React.useCallback(async () => {
    if (isFlattenOperationInFlightRef.current) return;
    if (
      hasRemoveBackgroundSubmissionStartedRef.current &&
      removeBackgroundPendingLayerId != null &&
      !removeBackgroundIntentRef.current
    ) {
      showStatusToast("Background removal is already processing.");
      return;
    }

    const shouldRemoveBackgroundAfterFlatten = removeBackgroundIntentRef.current != null;
    if (shouldRemoveBackgroundAfterFlatten) {
      clearScheduledRemoveBackgroundIntent();
      clearRemoveBackgroundPending();
      queuedRemoveBackgroundAfterFlattenRef.current = true;
    }

    isFlattenOperationInFlightRef.current = true;
    setIsFlattenPending(true);
    try {
      const flattenedLayer = await runFlattenOperation();
      if (flattenedLayer && queuedRemoveBackgroundAfterFlattenRef.current) {
        await submitRemoveBackgroundForLayer({
          layer: flattenedLayer,
          imageUrl: flattenedLayer.imageUrl ?? "",
          sourceImageUrl: flattenedLayer.imageUrl,
        });
      }
    } finally {
      queuedRemoveBackgroundAfterFlattenRef.current = false;
      isFlattenOperationInFlightRef.current = false;
      setIsFlattenPending(false);
    }
  }, [
    clearRemoveBackgroundPending,
    clearScheduledRemoveBackgroundIntent,
    removeBackgroundPendingLayerId,
    runFlattenOperation,
    showStatusToast,
    submitRemoveBackgroundForLayer,
  ]);

  const handleRemoveBackground = React.useCallback(() => {
    if (!onRegenerateWithReferenceInputs) {
      showStatusToast("Remove background is unavailable in this session.");
      return;
    }
    if (isFlattenOperationInFlightRef.current) {
      queuedRemoveBackgroundAfterFlattenRef.current = true;
      return;
    }
    if (removeBackgroundIntentRef.current || removeBackgroundPendingLayerId != null) {
      return;
    }

    const {
      selectedLayer: latestSelectedLayer,
      selectedLayerImageUrl: latestSelectedLayerImageUrl,
    } = latestActionStateRef.current;
    const selectedLayerInput = latestSelectedLayerImageUrl?.trim() ?? "";
    if (!selectedLayerInput) {
      showStatusToast("Select a layer with an image before removing background.");
      return;
    }
    removeBackgroundIntentRef.current = {
      layer: latestSelectedLayer,
      imageUrl: selectedLayerInput,
      sourceImageUrl: latestSelectedLayer?.imageUrl ?? null,
    };
    beginRemoveBackgroundPending(
      latestSelectedLayer?.id ?? null,
      latestSelectedLayer?.imageUrl ?? null
    );
    removeBackgroundIntentTimeoutRef.current = window.setTimeout(() => {
      const pendingIntent = removeBackgroundIntentRef.current;
      removeBackgroundIntentRef.current = null;
      removeBackgroundIntentTimeoutRef.current = null;
      if (!pendingIntent) return;
      void submitRemoveBackgroundForLayer(pendingIntent);
    }, REMOVE_BACKGROUND_INTENT_COALESCE_MS);
  }, [
    beginRemoveBackgroundPending,
    onRegenerateWithReferenceInputs,
    showStatusToast,
    removeBackgroundPendingLayerId,
    submitRemoveBackgroundForLayer,
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
