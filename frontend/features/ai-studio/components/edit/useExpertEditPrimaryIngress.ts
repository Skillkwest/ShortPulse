import React from "react";
import { extractDragDropPayload, isImageDragTransfer } from "../../utils/dragDrop";
import { MAX_LAYERS, LAYER_LIMIT_REACHED_TOAST } from "./expertEditPanelViewContract";
import { cloneBlobObjectUrl } from "./expertEditPanelUtilities";
import {
  LAYER_OPACITY_DEFAULT,
  enforceLayerStackInvariants,
  layerHasImage,
  resolveLayerIndexOrFallback,
  resolveLowestUnusedAutoLayerNumber,
  type ExpertEditLayer,
} from "./expertEditLayerSessionUtils";
import { defaultLayerTransform } from "./expertEditLayerTransformUtils";

type CreateLayer = (args: {
  indexOneBased: number;
  imageUrl?: string | null;
  name?: string;
  opacity?: number;
  isAutoNamed?: boolean;
  ownsImageUrl?: boolean;
}) => ExpertEditLayer;

type UseExpertEditPrimaryIngressArgs = {
  layers: ExpertEditLayer[];
  selectedLayerIndex: number | null;
  foundationLayerId: string | null;
  isMorePresetsSurfaceOpen: boolean;
  createLayer: CreateLayer;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  setSelectedLayerIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingLayerIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingLayerValue: React.Dispatch<React.SetStateAction<string>>;
  showStatusToast: (message: string, tone?: "info" | "warning") => void;
  revokeObjectUrlSafe: (url: string) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
};

export function useExpertEditPrimaryIngress({
  layers,
  selectedLayerIndex,
  foundationLayerId,
  isMorePresetsSurfaceOpen,
  createLayer,
  setLayers,
  setSelectedLayerIndex,
  setEditingLayerIndex,
  setEditingLayerValue,
  showStatusToast,
  revokeObjectUrlSafe,
  resolvePreviewUrlById,
}: UseExpertEditPrimaryIngressArgs) {
  const [primaryDragActive, setPrimaryDragActive] = React.useState(false);

  const clearPrimaryDragActive = React.useCallback(() => {
    setPrimaryDragActive(false);
  }, []);

  const applyPrimaryImageIngress = React.useCallback(
    (payload: { url: string; ownsImageUrl: boolean }) => {
      const candidateUrl = payload.url.trim();
      if (!candidateUrl) {
        if (payload.ownsImageUrl && payload.url.startsWith("blob:")) {
          revokeObjectUrlSafe(payload.url);
        }
        return;
      }

      const targetIndex = resolveLayerIndexOrFallback({
        selectedLayerIndex,
        layerCount: layers.length,
      });
      const targetLayer = layers[targetIndex];
      if (!targetLayer) return;

      const foundationIndex = foundationLayerId
        ? layers.findIndex((layer) => layer.id === foundationLayerId)
        : -1;
      const foundationLayer = foundationIndex >= 0 ? layers[foundationIndex] : null;
      const hasAnyPopulatedLayer = layers.some((layer) => layerHasImage(layer));
      if (!hasAnyPopulatedLayer && foundationLayer) {
        const nextLayers = [...layers];
        nextLayers[foundationIndex] = {
          ...foundationLayer,
          imageUrl: candidateUrl,
          ownsImageUrl: payload.ownsImageUrl,
          opacity: LAYER_OPACITY_DEFAULT,
          transform: defaultLayerTransform(),
        };
        setLayers(nextLayers);
        setSelectedLayerIndex(foundationIndex);
        setEditingLayerIndex(null);
        setEditingLayerValue("");
        return;
      }

      if (layers.length >= MAX_LAYERS) {
        if (payload.ownsImageUrl && candidateUrl.startsWith("blob:")) {
          revokeObjectUrlSafe(candidateUrl);
        }
        showStatusToast(LAYER_LIMIT_REACHED_TOAST);
        return;
      }

      const insertedLayer = createLayer({
        indexOneBased: resolveLowestUnusedAutoLayerNumber({ layers }),
        imageUrl: candidateUrl,
        ownsImageUrl: payload.ownsImageUrl,
      });
      const nextLayers = enforceLayerStackInvariants({
        layers: [...layers.slice(0, targetIndex), insertedLayer, ...layers.slice(targetIndex)],
        foundationLayerId,
      });
      setLayers(nextLayers);
      const insertedIndex = nextLayers.findIndex((layer) => layer.id === insertedLayer.id);
      setSelectedLayerIndex(insertedIndex >= 0 ? insertedIndex : 0);
      setEditingLayerIndex(null);
      setEditingLayerValue("");
    },
    [
      createLayer,
      foundationLayerId,
      layers,
      revokeObjectUrlSafe,
      selectedLayerIndex,
      setEditingLayerIndex,
      setEditingLayerValue,
      setLayers,
      setSelectedLayerIndex,
      showStatusToast,
    ]
  );

  const handlePrimaryFileSelection = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const objectUrl = URL.createObjectURL(file);
      applyPrimaryImageIngress({ url: objectUrl, ownsImageUrl: true });
      event.target.value = "";
    },
    [applyPrimaryImageIngress]
  );

  const allowPrimaryImageDrag = React.useCallback((event: React.DragEvent<HTMLDivElement>) => {
    if (isImageDragTransfer(event.dataTransfer)) {
      event.preventDefault();
      return true;
    }
    return false;
  }, []);

  const handlePrimaryDragEnter = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) {
        event.preventDefault();
        setPrimaryDragActive(false);
        return;
      }
      if (allowPrimaryImageDrag(event)) {
        setPrimaryDragActive(true);
      }
    },
    [allowPrimaryImageDrag, isMorePresetsSurfaceOpen]
  );

  const handlePrimaryDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) {
        event.preventDefault();
        setPrimaryDragActive(false);
        return;
      }
      if (allowPrimaryImageDrag(event)) {
        setPrimaryDragActive(true);
      }
    },
    [allowPrimaryImageDrag, isMorePresetsSurfaceOpen]
  );

  const handlePrimaryDragLeave = React.useCallback(() => {
    setPrimaryDragActive(false);
  }, []);

  const handlePrimaryDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpen) {
        event.preventDefault();
        setPrimaryDragActive(false);
        return;
      }
      event.preventDefault();
      setPrimaryDragActive(false);
      const { imageUrl, fromFile, referenceId } = extractDragDropPayload(event.dataTransfer);
      void (async () => {
        let nextUrl = imageUrl;
        if ((!nextUrl || nextUrl.startsWith("blob:")) && referenceId && resolvePreviewUrlById) {
          nextUrl = resolvePreviewUrlById(referenceId);
        }
        if (!nextUrl) return;
        const isBlobUrl = nextUrl.startsWith("blob:");
        const canAcceptBlob = fromFile || Boolean(referenceId);
        if (isBlobUrl && !canAcceptBlob) return;
        let ownsImageUrl = Boolean(fromFile && isBlobUrl);
        if (isBlobUrl && !ownsImageUrl) {
          const clonedBlobUrl = await cloneBlobObjectUrl(nextUrl);
          if (clonedBlobUrl) {
            nextUrl = clonedBlobUrl;
            ownsImageUrl = true;
          }
        }
        applyPrimaryImageIngress({ url: nextUrl, ownsImageUrl });
      })();
    },
    [applyPrimaryImageIngress, isMorePresetsSurfaceOpen, resolvePreviewUrlById]
  );

  return {
    primaryDragActive,
    clearPrimaryDragActive,
    handlePrimaryFileSelection,
    handlePrimaryDragEnter,
    handlePrimaryDragOver,
    handlePrimaryDragLeave,
    handlePrimaryDrop,
  };
}
