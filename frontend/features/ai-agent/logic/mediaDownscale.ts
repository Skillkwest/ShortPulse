/**
 * Browser-only helper to downscale an image file to a JPEG data URL with size guardrails.
 * Returns null if running server-side, on error, or if the result exceeds the byte limit.
 */
export type DownscaleOptions = {
  maxEdge?: number;
  quality?: number;
  maxBytes?: number;
};

const DEFAULT_MAX_EDGE = 512;
const DEFAULT_QUALITY = 0.6;
const DEFAULT_MAX_BYTES = 350 * 1024; // ~350 KB

const estimateBase64Bytes = (dataUrl: string) => {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex === -1) return dataUrl.length;
  const base64 = dataUrl.slice(commaIndex + 1);
  return Math.floor((base64.length * 3) / 4);
};

export const downscaleImageToDataUrl = async (
  file: File,
  options: DownscaleOptions = {},
): Promise<string | null> => {
  if (typeof window === "undefined") return null;
  const { maxEdge = DEFAULT_MAX_EDGE, quality = DEFAULT_QUALITY, maxBytes = DEFAULT_MAX_BYTES } = options;

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });

    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (estimateBase64Bytes(dataUrl) > maxBytes) {
      return null;
    }
    return dataUrl;
  } catch (_error) {
    return null;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
