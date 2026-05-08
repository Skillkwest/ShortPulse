import React from "react";
import {
  resolveContainSizeForStage,
  resolveStageFlattenCameraTransform,
} from "../../logic/expertEditStageFlatten";
import { resolveSceneMappedDrawRect } from "./stageSceneGeometry";
import { analyzeMaskCanvas, type MaskLayerMeta } from "./inpaintMaskOverlay";
import type {
  ExportMaskBlobParams,
  InpaintLayerSource,
  InpaintMaskSnapshot,
} from "./inpaintMaskControllerTypes";

const MASK_ANALYSIS_THROTTLE_MS = 90;

const createMaskCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  canvas.getContext("2d", { willReadFrequently: true });
  return canvas;
};

const remapMaskCanvasToSize = ({
  source,
  target,
}: {
  source: HTMLCanvasElement;
  target: HTMLCanvasElement;
}) => {
  if (source.width <= 0 || source.height <= 0 || target.width <= 0 || target.height <= 0) {
    return;
  }
  const targetCtx = target.getContext("2d");
  if (!targetCtx) return;
  targetCtx.clearRect(0, 0, target.width, target.height);
  const drawRect = resolveSceneMappedDrawRect({
    sourceWidth: source.width,
    sourceHeight: source.height,
    targetWidth: target.width,
    targetHeight: target.height,
  });
  targetCtx.drawImage(source, drawRect.x, drawRect.y, drawRect.width, drawRect.height);
};

type UseInpaintMaskDocumentRuntimeParams = {
  maskCanvasesRef: React.RefObject<Map<string, HTMLCanvasElement>>;
  maskMetaRef: React.RefObject<Map<string, MaskLayerMeta>>;
  selectedLayerId: string | null;
  selectedLayerImageUrl: string | null;
  layerSources: InpaintLayerSource[];
  surfaceSize: {
    width: number;
    height: number;
  };
  renderOverlayNow: () => void;
  animateOverlay: () => void;
  stopOverlayAnimation: () => void;
  getIsPointerActive: () => boolean;
  shouldAnimateLasso: boolean;
};

type UseInpaintMaskDocumentRuntimeResult = {
  hasSelectedLayerMask: boolean;
  imageHasInteractiveMask: boolean;
  ensureMaskCanvasForLayer: (layerId: string) => HTMLCanvasElement;
  queueLayerAnalysis: (layerId: string, immediate?: boolean) => void;
  captureMaskSnapshot: () => InpaintMaskSnapshot;
  restoreMaskSnapshot: (snapshot: InpaintMaskSnapshot) => void;
  clearAllMasks: () => void;
  clearSelectedLayerMask: () => void;
  invertSelectedLayerMask: () => void;
  exportSelectedLayerMaskBlob: (params: ExportMaskBlobParams) => Promise<Blob | null>;
};

export const useInpaintMaskDocumentRuntime = ({
  maskCanvasesRef,
  maskMetaRef,
  selectedLayerId,
  selectedLayerImageUrl,
  layerSources,
  surfaceSize,
  renderOverlayNow,
  animateOverlay,
  stopOverlayAnimation,
  getIsPointerActive,
  shouldAnimateLasso,
}: UseInpaintMaskDocumentRuntimeParams): UseInpaintMaskDocumentRuntimeResult => {
  const layerImageSignatureRef = React.useRef<Map<string, string | null>>(new Map());
  const imageNaturalSizeCacheRef = React.useRef<Map<string, { width: number; height: number }>>(
    new Map()
  );
  const maskAnalysisTimersRef = React.useRef<Map<string, number>>(new Map());
  const [selectedImageNaturalSize, setSelectedImageNaturalSize] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [hasSelectedLayerMask, setHasSelectedLayerMask] = React.useState(false);

  const ensureMaskCanvasForLayer = React.useCallback(
    (layerId: string) => {
      const isSelectedLayer = selectedLayerId === layerId;
      const targetWidth =
        isSelectedLayer && selectedImageNaturalSize
          ? Math.max(1, Math.round(selectedImageNaturalSize.width))
          : Math.max(1, Math.round(surfaceSize.width));
      const targetHeight =
        isSelectedLayer && selectedImageNaturalSize
          ? Math.max(1, Math.round(selectedImageNaturalSize.height))
          : Math.max(1, Math.round(surfaceSize.height));
      const existing = maskCanvasesRef.current.get(layerId);
      if (existing) {
        if (existing.width === targetWidth && existing.height === targetHeight) {
          return existing;
        }
        const resized = createMaskCanvas(targetWidth, targetHeight);
        remapMaskCanvasToSize({
          source: existing,
          target: resized,
        });
        maskCanvasesRef.current.set(layerId, resized);
        maskMetaRef.current.delete(layerId);
        return resized;
      }
      const canvas = createMaskCanvas(targetWidth, targetHeight);
      maskCanvasesRef.current.set(layerId, canvas);
      return canvas;
    },
    [
      maskCanvasesRef,
      maskMetaRef,
      selectedImageNaturalSize,
      selectedLayerId,
      surfaceSize.height,
      surfaceSize.width,
    ]
  );

  const analyzeLayerMask = React.useCallback(
    (layerId: string) => {
      const canvas = maskCanvasesRef.current.get(layerId);
      if (!canvas) {
        maskMetaRef.current.delete(layerId);
        if (selectedLayerId === layerId) {
          setHasSelectedLayerMask(false);
        }
        renderOverlayNow();
        return;
      }
      const meta = analyzeMaskCanvas(canvas);
      maskMetaRef.current.set(layerId, meta);
      if (selectedLayerId === layerId) {
        setHasSelectedLayerMask(meta.hasContent);
      }
      renderOverlayNow();
      if (
        (meta.hasContent && !getIsPointerActive()) ||
        (shouldAnimateLasso && getIsPointerActive())
      ) {
        animateOverlay();
      } else {
        stopOverlayAnimation();
      }
    },
    [
      animateOverlay,
      getIsPointerActive,
      maskCanvasesRef,
      maskMetaRef,
      renderOverlayNow,
      selectedLayerId,
      shouldAnimateLasso,
      stopOverlayAnimation,
    ]
  );

  const queueLayerAnalysis = React.useCallback(
    (layerId: string, immediate = false) => {
      const existingTimer = maskAnalysisTimersRef.current.get(layerId);
      if (existingTimer != null) {
        window.clearTimeout(existingTimer);
        maskAnalysisTimersRef.current.delete(layerId);
      }
      if (immediate) {
        analyzeLayerMask(layerId);
        return;
      }
      const timerId = window.setTimeout(() => {
        maskAnalysisTimersRef.current.delete(layerId);
        analyzeLayerMask(layerId);
      }, MASK_ANALYSIS_THROTTLE_MS);
      maskAnalysisTimersRef.current.set(layerId, timerId);
    },
    [analyzeLayerMask]
  );

  React.useEffect(() => {
    if (!selectedLayerId) return;
    ensureMaskCanvasForLayer(selectedLayerId);
    queueLayerAnalysis(selectedLayerId, true);
  }, [ensureMaskCanvasForLayer, queueLayerAnalysis, selectedLayerId, selectedImageNaturalSize]);

  const captureMaskSnapshot = React.useCallback((): InpaintMaskSnapshot => {
    const layers: InpaintMaskSnapshot["layers"] = [];
    maskCanvasesRef.current.forEach((canvas, layerId) => {
      if (canvas.width <= 0 || canvas.height <= 0) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const alpha = new Uint8ClampedArray(canvas.width * canvas.height);
      let hasContent = false;
      for (let pixelIndex = 0, alphaIndex = 0; alphaIndex < alpha.length; alphaIndex += 1) {
        const alphaValue = imageData.data[pixelIndex + 3] ?? 0;
        alpha[alphaIndex] = alphaValue;
        if (alphaValue > 0) {
          hasContent = true;
        }
        pixelIndex += 4;
      }
      if (!hasContent) return;
      layers.push({
        layerId,
        width: canvas.width,
        height: canvas.height,
        alpha,
      });
    });
    layers.sort((left, right) => left.layerId.localeCompare(right.layerId));
    return { layers };
  }, [maskCanvasesRef]);

  const restoreMaskSnapshot = React.useCallback(
    (snapshot: InpaintMaskSnapshot) => {
      const activeLayerIds = new Set(layerSources.map((source) => source.id));
      const nextCanvases = new Map<string, HTMLCanvasElement>();

      layerSources.forEach((source) => {
        const sourceCanvas = ensureMaskCanvasForLayer(source.id);
        const seedCanvas = createMaskCanvas(sourceCanvas.width, sourceCanvas.height);
        nextCanvases.set(source.id, seedCanvas);
      });

      snapshot.layers.forEach((layerSnapshot) => {
        if (!activeLayerIds.has(layerSnapshot.layerId)) return;
        const canvas = createMaskCanvas(layerSnapshot.width, layerSnapshot.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const imageData = ctx.createImageData(layerSnapshot.width, layerSnapshot.height);
        for (
          let alphaIndex = 0, pixelIndex = 0;
          alphaIndex < layerSnapshot.alpha.length;
          alphaIndex += 1
        ) {
          const alphaValue = layerSnapshot.alpha[alphaIndex] ?? 0;
          imageData.data[pixelIndex] = 255;
          imageData.data[pixelIndex + 1] = 255;
          imageData.data[pixelIndex + 2] = 255;
          imageData.data[pixelIndex + 3] = alphaValue;
          pixelIndex += 4;
        }
        ctx.putImageData(imageData, 0, 0);
        nextCanvases.set(layerSnapshot.layerId, canvas);
      });

      maskCanvasesRef.current = nextCanvases;
      maskMetaRef.current.clear();
      layerSources.forEach((source) => {
        queueLayerAnalysis(source.id, true);
      });
      if (!selectedLayerId) {
        setHasSelectedLayerMask(false);
      }
      renderOverlayNow();
      animateOverlay();
    },
    [
      animateOverlay,
      ensureMaskCanvasForLayer,
      layerSources,
      maskCanvasesRef,
      maskMetaRef,
      queueLayerAnalysis,
      renderOverlayNow,
      selectedLayerId,
    ]
  );

  const clearAllMasks = React.useCallback(() => {
    const nextCanvases = new Map<string, HTMLCanvasElement>();
    layerSources.forEach((source) => {
      const sourceCanvas = ensureMaskCanvasForLayer(source.id);
      nextCanvases.set(source.id, createMaskCanvas(sourceCanvas.width, sourceCanvas.height));
    });
    maskCanvasesRef.current = nextCanvases;
    maskMetaRef.current.clear();
    setHasSelectedLayerMask(false);
    stopOverlayAnimation();
    renderOverlayNow();
  }, [
    ensureMaskCanvasForLayer,
    layerSources,
    maskCanvasesRef,
    maskMetaRef,
    renderOverlayNow,
    stopOverlayAnimation,
  ]);

  const clearLayerMask = React.useCallback(
    (layerId: string) => {
      const canvas = maskCanvasesRef.current.get(layerId);
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      queueLayerAnalysis(layerId, true);
    },
    [maskCanvasesRef, queueLayerAnalysis]
  );

  const invertLayerMask = React.useCallback(
    (layerId: string) => {
      const canvas = maskCanvasesRef.current.get(layerId);
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx || canvas.width <= 0 || canvas.height <= 0) return;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = imageData;
      for (let index = 0; index < data.length; index += 4) {
        const alpha = data[index + 3] ?? 0;
        if (alpha > 0) {
          data[index] = 0;
          data[index + 1] = 0;
          data[index + 2] = 0;
          data[index + 3] = 0;
        } else {
          data[index] = 255;
          data[index + 1] = 255;
          data[index + 2] = 255;
          data[index + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      queueLayerAnalysis(layerId, true);
    },
    [maskCanvasesRef, queueLayerAnalysis]
  );

  React.useEffect(() => {
    if (!selectedLayerImageUrl) {
      setSelectedImageNaturalSize(null);
      return;
    }
    const cached = imageNaturalSizeCacheRef.current.get(selectedLayerImageUrl);
    if (cached) {
      setSelectedImageNaturalSize(cached);
      return;
    }
    let disposed = false;
    const image = new Image();
    image.onload = () => {
      if (disposed) return;
      const naturalSize = {
        width: Math.max(1, image.naturalWidth || 1),
        height: Math.max(1, image.naturalHeight || 1),
      };
      imageNaturalSizeCacheRef.current.set(selectedLayerImageUrl, naturalSize);
      setSelectedImageNaturalSize(naturalSize);
    };
    image.onerror = () => {
      if (disposed) return;
      setSelectedImageNaturalSize(null);
    };
    image.src = selectedLayerImageUrl;
    return () => {
      disposed = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [selectedLayerImageUrl]);

  React.useEffect(() => {
    const activeLayerIds = new Set(layerSources.map((source) => source.id));
    maskCanvasesRef.current.forEach((_, layerId) => {
      if (activeLayerIds.has(layerId)) return;
      maskCanvasesRef.current.delete(layerId);
      maskMetaRef.current.delete(layerId);
      const existingTimer = maskAnalysisTimersRef.current.get(layerId);
      if (existingTimer != null) {
        window.clearTimeout(existingTimer);
        maskAnalysisTimersRef.current.delete(layerId);
      }
      layerImageSignatureRef.current.delete(layerId);
    });

    layerSources.forEach((source) => {
      const previousImageUrl = layerImageSignatureRef.current.get(source.id);
      if (previousImageUrl === source.imageUrl) return;
      layerImageSignatureRef.current.set(source.id, source.imageUrl);
      if (previousImageUrl !== undefined) {
        maskCanvasesRef.current.delete(source.id);
        maskMetaRef.current.delete(source.id);
        const existingTimer = maskAnalysisTimersRef.current.get(source.id);
        if (existingTimer != null) {
          window.clearTimeout(existingTimer);
          maskAnalysisTimersRef.current.delete(source.id);
        }
      }
    });

    if (!selectedLayerId) {
      setHasSelectedLayerMask(false);
    } else {
      setHasSelectedLayerMask(Boolean(maskMetaRef.current.get(selectedLayerId)?.hasContent));
    }
    renderOverlayNow();
  }, [layerSources, maskCanvasesRef, maskMetaRef, renderOverlayNow, selectedLayerId]);

  React.useEffect(() => {
    if (!selectedLayerId) {
      setHasSelectedLayerMask(false);
      return;
    }
    setHasSelectedLayerMask(Boolean(maskMetaRef.current.get(selectedLayerId)?.hasContent));
  }, [maskMetaRef, selectedLayerId]);

  React.useEffect(
    () => () => {
      maskAnalysisTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      maskAnalysisTimersRef.current.clear();
    },
    []
  );

  const imageHasInteractiveMask = Boolean(selectedLayerImageUrl);

  const clearSelectedLayerMask = React.useCallback(() => {
    if (!selectedLayerId) return;
    clearLayerMask(selectedLayerId);
  }, [clearLayerMask, selectedLayerId]);

  const invertSelectedLayerMask = React.useCallback(() => {
    if (!selectedLayerId || !imageHasInteractiveMask) return;
    ensureMaskCanvasForLayer(selectedLayerId);
    invertLayerMask(selectedLayerId);
  }, [ensureMaskCanvasForLayer, imageHasInteractiveMask, invertLayerMask, selectedLayerId]);

  const exportSelectedLayerMaskBlob = React.useCallback(
    async ({ targetWidth, targetHeight, mimeType = "image/png", camera }: ExportMaskBlobParams) => {
      if (!selectedLayerId) return null;
      const maskMeta = maskMetaRef.current.get(selectedLayerId);
      if (!maskMeta?.hasContent) return null;
      const maskCanvas = ensureMaskCanvasForLayer(selectedLayerId);
      const width = Math.max(1, Math.round(targetWidth));
      const height = Math.max(1, Math.round(targetHeight));
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = width;
      exportCanvas.height = height;
      const exportCtx = exportCanvas.getContext("2d");
      if (!exportCtx) return null;
      const cameraTransform = resolveStageFlattenCameraTransform({
        camera,
        outputWidth: width,
        outputHeight: height,
      });
      const containSize = resolveContainSizeForStage(
        maskCanvas.width,
        maskCanvas.height,
        width,
        height
      );

      exportCtx.fillStyle = "black";
      exportCtx.fillRect(0, 0, width, height);
      exportCtx.save();
      exportCtx.translate(
        width / 2 + cameraTransform.offsetX,
        height / 2 + cameraTransform.offsetY
      );
      if (cameraTransform.scale !== 1) {
        exportCtx.scale(cameraTransform.scale, cameraTransform.scale);
      }
      exportCtx.drawImage(
        maskCanvas,
        -containSize.drawWidth / 2,
        -containSize.drawHeight / 2,
        containSize.drawWidth,
        containSize.drawHeight
      );
      exportCtx.restore();

      return new Promise<Blob | null>((resolve) => {
        exportCanvas.toBlob(resolve, mimeType);
      });
    },
    [ensureMaskCanvasForLayer, maskMetaRef, selectedLayerId]
  );

  return {
    hasSelectedLayerMask,
    imageHasInteractiveMask,
    ensureMaskCanvasForLayer,
    queueLayerAnalysis,
    captureMaskSnapshot,
    restoreMaskSnapshot,
    clearAllMasks,
    clearSelectedLayerMask,
    invertSelectedLayerMask,
    exportSelectedLayerMaskBlob,
  };
};
