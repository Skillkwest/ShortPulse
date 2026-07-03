/**
 * Display-preview helpers for AI Studio reference property slots.
 * Builds small local previews without changing the authoritative reference URL.
 */

const EDIT_SECONDARY_DISPLAY_PREVIEW_LONG_EDGE_PX = 224;
const EDIT_SECONDARY_DISPLAY_PREVIEW_QUALITY = 0.82;
const EDIT_SECONDARY_DISPLAY_PREVIEW_LOAD_TIMEOUT_MS = 250;

const loadImageElementFromObjectUrl = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const timeoutId = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("Timed out while loading display preview image."));
    }, EDIT_SECONDARY_DISPLAY_PREVIEW_LOAD_TIMEOUT_MS);
    image.onload = () => {
      window.clearTimeout(timeoutId);
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeoutId);
      reject(new Error("Unable to load display preview image."));
    };
    image.src = src;
  });

const resolveBlobImageSource = async (
  blob: Blob
): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
} | null> => {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        source: bitmap,
        width: Math.max(1, Math.round(bitmap.width)),
        height: Math.max(1, Math.round(bitmap.height)),
        release: () => bitmap.close(),
      };
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
    const image = await loadImageElementFromObjectUrl(objectUrl);
    return {
      source: image,
      width: Math.max(1, Math.round(image.naturalWidth || image.width || 1)),
      height: Math.max(1, Math.round(image.naturalHeight || image.height || 1)),
      release: releaseObjectUrl,
    };
  } catch {
    releaseObjectUrl();
    return null;
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

/**
 * Creates a low-resolution display-only object URL for secondary reference previews.
 */
export const createSmallImageDisplayPreviewUrl = async (
  blob: Blob | null
): Promise<string | null> => {
  if (!blob || typeof document === "undefined") return null;
  if (!blob.type.toLowerCase().startsWith("image/")) return null;
  const resolved = await resolveBlobImageSource(blob);
  if (!resolved) return null;
  try {
    const longEdge = Math.max(resolved.width, resolved.height);
    const scale = Math.min(1, EDIT_SECONDARY_DISPLAY_PREVIEW_LONG_EDGE_PX / longEdge);
    const width = Math.max(1, Math.round(resolved.width * scale));
    const height = Math.max(1, Math.round(resolved.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(resolved.source, 0, 0, width, height);
    const previewBlob =
      (await canvasToBlob(canvas, "image/webp", EDIT_SECONDARY_DISPLAY_PREVIEW_QUALITY)) ??
      (await canvasToBlob(canvas, "image/jpeg", EDIT_SECONDARY_DISPLAY_PREVIEW_QUALITY));
    return previewBlob ? URL.createObjectURL(previewBlob) : null;
  } finally {
    resolved.release();
  }
};
