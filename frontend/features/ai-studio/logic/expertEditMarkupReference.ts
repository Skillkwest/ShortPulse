/**
 * Builds a markup-composite reference image for Expert Edit generation.
 * Renders the flattened base image and current markup strokes into a single PNG blob.
 */
import {
  isMarkupStrokeClosedShape,
  MARKUP_LASSO_FILL_OPACITY,
  resolveMarkupStrokePointToSurfacePoint,
  resolveMarkupStrokeWidthPx,
  type MarkupStroke,
} from "../components/edit/markupStrokeController";

type ResolveBlobDimensions = (blob: Blob) => Promise<{ width: number; height: number }>;

const drawFlattenedBlobToCanvas = async ({
  canvasContext,
  flattenedBlob,
  width,
  height,
}: {
  canvasContext: CanvasRenderingContext2D;
  flattenedBlob: Blob;
  width: number;
  height: number;
}): Promise<boolean> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(flattenedBlob);
      try {
        canvasContext.drawImage(bitmap, 0, 0, width, height);
        return true;
      } finally {
        bitmap.close();
      }
    } catch {
      return false;
    }
  }
  if (typeof Image === "undefined") return false;
  const objectUrl = URL.createObjectURL(flattenedBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Unable to decode flattened image blob."));
      nextImage.src = objectUrl;
    });
    canvasContext.drawImage(image, 0, 0, width, height);
    return true;
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const drawMarkupStrokesToCanvas = ({
  canvasContext,
  markupStrokes,
  width,
  height,
}: {
  canvasContext: CanvasRenderingContext2D;
  markupStrokes: MarkupStroke[];
  width: number;
  height: number;
}) => {
  markupStrokes.forEach((stroke) => {
    const firstPoint = stroke.points[0];
    if (!firstPoint) return;
    const strokeWidthPx = resolveMarkupStrokeWidthPx({
      stroke,
      stageHeight: height,
    });
    canvasContext.lineCap = "round";
    canvasContext.lineJoin = "round";
    canvasContext.strokeStyle = stroke.color;
    canvasContext.fillStyle = stroke.color;
    canvasContext.lineWidth = strokeWidthPx;

    if (stroke.points.length === 1) {
      const point = resolveMarkupStrokePointToSurfacePoint({
        point: firstPoint,
        stageWidth: width,
        stageHeight: height,
      });
      canvasContext.beginPath();
      canvasContext.arc(point.x, point.y, Math.max(0.5, strokeWidthPx / 2), 0, Math.PI * 2);
      canvasContext.fill();
      return;
    }

    canvasContext.beginPath();
    stroke.points.forEach((point, pointIndex) => {
      const pointPx = resolveMarkupStrokePointToSurfacePoint({
        point,
        stageWidth: width,
        stageHeight: height,
      });
      if (pointIndex === 0) {
        canvasContext.moveTo(pointPx.x, pointPx.y);
      } else {
        canvasContext.lineTo(pointPx.x, pointPx.y);
      }
    });
    if (isMarkupStrokeClosedShape(stroke)) {
      canvasContext.closePath();
      canvasContext.save();
      canvasContext.globalAlpha = MARKUP_LASSO_FILL_OPACITY;
      canvasContext.fill();
      canvasContext.restore();
    }
    canvasContext.stroke();
  });
};

/**
 * Composes a flattened markup reference blob.
 * Returns null when composition cannot run in the current runtime.
 */
export const composeFlattenedMarkupReferenceBlob = async ({
  flattenedBlob,
  markupStrokes,
  resolveBlobDimensions,
}: {
  flattenedBlob: Blob;
  markupStrokes: MarkupStroke[];
  resolveBlobDimensions: ResolveBlobDimensions;
}): Promise<Blob | null> => {
  if (typeof document === "undefined") return null;
  if (!markupStrokes.length) return null;

  const dimensions = await resolveBlobDimensions(flattenedBlob);
  const width = Math.max(1, Math.floor(dimensions.width));
  const height = Math.max(1, Math.floor(dimensions.height));
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const drewBaseImage = await drawFlattenedBlobToCanvas({
    canvasContext: context,
    flattenedBlob,
    width,
    height,
  });
  if (!drewBaseImage) return null;

  drawMarkupStrokesToCanvas({
    canvasContext: context,
    markupStrokes,
    width,
    height,
  });

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
};
