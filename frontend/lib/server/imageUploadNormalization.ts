/**
 * Server-side oversized image upload normalization helpers.
 * Attempts to resize/re-encode oversized images before the canonical upload service enforces the final size cap.
 */
import sharp, { type Metadata } from "sharp";
import type { ImageDimensions } from "../mediaDimensionMetadata";

const IMAGE_UPLOAD_NORMALIZATION_TARGET_BYTES = 23 * 1024 * 1024;
const IMAGE_UPLOAD_NORMALIZATION_LONG_EDGES = [
  2048, 1792, 1536, 1280, 1024, 896, 768, 640,
] as const;
const IMAGE_UPLOAD_NORMALIZATION_WEB_QUALITIES = [82, 72, 62, 52, 44, 36] as const;
const IMAGE_UPLOAD_NORMALIZATION_AVIF_QUALITIES = [70, 58, 46, 34] as const;

const readImageDimensions = (metadata: Metadata): ImageDimensions | null => {
  if (!metadata.width || !metadata.height) return null;
  return {
    width: metadata.width,
    height: metadata.height,
  };
};

type NormalizedImageCandidate = {
  buffer: Buffer;
  dimensions: ImageDimensions | null;
  mimeType: "image/avif" | "image/jpeg" | "image/webp";
};

export type ImageUploadNormalizationMetadata = {
  attempted: boolean;
  applied: boolean;
  original_bytes: number;
  final_bytes: number;
  original_mime_type: string;
  final_mime_type: string;
  original_width: number | null;
  original_height: number | null;
  final_width: number | null;
  final_height: number | null;
  animated: boolean;
  target_max_bytes: number;
  failure_reason: string | null;
};

export type ImageUploadNormalizationResult = {
  buffer: Buffer;
  dimensions: ImageDimensions | null;
  metadata: ImageUploadNormalizationMetadata | null;
  mimeType: string;
};

export class UnsupportedOversizedAnimatedImageError extends Error {
  constructor() {
    super("Animated images over 25 MB are not auto-resized.");
  }
}

const buildNormalizationMetadata = ({
  applied,
  originalBytes,
  finalBuffer,
  originalMimeType,
  finalMimeType,
  originalDimensions,
  finalDimensions,
  animated,
  failureReason,
}: {
  applied: boolean;
  originalBytes: number;
  finalBuffer: Buffer;
  originalMimeType: string;
  finalMimeType: string;
  originalDimensions: ImageDimensions | null;
  finalDimensions: ImageDimensions | null;
  animated: boolean;
  failureReason: string | null;
}): ImageUploadNormalizationMetadata => ({
  attempted: true,
  applied,
  original_bytes: originalBytes,
  final_bytes: finalBuffer.length,
  original_mime_type: originalMimeType,
  final_mime_type: finalMimeType,
  original_width: originalDimensions?.width ?? null,
  original_height: originalDimensions?.height ?? null,
  final_width: finalDimensions?.width ?? null,
  final_height: finalDimensions?.height ?? null,
  animated,
  target_max_bytes: IMAGE_UPLOAD_NORMALIZATION_TARGET_BYTES,
  failure_reason: failureReason,
});

const encodeNormalizedCandidate = async ({
  buffer,
  longEdge,
  mimeType,
  quality,
}: {
  buffer: Buffer;
  longEdge: number;
  mimeType: "image/avif" | "image/jpeg" | "image/webp";
  quality: number;
}): Promise<NormalizedImageCandidate> => {
  const pipeline = sharp(buffer, {
    animated: false,
    limitInputPixels: false,
  })
    .rotate()
    .resize({
      width: longEdge,
      height: longEdge,
      fit: "inside",
      withoutEnlargement: true,
    });

  const encodedPipeline =
    mimeType === "image/avif"
      ? pipeline.avif({ quality, effort: 6 })
      : mimeType === "image/webp"
        ? pipeline.webp({ quality, effort: 4 })
        : pipeline.jpeg({ quality, mozjpeg: true });
  const { data, info } = await encodedPipeline.toBuffer({ resolveWithObject: true });

  return {
    buffer: data,
    dimensions:
      info.width && info.height
        ? {
            width: info.width,
            height: info.height,
          }
        : null,
    mimeType,
  };
};

/**
 * Attempts to normalize oversized images into a storable representation below the canonical upload cap.
 */
export const maybeNormalizeOversizedImageUpload = async ({
  buffer,
  mimeType,
  maxBytes,
}: {
  buffer: Buffer;
  mimeType: string;
  maxBytes: number;
}): Promise<ImageUploadNormalizationResult> => {
  if (buffer.length <= maxBytes) {
    return {
      buffer,
      dimensions: null,
      metadata: null,
      mimeType,
    };
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, {
      animated: true,
      limitInputPixels: false,
    }).metadata();
  } catch {
    return {
      buffer,
      dimensions: null,
      metadata: buildNormalizationMetadata({
        applied: false,
        originalBytes: buffer.length,
        finalBuffer: buffer,
        originalMimeType: mimeType,
        finalMimeType: mimeType,
        originalDimensions: null,
        finalDimensions: null,
        animated: false,
        failureReason: "decode_failed",
      }),
      mimeType,
    };
  }

  const originalDimensions = readImageDimensions(metadata);
  const animated = (metadata.pages ?? 1) > 1;
  if (animated) {
    throw new UnsupportedOversizedAnimatedImageError();
  }

  const targetBytes = Math.min(IMAGE_UPLOAD_NORMALIZATION_TARGET_BYTES, maxBytes);
  const candidateMimeTypes: Array<"image/avif" | "image/jpeg" | "image/webp"> = [
    "image/avif",
    "image/webp",
  ];
  if (!metadata.hasAlpha) {
    candidateMimeTypes.push("image/jpeg");
  }

  let bestCandidate: NormalizedImageCandidate | null = null;
  for (const longEdge of IMAGE_UPLOAD_NORMALIZATION_LONG_EDGES) {
    for (const candidateMimeType of candidateMimeTypes) {
      const qualitySteps =
        candidateMimeType === "image/avif"
          ? IMAGE_UPLOAD_NORMALIZATION_AVIF_QUALITIES
          : IMAGE_UPLOAD_NORMALIZATION_WEB_QUALITIES;
      for (const quality of qualitySteps) {
        try {
          const candidate = await encodeNormalizedCandidate({
            buffer,
            longEdge,
            mimeType: candidateMimeType,
            quality,
          });
          if (!bestCandidate || candidate.buffer.length < bestCandidate.buffer.length) {
            bestCandidate = candidate;
          }
          if (candidate.buffer.length <= targetBytes) {
            return {
              buffer: candidate.buffer,
              dimensions: candidate.dimensions,
              metadata: buildNormalizationMetadata({
                applied: true,
                originalBytes: buffer.length,
                finalBuffer: candidate.buffer,
                originalMimeType: mimeType,
                finalMimeType: candidate.mimeType,
                originalDimensions,
                finalDimensions: candidate.dimensions,
                animated,
                failureReason: null,
              }),
              mimeType: candidate.mimeType,
            };
          }
        } catch {
          // Keep searching other candidates; some decodes/encodes can fail by format.
        }
      }
    }
  }

  if (!bestCandidate || bestCandidate.buffer.length >= buffer.length) {
    return {
      buffer,
      dimensions: originalDimensions,
      metadata: buildNormalizationMetadata({
        applied: false,
        originalBytes: buffer.length,
        finalBuffer: buffer,
        originalMimeType: mimeType,
        finalMimeType: mimeType,
        originalDimensions,
        finalDimensions: originalDimensions,
        animated,
        failureReason: bestCandidate ? "no_smaller_candidate" : "encode_failed",
      }),
      mimeType,
    };
  }

  return {
    buffer: bestCandidate.buffer,
    dimensions: bestCandidate.dimensions,
    metadata: buildNormalizationMetadata({
      applied: true,
      originalBytes: buffer.length,
      finalBuffer: bestCandidate.buffer,
      originalMimeType: mimeType,
      finalMimeType: bestCandidate.mimeType,
      originalDimensions,
      finalDimensions: bestCandidate.dimensions,
      animated,
      failureReason: bestCandidate.buffer.length <= maxBytes ? null : "best_effort_still_oversized",
    }),
    mimeType: bestCandidate.mimeType,
  };
};
