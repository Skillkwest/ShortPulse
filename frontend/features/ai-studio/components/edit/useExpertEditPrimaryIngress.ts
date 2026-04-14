import React from "react";
import { extractDragDropPayload, isImageDragTransfer } from "../../utils/dragDrop";
import { MAX_LAYERS } from "./expertEditPanelViewContract";
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
  revokeObjectUrlSafe,
  resolvePreviewUrlById,
}: UseExpertEditPrimaryIngressArgs) {
  const [primaryDragActive, setPrimaryDragActive] = React.useState(false);
  const layersRef = React.useRef(layers);
  const selectedLayerIndexRef = React.useRef(selectedLayerIndex);
  const foundationLayerIdRef = React.useRef(foundationLayerId);
  const isMorePresetsSurfaceOpenRef = React.useRef(isMorePresetsSurfaceOpen);
  const resolvePreviewUrlByIdRef = React.useRef(resolvePreviewUrlById);

  React.useLayoutEffect(() => {
    layersRef.current = layers;
    selectedLayerIndexRef.current = selectedLayerIndex;
    foundationLayerIdRef.current = foundationLayerId;
    isMorePresetsSurfaceOpenRef.current = isMorePresetsSurfaceOpen;
    resolvePreviewUrlByIdRef.current = resolvePreviewUrlById;
  }, [
    foundationLayerId,
    isMorePresetsSurfaceOpen,
    layers,
    resolvePreviewUrlById,
    selectedLayerIndex,
  ]);

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

      const currentLayers = layersRef.current;
      const currentSelectedLayerIndex = selectedLayerIndexRef.current;
      const currentFoundationLayerId = foundationLayerIdRef.current;
      const targetIndex = resolveLayerIndexOrFallback({
        selectedLayerIndex: currentSelectedLayerIndex,
        layerCount: currentLayers.length,
      });
      const targetLayer = currentLayers[targetIndex];
      if (!targetLayer) return;

      const foundationIndex = currentFoundationLayerId
        ? currentLayers.findIndex((layer) => layer.id === currentFoundationLayerId)
        : -1;
      const foundationLayer = foundationIndex >= 0 ? currentLayers[foundationIndex] : null;
      const hasAnyPopulatedLayer = currentLayers.some((layer) => layerHasImage(layer));
      if (!hasAnyPopulatedLayer && foundationLayer) {
        const nextLayers = [...currentLayers];
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

      if (currentLayers.length >= MAX_LAYERS) {
        if (payload.ownsImageUrl && candidateUrl.startsWith("blob:")) {
          revokeObjectUrlSafe(candidateUrl);
        }
        return;
      }

      const insertedLayer = createLayer({
        indexOneBased: resolveLowestUnusedAutoLayerNumber({ layers: currentLayers }),
        imageUrl: candidateUrl,
        ownsImageUrl: payload.ownsImageUrl,
      });
      const nextLayers = enforceLayerStackInvariants({
        layers: [
          ...currentLayers.slice(0, targetIndex),
          insertedLayer,
          ...currentLayers.slice(targetIndex),
        ],
        foundationLayerId: currentFoundationLayerId,
      });
      setLayers(nextLayers);
      const insertedIndex = nextLayers.findIndex((layer) => layer.id === insertedLayer.id);
      setSelectedLayerIndex(insertedIndex >= 0 ? insertedIndex : 0);
      setEditingLayerIndex(null);
      setEditingLayerValue("");
    },
    [
      createLayer,
      revokeObjectUrlSafe,
      setEditingLayerIndex,
      setEditingLayerValue,
      setLayers,
      setSelectedLayerIndex,
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
      if (isMorePresetsSurfaceOpenRef.current) {
        event.preventDefault();
        setPrimaryDragActive(false);
        return;
      }
      if (allowPrimaryImageDrag(event)) {
        setPrimaryDragActive(true);
      }
    },
    [allowPrimaryImageDrag]
  );

  const handlePrimaryDragOver = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpenRef.current) {
        event.preventDefault();
        setPrimaryDragActive(false);
        return;
      }
      if (allowPrimaryImageDrag(event)) {
        setPrimaryDragActive(true);
      }
    },
    [allowPrimaryImageDrag]
  );

  const handlePrimaryDragLeave = React.useCallback(() => {
    setPrimaryDragActive(false);
  }, []);

  const handlePrimaryDrop = React.useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (isMorePresetsSurfaceOpenRef.current) {
        event.preventDefault();
        setPrimaryDragActive(false);
        return;
      }
      event.preventDefault();
      setPrimaryDragActive(false);
      const { imageUrl, fromFile, referenceId } = extractDragDropPayload(event.dataTransfer);
      void (async () => {
        let nextUrl = imageUrl;
        const resolvePreview = resolvePreviewUrlByIdRef.current;
        if ((!nextUrl || nextUrl.startsWith("blob:")) && referenceId && resolvePreview) {
          nextUrl = resolvePreview(referenceId);
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
    [applyPrimaryImageIngress]
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
