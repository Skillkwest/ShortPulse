/**
 * Kie GPT Image 2 provider-admission rules for image-to-image reference bytes.
 * Converts ShortPulse-valid still images into Kie's documented GPT Image 2 input constraints.
 */
import path from "path";
import sharp, { type Metadata } from "sharp";
import type { ImageDimensions } from "../mediaDimensionMetadata";

export const KIE_GPT_IMAGE_2_REFERENCE_IMAGE_MAX_BYTES = 30 * 1024 * 1024;
export const KIE_GPT_IMAGE_2_REFERENCE_IMAGE_TARGET_BYTES = 28 * 1024 * 1024;

type KieGptImage2ImageMimeType = "image/jpeg" | "image/png" | "image/webp";

type KieGptImage2ImageConstraints = {
  maxBytes: number;
  targetBytes: number;
};

export type KieGptImage2ReferenceImageAdmissionResult = {
  buffer: Buffer;
  filename: string;
  mimeType: KieGptImage2ImageMimeType;
  size: number;
  dimensions: ImageDimensions;
  admission: {
    profile: "kie_gpt_image_2_reference_image";
    status: "passthrough" | "admitted";
    originalBytes: number;
    admittedBytes: number;
    originalMimeType: string;
    admittedMimeType: KieGptImage2ImageMimeType;
    originalDimensions: ImageDimensions;
    admittedDimensions: ImageDimensions;
    supabaseTransformUsed: false;
  };
};

export class KieGptImage2ImageAdmissionError extends Error {
  readonly statusCode: number;
  readonly details: string;

  constructor(details: string, statusCode = 400) {
    super("GPT Image 2 reference image cannot be admitted for Kie.");
    this.name = "KieGptImage2ImageAdmissionError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

const DEFAULT_IMAGE_CONSTRAINTS: KieGptImage2ImageConstraints = {
  maxBytes: KIE_GPT_IMAGE_2_REFERENCE_IMAGE_MAX_BYTES,
  targetBytes: KIE_GPT_IMAGE_2_REFERENCE_IMAGE_TARGET_BYTES,
};

const JPEG_QUALITIES = [92, 84, 76, 68, 60, 52, 44, 36] as const;
const WEBP_QUALITIES = [92, 84, 76, 68, 60, 52, 44, 36] as const;
const LONG_EDGE_LADDER = [
  6000, 4096, 3072, 2560, 2048, 1792, 1536, 1280, 1024, 896, 768, 640,
] as const;

const normalizeMimeType = (mimeType: string): string =>
  mimeType.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";

const readDimensions = (metadata: Metadata): ImageDimensions | null => {
  if (!metadata.width || !metadata.height) return null;
  return {
    width: metadata.width,
    height: metadata.height,
  };
};

const resolvePassthroughMimeType = (mimeType: string): KieGptImage2ImageMimeType | null => {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/png") return "image/png";
  if (normalized === "image/webp") return "image/webp";
  return null;
};

const replaceFileExtension = (filename: string, mimeType: KieGptImage2ImageMimeType): string => {
  const parsed = path.parse(filename.trim() || "gpt-image-2-reference-image");
  const extension =
    mimeType === "image/png" ? ".png" : mimeType === "image/webp" ? ".webp" : ".jpg";
  return `${parsed.name || "gpt-image-2-reference-image"}${extension}`;
};

const buildLongEdgeCandidates = (dimensions: ImageDimensions): number[] => {
  const originalLongEdge = Math.max(dimensions.width, dimensions.height);
  return Array.from(
    new Set([originalLongEdge, ...LONG_EDGE_LADDER.filter((edge) => edge < originalLongEdge)])
  );
};

const encodeCandidate = async ({
  buffer,
  longEdge,
  mimeType,
  quality,
}: {
  buffer: Buffer;
  longEdge: number;
  mimeType: KieGptImage2ImageMimeType;
  quality?: number;
}): Promise<{
  buffer: Buffer;
  dimensions: ImageDimensions;
  mimeType: KieGptImage2ImageMimeType;
}> => {
  const pipeline = sharp(buffer, { animated: false, limitInputPixels: false }).rotate().resize({
    width: longEdge,
    height: longEdge,
    fit: "inside",
    withoutEnlargement: true,
  });
  const encoded =
    mimeType === "image/png"
      ? pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
      : mimeType === "image/webp"
        ? pipeline.webp({ quality: quality ?? 84 })
        : pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({
            quality: quality ?? 84,
            mozjpeg: true,
          });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) {
    throw new KieGptImage2ImageAdmissionError("GPT Image 2 reference image could not be decoded.");
  }
  return {
    buffer: data,
    dimensions: {
      width: info.width,
      height: info.height,
    },
    mimeType,
  };
};

const chooseAdmittedImageCandidate = async ({
  buffer,
  originalDimensions,
  hasAlpha,
  constraints,
}: {
  buffer: Buffer;
  originalDimensions: ImageDimensions;
  hasAlpha: boolean;
  constraints: KieGptImage2ImageConstraints;
}) => {
  let bestCandidate: {
    buffer: Buffer;
    dimensions: ImageDimensions;
    mimeType: KieGptImage2ImageMimeType;
  } | null = null;
  const mimePlans: Array<{
    mimeType: KieGptImage2ImageMimeType;
    qualities: readonly number[];
  }> = hasAlpha
    ? [
        { mimeType: "image/webp", qualities: WEBP_QUALITIES },
        { mimeType: "image/png", qualities: [0] },
        { mimeType: "image/jpeg", qualities: JPEG_QUALITIES },
      ]
    : [
        { mimeType: "image/jpeg", qualities: JPEG_QUALITIES },
        { mimeType: "image/webp", qualities: WEBP_QUALITIES },
      ];

  for (const longEdge of buildLongEdgeCandidates(originalDimensions)) {
    for (const plan of mimePlans) {
      for (const quality of plan.qualities) {
        let candidate: {
          buffer: Buffer;
          dimensions: ImageDimensions;
          mimeType: KieGptImage2ImageMimeType;
        };
        try {
          candidate = await encodeCandidate({
            buffer,
            longEdge,
            mimeType: plan.mimeType,
            quality,
          });
        } catch {
          continue;
        }
        if (!bestCandidate || candidate.buffer.length < bestCandidate.buffer.length) {
          bestCandidate = candidate;
        }
        if (candidate.buffer.length <= constraints.targetBytes) {
          return candidate;
        }
      }
    }
  }

  if (bestCandidate && bestCandidate.buffer.length <= constraints.maxBytes) {
    return bestCandidate;
  }

  throw new KieGptImage2ImageAdmissionError(
    "GPT Image 2 reference image is still over Kie's 30 MB image limit after admission."
  );
};

/**
 * Admits one GPT Image 2 reference image for Kie's provider constraints.
 * Side effects: none; callers own provider upload and storage decisions.
 */
export const admitKieGptImage2ReferenceImage = async ({
  buffer,
  filename,
  mimeType,
  constraints = DEFAULT_IMAGE_CONSTRAINTS,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  constraints?: Partial<KieGptImage2ImageConstraints>;
}): Promise<KieGptImage2ReferenceImageAdmissionResult> => {
  const effectiveConstraints = {
    ...DEFAULT_IMAGE_CONSTRAINTS,
    ...constraints,
    targetBytes: Math.min(
      constraints.targetBytes ?? DEFAULT_IMAGE_CONSTRAINTS.targetBytes,
      constraints.maxBytes ?? DEFAULT_IMAGE_CONSTRAINTS.maxBytes
    ),
  };
  if (normalizeMimeType(mimeType) === "image/gif") {
    throw new KieGptImage2ImageAdmissionError(
      "GPT Image 2 reference image must be a still JPEG, PNG, or WEBP image."
    );
  }
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { animated: true, limitInputPixels: false }).metadata();
  } catch {
    throw new KieGptImage2ImageAdmissionError(
      "GPT Image 2 reference image must be a readable still image."
    );
  }

  if ((metadata.pages ?? 1) > 1) {
    throw new KieGptImage2ImageAdmissionError(
      "GPT Image 2 reference image must be a still JPEG, PNG, or WEBP image."
    );
  }

  const originalDimensions = readDimensions(metadata);
  if (!originalDimensions) {
    throw new KieGptImage2ImageAdmissionError(
      "GPT Image 2 reference image dimensions could not be read."
    );
  }

  const passthroughMimeType = resolvePassthroughMimeType(mimeType);
  if (passthroughMimeType && buffer.length <= effectiveConstraints.maxBytes) {
    return {
      buffer,
      filename: replaceFileExtension(filename, passthroughMimeType),
      mimeType: passthroughMimeType,
      size: buffer.length,
      dimensions: originalDimensions,
      admission: {
        profile: "kie_gpt_image_2_reference_image",
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

  const candidate = await chooseAdmittedImageCandidate({
    buffer,
    originalDimensions,
    hasAlpha: Boolean(metadata.hasAlpha),
    constraints: effectiveConstraints,
  });
  return {
    buffer: candidate.buffer,
    filename: replaceFileExtension(filename, candidate.mimeType),
    mimeType: candidate.mimeType,
    size: candidate.buffer.length,
    dimensions: candidate.dimensions,
    admission: {
      profile: "kie_gpt_image_2_reference_image",
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
