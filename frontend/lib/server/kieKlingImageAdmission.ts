/**
 * Kie Kling provider-admission rules for image reference bytes.
 * Converts ShortPulse-valid still images into Kling-compatible JPEG/PNG inputs.
 */
import path from "path";
import sharp, { type Metadata } from "sharp";
import type { ImageDimensions } from "../mediaDimensionMetadata";

type KieKlingImageMimeType = "image/jpeg" | "image/png";

export type KieKlingReferenceImageAdmissionResult = {
  buffer: Buffer;
  filename: string;
  mimeType: KieKlingImageMimeType;
  size: number;
  dimensions: ImageDimensions;
  admission: {
    profile: "kie_kling_reference_image";
    status: "passthrough" | "admitted";
    originalBytes: number;
    admittedBytes: number;
    originalMimeType: string;
    admittedMimeType: KieKlingImageMimeType;
    originalDimensions: ImageDimensions;
    admittedDimensions: ImageDimensions;
    supabaseTransformUsed: false;
  };
};

export class KieKlingImageAdmissionError extends Error {
  readonly statusCode: number;
  readonly details: string;

  constructor(details: string, statusCode = 400) {
    super("Kling image cannot be admitted for Kie.");
    this.name = "KieKlingImageAdmissionError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

const JPEG_QUALITY = 88;

const normalizeMimeType = (mimeType: string): string =>
  mimeType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";

const readDimensions = (metadata: Metadata): ImageDimensions | null => {
  if (!metadata.width || !metadata.height) return null;
  return {
    width: metadata.width,
    height: metadata.height,
  };
};

const resolvePassthroughMimeType = (mimeType: string): KieKlingImageMimeType | null => {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/png") return "image/png";
  return null;
};

const replaceFileExtension = (filename: string, mimeType: KieKlingImageMimeType): string => {
  const parsed = path.parse(filename.trim() || "kling-reference-image");
  const extension = mimeType === "image/png" ? ".png" : ".jpg";
  return `${parsed.name || "kling-reference-image"}${extension}`;
};

const encodeKlingCompatibleImage = async ({
  buffer,
  hasAlpha,
}: {
  buffer: Buffer;
  hasAlpha: boolean;
}): Promise<{
  buffer: Buffer;
  dimensions: ImageDimensions;
  mimeType: KieKlingImageMimeType;
}> => {
  const pipeline = sharp(buffer, { animated: false, limitInputPixels: false }).rotate();
  const encoded = hasAlpha
    ? pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
    : pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({
        quality: JPEG_QUALITY,
        mozjpeg: true,
      });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) {
    throw new KieKlingImageAdmissionError("Kling reference image could not be decoded.");
  }
  return {
    buffer: data,
    dimensions: {
      width: info.width,
      height: info.height,
    },
    mimeType: hasAlpha ? "image/png" : "image/jpeg",
  };
};

/**
 * Admits one Kling reference image for Kie's provider constraints.
 * Side effects: none; callers own provider upload and any storage decisions.
 */
export const admitKieKlingReferenceImage = async ({
  buffer,
  filename,
  mimeType,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}): Promise<KieKlingReferenceImageAdmissionResult> => {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { animated: true, limitInputPixels: false }).metadata();
  } catch {
    throw new KieKlingImageAdmissionError("Kling reference image must be a readable still image.");
  }

  if ((metadata.pages ?? 1) > 1) {
    throw new KieKlingImageAdmissionError(
      "Kling reference image must be a still JPEG or PNG image."
    );
  }

  const originalDimensions = readDimensions(metadata);
  if (!originalDimensions) {
    throw new KieKlingImageAdmissionError("Kling reference image dimensions could not be read.");
  }

  const passthroughMimeType = resolvePassthroughMimeType(mimeType);
  if (passthroughMimeType) {
    return {
      buffer,
      filename: replaceFileExtension(filename, passthroughMimeType),
      mimeType: passthroughMimeType,
      size: buffer.length,
      dimensions: originalDimensions,
      admission: {
        profile: "kie_kling_reference_image",
        status: "passthrough",
        originalBytes: buffer.length,
        admittedBytes: buffer.length,
        originalMimeType: normalizeMimeType(mimeType),
        admittedMimeType: passthroughMimeType,
        originalDimensions,
        admittedDimensions: originalDimensions,
        supabaseTransformUsed: false,
      },
    };
  }

  const candidate = await encodeKlingCompatibleImage({
    buffer,
    hasAlpha: Boolean(metadata.hasAlpha),
  });
  return {
    buffer: candidate.buffer,
    filename: replaceFileExtension(filename, candidate.mimeType),
    mimeType: candidate.mimeType,
    size: candidate.buffer.length,
    dimensions: candidate.dimensions,
    admission: {
      profile: "kie_kling_reference_image",
      status: "admitted",
      originalBytes: buffer.length,
      admittedBytes: candidate.buffer.length,
      originalMimeType: normalizeMimeType(mimeType),
      admittedMimeType: candidate.mimeType,
      originalDimensions,
      admittedDimensions: candidate.dimensions,
      supabaseTransformUsed: false,
    },
  };
};
