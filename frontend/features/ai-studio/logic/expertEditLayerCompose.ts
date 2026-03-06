/**
 * Composition helpers for Expert Edit primary layer stacks.
 * Produces a flattened PNG blob from ordered layer image URLs.
 */
export type ExpertEditCompositingLayer = {
  imageUrl: string | null;
  opacity?: number;
};

const DEFAULT_COMPOSITE_MIME_TYPE = "image/png";

const isCrossOriginCandidate = (url: string) =>
  url.startsWith("http://") || url.startsWith("https://");

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
      reject(error instanceof Error ? error : new Error("Canvas export failed during flatten."));
    }
  });

const clampOpacity = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Flattens populated layers into a single blob where the first layer in the
 * current list order is topmost.
 */
export const composePrimaryLayersToBlob = async (
  layers: ExpertEditCompositingLayer[],
  options?: { mimeType?: string }
): Promise<Blob> => {
  const populatedLayers = layers.filter(
    (layer): layer is { imageUrl: string; opacity?: number } =>
      typeof layer.imageUrl === "string" && !!layer.imageUrl
  );
  if (!populatedLayers.length) {
    throw new Error("No populated layers to flatten.");
  }

  // Draw bottom-most first and top-most last so list order defines z-order.
  const drawOrder = [...populatedLayers].reverse();
  const decodedLayers = await Promise.all(
    drawOrder.map(async (layer) => ({
      image: await loadImage(layer.imageUrl),
      opacity: clampOpacity(layer.opacity ?? 1),
    }))
  );
  const baseLayer = decodedLayers[0];
  const baseImage = baseLayer?.image;
  if (!baseImage) {
    throw new Error("Unable to decode layer images.");
  }

  const width = Math.max(1, baseImage.naturalWidth || baseImage.width || 1);
  const height = Math.max(1, baseImage.naturalHeight || baseImage.height || 1);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Canvas context unavailable for flatten.");
  }

  decodedLayers.forEach(({ image, opacity }) => {
    context.globalAlpha = opacity;
    context.drawImage(image, 0, 0, width, height);
  });
  context.globalAlpha = 1;

  return canvasToBlob(canvas, options?.mimeType ?? DEFAULT_COMPOSITE_MIME_TYPE);
};
