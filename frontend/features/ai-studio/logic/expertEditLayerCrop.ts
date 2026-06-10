/**
 * Expert Edit crop helpers.
 * Provides pure aspect/guide geometry plus stage-accurate active-layer crop composition.
 */
import { resolveClippedLayerTransform } from "../components/edit/expertEditLayerTransformUtils";

export type ExpertEditCropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ExpertEditLayerTransform = {
  translateXRatio?: number;
  translateYRatio?: number;
  scale?: number;
  rotationDeg?: number;
};

export type ExpertEditLayerStageDrawPlan = {
  drawWidth: number;
  drawHeight: number;
  translateX: number;
  translateY: number;
  scale: number;
  rotationDeg: number;
};

const DEFAULT_MIME_TYPE = "image/png";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const toRadians = (value: number) => (value * Math.PI) / 180;
const isCrossOriginCandidate = (url: string) =>
  url.startsWith("http://") || url.startsWith("https://");

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> =>
  new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Canvas export failed."));
          return;
        }
        resolve(blob);
      }, mimeType);
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Canvas export failed."));
    }
  });

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    if (isCrossOriginCandidate(url)) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load layer image: ${url}`));
    image.src = url;
  });

/**
 * Parses an aspect-ratio token (for example `16:9`) into a numeric ratio.
 */
export const parseAspectRatioToken = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const [widthToken, heightToken] = value.split(":");
  const width = Number(widthToken);
  const height = Number(heightToken);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return width / height;
};

/**
 * Resolves a centered max-fit crop rect for a ratio inside a stage.
 */
export const resolveCenteredAspectCropRect = ({
  stageWidth,
  stageHeight,
  aspectRatio,
}: {
  stageWidth: number;
  stageHeight: number;
  aspectRatio: number;
}): ExpertEditCropRect | null => {
  if (!(stageWidth > 0) || !(stageHeight > 0)) return null;
  if (!Number.isFinite(aspectRatio) || aspectRatio <= 0) return null;
  const widthFromHeight = stageHeight * aspectRatio;
  const heightFromWidth = stageWidth / aspectRatio;
  const width = widthFromHeight <= stageWidth ? widthFromHeight : stageWidth;
  const height = widthFromHeight <= stageWidth ? stageHeight : heightFromWidth;
  if (!(width > 0) || !(height > 0)) return null;
  return {
    x: (stageWidth - width) / 2,
    y: (stageHeight - height) / 2,
    width,
    height,
  };
};

/**
 * Builds transform-aware draw instructions for rendering a layer in stage space.
 */
export const buildExpertEditLayerStageDrawPlan = ({
  imageWidth,
  imageHeight,
  stageWidth,
  stageHeight,
  transform,
}: {
  imageWidth: number;
  imageHeight: number;
  stageWidth: number;
  stageHeight: number;
  transform?: ExpertEditLayerTransform | null;
}): ExpertEditLayerStageDrawPlan | null => {
  if (!(imageWidth > 0) || !(imageHeight > 0)) return null;
  if (!(stageWidth > 0) || !(stageHeight > 0)) return null;
  const containScale = Math.min(stageWidth / imageWidth, stageHeight / imageHeight);
  const drawWidth = imageWidth * containScale;
  const drawHeight = imageHeight * containScale;
  const clippedTransform = resolveClippedLayerTransform({
    transform: {
      translateXRatio: Number.isFinite(transform?.translateXRatio)
        ? (transform?.translateXRatio as number)
        : 0,
      translateYRatio: Number.isFinite(transform?.translateYRatio)
        ? (transform?.translateYRatio as number)
        : 0,
      scale: Number.isFinite(transform?.scale) ? (transform?.scale as number) : 1,
      rotationDeg: Number.isFinite(transform?.rotationDeg) ? (transform?.rotationDeg as number) : 0,
    },
  });
  return {
    drawWidth,
    drawHeight,
    translateX: clippedTransform.translateXRatio * stageWidth,
    translateY: clippedTransform.translateYRatio * stageHeight,
    scale: clippedTransform.scale,
    rotationDeg: clippedTransform.rotationDeg,
  };
};

/**
 * Clamps any crop rect to the drawable stage extents.
 */
export const clampCropRectToStage = ({
  cropRect,
  stageWidth,
  stageHeight,
}: {
  cropRect: ExpertEditCropRect;
  stageWidth: number;
  stageHeight: number;
}) => {
  const sx = clamp(Math.floor(cropRect.x), 0, stageWidth);
  const sy = clamp(Math.floor(cropRect.y), 0, stageHeight);
  const endX = clamp(Math.ceil(cropRect.x + cropRect.width), 0, stageWidth);
  const endY = clamp(Math.ceil(cropRect.y + cropRect.height), 0, stageHeight);
  const sw = Math.max(0, endX - sx);
  const sh = Math.max(0, endY - sy);
  if (sw <= 0 || sh <= 0) return null;
  return { sx, sy, sw, sh };
};

/**
 * Renders the active layer exactly as shown in-stage, then exports only the crop rect.
 */
export const composeExpertEditLayerCropToBlob = async ({
  imageUrl,
  stageWidth,
  stageHeight,
  cropRect,
  transform,
  mimeType = DEFAULT_MIME_TYPE,
}: {
  imageUrl: string;
  stageWidth: number;
  stageHeight: number;
  cropRect: ExpertEditCropRect;
  transform?: ExpertEditLayerTransform | null;
  mimeType?: "image/png" | "image/jpeg";
}): Promise<Blob> => {
  if (!imageUrl?.trim()) {
    throw new Error("Layer image URL is required for crop export.");
  }
  if (!(stageWidth > 0) || !(stageHeight > 0)) {
    throw new Error("Stage dimensions are invalid for crop export.");
  }
  const sourceWindow = clampCropRectToStage({
    cropRect,
    stageWidth,
    stageHeight,
  });
  if (!sourceWindow) {
    throw new Error("Crop bounds are outside the stage.");
  }

  const image = await loadImage(imageUrl);
  const imageWidth = Math.max(1, image.naturalWidth || image.width || 1);
  const imageHeight = Math.max(1, image.naturalHeight || image.height || 1);
  const drawPlan = buildExpertEditLayerStageDrawPlan({
    imageWidth,
    imageHeight,
    stageWidth,
    stageHeight,
    transform,
  });
  if (!drawPlan) {
    throw new Error("Unable to resolve stage draw plan for crop.");
  }

  const stageCanvas = document.createElement("canvas");
  stageCanvas.width = Math.max(1, Math.round(stageWidth));
  stageCanvas.height = Math.max(1, Math.round(stageHeight));
  const stageContext = stageCanvas.getContext("2d");
  if (!stageContext) {
    throw new Error("Canvas context unavailable for crop render.");
  }

  stageContext.clearRect(0, 0, stageCanvas.width, stageCanvas.height);
  stageContext.save();
  stageContext.translate(
    stageCanvas.width / 2 + drawPlan.translateX,
    stageCanvas.height / 2 + drawPlan.translateY
  );
  if (drawPlan.rotationDeg !== 0) {
    stageContext.rotate(toRadians(drawPlan.rotationDeg));
  }
  if (drawPlan.scale !== 1) {
    stageContext.scale(drawPlan.scale, drawPlan.scale);
  }
  stageContext.drawImage(
    image,
    -drawPlan.drawWidth / 2,
    -drawPlan.drawHeight / 2,
    drawPlan.drawWidth,
    drawPlan.drawHeight
  );
  stageContext.restore();

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = Math.max(1, sourceWindow.sw);
  outputCanvas.height = Math.max(1, sourceWindow.sh);
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) {
    throw new Error("Canvas context unavailable for crop export.");
  }
  outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputContext.drawImage(
    stageCanvas,
    sourceWindow.sx,
    sourceWindow.sy,
    sourceWindow.sw,
    sourceWindow.sh,
    0,
    0,
    sourceWindow.sw,
    sourceWindow.sh
  );

  return canvasToBlob(outputCanvas, mimeType);
};
