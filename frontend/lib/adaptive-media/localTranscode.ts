/**
 * Local image transcode helpers for browser-only resize/compress flows.
 * Shared by adaptive preview handling and local upload preprocessing.
 */
import type { AdaptiveDecision } from "./types";

const LOCAL_IMAGE_UPLOAD_MAX_LONG_EDGE_PX = 2048;
const LOCAL_IMAGE_UPLOAD_SIZE_THRESHOLD_BYTES = 8 * 1024 * 1024;
const LOCAL_IMAGE_UPLOAD_WEBP_QUALITY = 0.88;

const isLocalImageBlob = (blob: Blob): boolean =>
  typeof blob.type === "string" && blob.type.toLowerCase().startsWith("image/");

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image."));
    image.src = src;
  });

const createCanvasContext = (
  width: number,
  height: number
): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to process image.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  return { canvas, context };
};

type ResolvedLocalImageSource = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

const resolveLocalImageSource = async (blob: Blob): Promise<ResolvedLocalImageSource | null> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      const width = Math.max(1, Math.round(bitmap.width));
      const height = Math.max(1, Math.round(bitmap.height));
      if (width > 0 && height > 0) {
        return {
          source: bitmap,
          width,
          height,
          release: () => bitmap.close(),
        };
      }
    } catch {
      // Fall back to image-element loading below.
    }
  }

  let objectUrl: string | null = URL.createObjectURL(blob);
  const releaseObjectUrl = () => {
    if (!objectUrl) return;
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  };
  try {
    const image = await loadImageElement(objectUrl);
    const width = Math.max(1, Math.round(image.naturalWidth || image.width || 0));
    const height = Math.max(1, Math.round(image.naturalHeight || image.height || 0));
    if (width > 0 && height > 0) {
      return {
        source: image,
        width,
        height,
        release: releaseObjectUrl,
      };
    }
    return null;
  } catch {
    return null;
  } finally {
    releaseObjectUrl();
  }
};

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> =>
  new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), mimeType, quality);
    } catch {
      resolve(null);
    }
  });

export const shouldTranscodeLocalAdaptiveImage = ({
  sourceUrl,
  naturalWidth,
  naturalHeight,
  decision,
}: {
  sourceUrl: string;
  naturalWidth: number;
  naturalHeight: number;
  decision: AdaptiveDecision;
}): boolean => {
  if (!decision.allowTranscodeLocal) return false;
  const isLocalImageSource = /^blob:/i.test(sourceUrl) || /^data:image\//i.test(sourceUrl);
  if (!isLocalImageSource) return false;
  if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight)) return false;
  if (naturalWidth <= 0 || naturalHeight <= 0) return false;

  const longEdge = Math.max(naturalWidth, naturalHeight);
  return longEdge > decision.targetLongEdgePx * 1.2;
};

export const transcodeLocalImageToObjectUrl = async ({
  image,
  decision,
}: {
  image: HTMLImageElement;
  decision: AdaptiveDecision;
}): Promise<string | null> => {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight)) return null;
  if (naturalWidth <= 0 || naturalHeight <= 0) return null;

  const longEdge = Math.max(naturalWidth, naturalHeight);
  const targetLongEdge = Math.max(240, Math.min(decision.targetLongEdgePx, longEdge));
  if (longEdge <= targetLongEdge + 8) return null;

  const scale = targetLongEdge / longEdge;
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));

  try {
    const { canvas, context } = createCanvasContext(width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob =
      (await canvasToBlob(canvas, "image/webp", decision.localTranscodeQuality)) ??
      (await canvasToBlob(canvas, "image/jpeg", decision.localTranscodeQuality));
    if (!blob) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

/**
 * Downscales and re-encodes a local image blob when it is large enough to risk upload failures.
 * Returns the original blob when preprocessing is not needed or cannot be completed safely.
 */
export const maybeTranscodeLocalImageBlobForUpload = async (blob: Blob): Promise<Blob> => {
  if (!isLocalImageBlob(blob)) return blob;

  const resolvedSource = await resolveLocalImageSource(blob);
  if (!resolvedSource) return blob;

  const longEdge = Math.max(resolvedSource.width, resolvedSource.height);
  const shouldTranscode =
    longEdge > LOCAL_IMAGE_UPLOAD_MAX_LONG_EDGE_PX ||
    blob.size > LOCAL_IMAGE_UPLOAD_SIZE_THRESHOLD_BYTES;
  if (!shouldTranscode) {
    resolvedSource.release();
    return blob;
  }

  const targetLongEdge =
    longEdge > LOCAL_IMAGE_UPLOAD_MAX_LONG_EDGE_PX ? LOCAL_IMAGE_UPLOAD_MAX_LONG_EDGE_PX : longEdge;
  const scale = targetLongEdge / longEdge;
  const width = Math.max(1, Math.round(resolvedSource.width * scale));
  const height = Math.max(1, Math.round(resolvedSource.height * scale));

  try {
    const { canvas, context } = createCanvasContext(width, height);
    context.drawImage(resolvedSource.source, 0, 0, width, height);

    const webpBlob = await canvasToBlob(canvas, "image/webp", LOCAL_IMAGE_UPLOAD_WEBP_QUALITY);
    if (webpBlob) return webpBlob;
    const jpegBlob = await canvasToBlob(canvas, "image/jpeg", LOCAL_IMAGE_UPLOAD_WEBP_QUALITY);
    if (jpegBlob) return jpegBlob;
  } catch {
    return blob;
  } finally {
    resolvedSource.release();
  }

  return blob;
};
