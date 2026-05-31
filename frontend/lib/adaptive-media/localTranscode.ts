/**
 * Local image transcode helpers for browser-only resize/compress flows.
 * Shared by adaptive preview handling and local upload preprocessing.
 */
import { IMAGE_ADMISSION_MAX_BYTES, IMAGE_ADMISSION_TARGET_BYTES } from "../imageAdmissionPolicy";
import type { AdaptiveDecision } from "./types";

const LOCAL_IMAGE_UPLOAD_MAX_LONG_EDGE_PX = 2048;
const LOCAL_IMAGE_UPLOAD_SIZE_THRESHOLD_BYTES = 8 * 1024 * 1024;
const LOCAL_IMAGE_UPLOAD_TARGET_MAX_BYTES = IMAGE_ADMISSION_TARGET_BYTES;
const LOCAL_IMAGE_UPLOAD_WEBP_QUALITY_STEPS = [0.88, 0.76, 0.64, 0.52];
const LOCAL_IMAGE_UPLOAD_LONG_EDGE_STEPS = [2048, 1792, 1536, 1280, 1024];
export const CANONICAL_IMAGE_UPLOAD_MAX_BYTES = IMAGE_ADMISSION_MAX_BYTES;

const isLocalImageBlob = (blob: Blob): boolean =>
  typeof blob.type === "string" && blob.type.toLowerCase().startsWith("image/");

const inferImageExtensionFromMimeType = (mimeType: string): string => {
  const normalizedMimeType = mimeType.trim().toLowerCase();
  if (normalizedMimeType === "image/png") return "png";
  if (normalizedMimeType === "image/webp") return "webp";
  if (normalizedMimeType === "image/gif") return "gif";
  if (normalizedMimeType === "image/avif") return "avif";
  if (normalizedMimeType === "image/bmp") return "bmp";
  if (normalizedMimeType === "image/heic") return "heic";
  if (normalizedMimeType === "image/heif") return "heif";
  return "jpg";
};

const replaceFileExtension = (filename: string, nextExtension: string): string => {
  const trimmedFilename = filename.trim();
  if (!trimmedFilename) return `upload.${nextExtension}`;
  const dotIndex = trimmedFilename.lastIndexOf(".");
  if (dotIndex <= 0) {
    return `${trimmedFilename}.${nextExtension}`;
  }
  return `${trimmedFilename.slice(0, dotIndex)}.${nextExtension}`;
};

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

const encodeResizedImageBlob = async ({
  source,
  sourceWidth,
  sourceHeight,
  targetLongEdge,
  quality,
  mimeType,
}: {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  targetLongEdge: number;
  quality: number;
  mimeType: string;
}): Promise<Blob | null> => {
  const scale = targetLongEdge / Math.max(sourceWidth, sourceHeight);
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));
  const { canvas, context } = createCanvasContext(width, height);
  context.drawImage(source, 0, 0, width, height);
  return await canvasToBlob(canvas, mimeType, quality);
};

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
  if (blob.size <= LOCAL_IMAGE_UPLOAD_SIZE_THRESHOLD_BYTES) return blob;

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

  try {
    let bestBlob: Blob | null = null;
    const initialTargetLongEdge = Math.min(longEdge, LOCAL_IMAGE_UPLOAD_MAX_LONG_EDGE_PX);
    const targetLongEdges = [
      initialTargetLongEdge,
      ...LOCAL_IMAGE_UPLOAD_LONG_EDGE_STEPS.filter((edge) => edge < initialTargetLongEdge),
    ];

    for (const targetLongEdge of targetLongEdges) {
      for (const quality of LOCAL_IMAGE_UPLOAD_WEBP_QUALITY_STEPS) {
        const webpBlob = await encodeResizedImageBlob({
          source: resolvedSource.source,
          sourceWidth: resolvedSource.width,
          sourceHeight: resolvedSource.height,
          targetLongEdge,
          quality,
          mimeType: "image/webp",
        });
        if (!webpBlob) continue;
        if (!bestBlob || webpBlob.size < bestBlob.size) bestBlob = webpBlob;
        if (webpBlob.size <= LOCAL_IMAGE_UPLOAD_TARGET_MAX_BYTES) return webpBlob;
      }
    }

    for (const targetLongEdge of targetLongEdges) {
      for (const quality of LOCAL_IMAGE_UPLOAD_WEBP_QUALITY_STEPS) {
        const jpegBlob = await encodeResizedImageBlob({
          source: resolvedSource.source,
          sourceWidth: resolvedSource.width,
          sourceHeight: resolvedSource.height,
          targetLongEdge,
          quality,
          mimeType: "image/jpeg",
        });
        if (!jpegBlob) continue;
        if (!bestBlob || jpegBlob.size < bestBlob.size) bestBlob = jpegBlob;
        if (jpegBlob.size <= LOCAL_IMAGE_UPLOAD_TARGET_MAX_BYTES) return jpegBlob;
      }
    }

    if (bestBlob) return bestBlob;
  } catch {
    return blob;
  } finally {
    resolvedSource.release();
  }

  return blob;
};

/**
 * Downscales and re-encodes a local image file when needed while keeping filename and MIME aligned.
 */
export const maybePreprocessLocalImageFileForUpload = async (file: File): Promise<File> => {
  const nextBlob = await maybeTranscodeLocalImageBlobForUpload(file);
  if (nextBlob === file) return file;

  const nextMimeType = nextBlob.type.trim().toLowerCase() || file.type || "image/jpeg";
  const nextFilename = replaceFileExtension(
    file.name,
    inferImageExtensionFromMimeType(nextMimeType)
  );

  return new File([nextBlob], nextFilename, {
    type: nextMimeType,
    lastModified: file.lastModified,
  });
};
