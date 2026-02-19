import type { AdaptiveDecision } from "./types";

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

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) return null;
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  try {
    context.drawImage(image, 0, 0, width, height);
  } catch {
    return null;
  }

  const encodeToBlob = (mimeType: string, quality: number) =>
    new Promise<Blob | null>((resolve) => {
      try {
        canvas.toBlob((blob) => resolve(blob), mimeType, quality);
      } catch {
        resolve(null);
      }
    });

  const blob =
    (await encodeToBlob("image/webp", decision.localTranscodeQuality)) ??
    (await encodeToBlob("image/jpeg", decision.localTranscodeQuality));
  if (!blob) return null;
  return URL.createObjectURL(blob);
};
