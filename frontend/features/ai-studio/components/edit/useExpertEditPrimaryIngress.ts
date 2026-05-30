import React from "react";
import type { ResolveInternalReferenceDrop } from "../../logic/referenceSource/internalReferenceSource";
import {
  prepareLocalImageBlobForEditIngress,
  prepareLocalImageFileForEditIngress,
} from "../../logic/editImageIngress";
import {
  readRememberedObjectUrlBlob,
  rememberObjectUrlBlob,
} from "../../utils/objectUrlBlobRegistry";
import {
  extractDragDropPayload,
  extractInternalReferenceDragPayload,
  isImageDragTransfer,
  looksLikeImageUrl,
} from "../../utils/dragDrop";
import { MAX_LAYERS } from "./expertEditPanelViewContract";
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
  queuePanelHistoryBaselineFromCurrent: () => void;
  setLayers: React.Dispatch<React.SetStateAction<ExpertEditLayer[]>>;
  setSelectedLayerIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingLayerIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingLayerValue: React.Dispatch<React.SetStateAction<string>>;
  revokeObjectUrlSafe: (url: string) => void;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  resolveInternalReferenceImageDropSource?: ResolveInternalReferenceDrop;
  seedLayerImageDimensions?: (
    layerId: string,
    url: string,
    dimensions: { width: number; height: number }
  ) => void;
};

export function useExpertEditPrimaryIngress({
  layers,
  selectedLayerIndex,
  foundationLayerId,
  isMorePresetsSurfaceOpen,
  createLayer,
  queuePanelHistoryBaselineFromCurrent,
  setLayers,
  setSelectedLayerIndex,
  setEditingLayerIndex,
  setEditingLayerValue,
  revokeObjectUrlSafe,
  resolvePreviewUrlById,
  resolveInternalReferenceImageDropSource,
  seedLayerImageDimensions,
}: UseExpertEditPrimaryIngressArgs) {
  const [primaryDragActive, setPrimaryDragActive] = React.useState(false);
  const layersRef = React.useRef(layers);
  const selectedLayerIndexRef = React.useRef(selectedLayerIndex);
  const foundationLayerIdRef = React.useRef(foundationLayerId);
  const isMorePresetsSurfaceOpenRef = React.useRef(isMorePresetsSurfaceOpen);
  const resolvePreviewUrlByIdRef = React.useRef(resolvePreviewUrlById);
  const resolveInternalReferenceImageDropSourceRef = React.useRef(
    resolveInternalReferenceImageDropSource
  );

  React.useLayoutEffect(() => {
    layersRef.current = layers;
    selectedLayerIndexRef.current = selectedLayerIndex;
    foundationLayerIdRef.current = foundationLayerId;
    isMorePresetsSurfaceOpenRef.current = isMorePresetsSurfaceOpen;
    resolvePreviewUrlByIdRef.current = resolvePreviewUrlById;
    resolveInternalReferenceImageDropSourceRef.current = resolveInternalReferenceImageDropSource;
  }, [
    foundationLayerId,
    isMorePresetsSurfaceOpen,
    layers,
    resolveInternalReferenceImageDropSource,
    resolvePreviewUrlById,
    selectedLayerIndex,
  ]);

  const clearPrimaryDragActive = React.useCallback(() => {
    setPrimaryDragActive(false);
  }, []);

  const applyPrimaryImageIngress = React.useCallback(
    (payload: {
      url: string;
      ownsImageUrl: boolean;
      dimensions?: { width?: number; height?: number };
    }) => {
      const candidateUrl = payload.url.trim();
      if (!candidateUrl) {
        if (payload.ownsImageUrl && payload.url.startsWith("blob:")) {
          revokeObjectUrlSafe(payload.url);
        }
        return;
      }
      const seededDimensions =
        typeof payload.dimensions?.width === "number" &&
        payload.dimensions.width > 0 &&
        typeof payload.dimensions.height === "number" &&
        payload.dimensions.height > 0
          ? {
              width: payload.dimensions.width,
              height: payload.dimensions.height,
            }
          : null;

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
      const populatedLayerCount = currentLayers.filter((layer) => layerHasImage(layer)).length;
      const hasAnyPopulatedLayer = populatedLayerCount > 0;
      if (!hasAnyPopulatedLayer && foundationLayer) {
        const nextLayers = [...currentLayers];
        nextLayers[foundationIndex] = {
          ...foundationLayer,
          imageUrl: candidateUrl,
          ownsImageUrl: payload.ownsImageUrl,
          opacity: LAYER_OPACITY_DEFAULT,
          transform: defaultLayerTransform(),
        };
        queuePanelHistoryBaselineFromCurrent();
        setLayers(nextLayers);
        if (seededDimensions) {
          seedLayerImageDimensions?.(foundationLayer.id, candidateUrl, seededDimensions);
        }
        setSelectedLayerIndex(foundationIndex);
        setEditingLayerIndex(null);
        setEditingLayerValue("");
        return;
      }

      if (!layerHasImage(targetLayer)) {
        const nextLayers = [...currentLayers];
        nextLayers[targetIndex] = {
          ...targetLayer,
          imageUrl: candidateUrl,
          ownsImageUrl: payload.ownsImageUrl,
          opacity: LAYER_OPACITY_DEFAULT,
          transform: defaultLayerTransform(),
        };
        const normalizedLayers = enforceLayerStackInvariants({
          layers: nextLayers,
          foundationLayerId: currentFoundationLayerId,
        });
        queuePanelHistoryBaselineFromCurrent();
        setLayers(normalizedLayers);
        if (seededDimensions) {
          seedLayerImageDimensions?.(targetLayer.id, candidateUrl, seededDimensions);
        }
        const normalizedTargetIndex = normalizedLayers.findIndex(
          (layer) => layer.id === targetLayer.id
        );
        setSelectedLayerIndex(normalizedTargetIndex >= 0 ? normalizedTargetIndex : 0);
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
      queuePanelHistoryBaselineFromCurrent();
      setLayers(nextLayers);
      if (seededDimensions) {
        seedLayerImageDimensions?.(insertedLayer.id, candidateUrl, seededDimensions);
      }
      const insertedIndex = nextLayers.findIndex((layer) => layer.id === insertedLayer.id);
      setSelectedLayerIndex(insertedIndex >= 0 ? insertedIndex : 0);
      setEditingLayerIndex(null);
      setEditingLayerValue("");
    },
    [
      createLayer,
      queuePanelHistoryBaselineFromCurrent,
      revokeObjectUrlSafe,
      seedLayerImageDimensions,
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
      if (!file.type.startsWith("image/")) {
        event.target.value = "";
        return;
      }
      void (async () => {
        const prepared = await prepareLocalImageFileForEditIngress(file);
        rememberObjectUrlBlob(prepared.url, prepared.blob);
        applyPrimaryImageIngress({ url: prepared.url, ownsImageUrl: true });
      })();
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
      const internalPayload = extractInternalReferenceDragPayload(event.dataTransfer);
      const { imageUrl, imageFile, fromFile, referenceId, width, height, mediaKind } =
        extractDragDropPayload(event.dataTransfer);
      void (async () => {
        const effectiveMediaKind = internalPayload?.mediaKind ?? mediaKind ?? null;
        if (effectiveMediaKind && effectiveMediaKind !== "image") return;

        const resolvedInternalSource =
          internalPayload && resolveInternalReferenceImageDropSourceRef.current
            ? await resolveInternalReferenceImageDropSourceRef
                .current(internalPayload)
                .catch(() => null)
            : null;
        if (
          internalPayload &&
          resolveInternalReferenceImageDropSourceRef.current &&
          !resolvedInternalSource
        ) {
          return;
        }

        let nextUrl = imageUrl;
        if (resolvedInternalSource) {
          nextUrl =
            resolvedInternalSource.preparedImageUrl?.trim() ||
            resolvedInternalSource.preview.url?.trim() ||
            null;
        }
        const resolvePreview = resolvePreviewUrlByIdRef.current;
        const hasInternalResolver = Boolean(resolveInternalReferenceImageDropSourceRef.current);
        if (
          (!internalPayload || !hasInternalResolver) &&
          (!nextUrl || nextUrl.startsWith("blob:")) &&
          referenceId &&
          resolvePreview
        ) {
          nextUrl = resolvePreview(referenceId);
        }
        if (!nextUrl) return;
        if (!looksLikeImageUrl(nextUrl)) return;
        const isBlobUrl = nextUrl.startsWith("blob:");
        const canAcceptBlob =
          fromFile || Boolean(referenceId) || resolvedInternalSource?.sourceKind === "local_file";
        if (isBlobUrl && !canAcceptBlob) return;
        let ownsImageUrl = false;
        if (isBlobUrl && fromFile && imageFile instanceof File) {
          const prepared = await prepareLocalImageFileForEditIngress(imageFile);
          if (prepared.url !== nextUrl) {
            URL.revokeObjectURL(nextUrl);
          }
          nextUrl = prepared.url;
          rememberObjectUrlBlob(nextUrl, prepared.blob);
          ownsImageUrl = true;
        } else if (isBlobUrl) {
          if (resolvedInternalSource?.sourceKind === "local_file") {
            const localBlob = await resolvedInternalSource.loadBlob().catch(() => null);
            if (!(localBlob instanceof Blob) || localBlob.size <= 0) return;
            const prepared = await prepareLocalImageBlobForEditIngress(localBlob);
            nextUrl = prepared.url;
            rememberObjectUrlBlob(nextUrl, prepared.blob);
            ownsImageUrl = true;
          } else {
            const rememberedBlob = readRememberedObjectUrlBlob(nextUrl);
            const sourceBlobData =
              rememberedBlob ??
              (await fetch(nextUrl)
                .then((response) => (response.ok ? response.blob() : null))
                .catch(() => null));
            if (!(sourceBlobData instanceof Blob) || sourceBlobData.size <= 0) return;
            const prepared = await prepareLocalImageBlobForEditIngress(sourceBlobData);
            nextUrl = prepared.url;
            rememberObjectUrlBlob(nextUrl, prepared.blob);
            ownsImageUrl = true;
          }
        }
        applyPrimaryImageIngress({
          url: nextUrl,
          ownsImageUrl,
          dimensions: { width, height },
        });
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
