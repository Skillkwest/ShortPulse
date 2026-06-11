/**
 * OmniHuman provider media compatibility helpers.
 * Normalizes image inputs that Fal CDN can host but OmniHuman may reject by format.
 */
import sharp from "sharp";
import { FAL_UPLOAD_COMPATIBILITY_TARGET_OMNIHUMAN_V15_IMAGE } from "../model-runtime/falUploadCompatibilityTargets";
import { detectImageMimeType } from "./uploadSignature";

export type FalUploadCompatibilityTarget =
  | typeof FAL_UPLOAD_COMPATIBILITY_TARGET_OMNIHUMAN_V15_IMAGE
  | null;

type NormalizeOmniHumanImageParams = {
  buffer: Buffer;
  mimeType: string | null;
  fileName: string;
};

type NormalizeOmniHumanImageResult = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  originalMimeType: string | null;
  normalized: boolean;
};

const OMNIHUMAN_DIRECT_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png"]);

const normalizeMimeType = (value: string | null | undefined): string | null => {
  const normalized = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  return normalized || null;
};

const replaceFileExtension = (fileName: string, extension: string): string => {
  const cleanName = fileName.split(/[?#]/)[0]?.split(/[\\/]/).pop()?.trim() ?? "";
  const baseName = cleanName || `omnihuman-input-${Date.now()}`;
  const stem = baseName.replace(/\.[a-z0-9]+$/i, "").trim() || "omnihuman-input";
  return `${stem}.${extension}`;
};

/**
 * Returns an OmniHuman-safe still-image representation.
 * JPEG/PNG are passed through; WebP/AVIF/HEIC/GIF/unknown image bytes are re-encoded as JPEG.
 */
export const normalizeOmniHumanImageInput = async ({
  buffer,
  mimeType,
  fileName,
}: NormalizeOmniHumanImageParams): Promise<NormalizeOmniHumanImageResult> => {
  const detectedMimeType = detectImageMimeType(buffer);
  const originalMimeType = normalizeMimeType(detectedMimeType ?? mimeType);
  if (originalMimeType && OMNIHUMAN_DIRECT_IMAGE_MIME_TYPES.has(originalMimeType)) {
    return {
      buffer,
      mimeType: originalMimeType,
      fileName,
      originalMimeType,
      normalized: false,
    };
  }

  const normalizedBuffer = await sharp(buffer, {
    animated: false,
    limitInputPixels: false,
  })
    .rotate()
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  return {
    buffer: normalizedBuffer,
    mimeType: "image/jpeg",
    fileName: replaceFileExtension(fileName, "jpg"),
    originalMimeType,
    normalized: true,
  };
};
