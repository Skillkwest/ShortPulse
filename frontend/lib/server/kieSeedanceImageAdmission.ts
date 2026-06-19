/**
 * Kie Seedance provider-admission rules for image reference bytes.
 * Converts ShortPulse-valid still images into Kie-compatible Seedance inputs.
 */
import path from "path";
import sharp, { type Metadata } from "sharp";
import type { ImageDimensions } from "../mediaDimensionMetadata";

export const KIE_SEEDANCE_REFERENCE_IMAGE_MAX_BYTES = 30 * 1024 * 1024;
export const KIE_SEEDANCE_REFERENCE_IMAGE_TARGET_BYTES = 28 * 1024 * 1024;
export const KIE_SEEDANCE_MIN_DIMENSION_PX = 300;
export const KIE_SEEDANCE_MAX_DIMENSION_PX = 6000;
export const KIE_SEEDANCE_MIN_ASPECT_RATIO = 0.4;
export const KIE_SEEDANCE_MAX_ASPECT_RATIO = 2.5;

type KieSeedanceImageMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
type KieSeedanceEncodedMimeType = "image/jpeg" | "image/png";

type KieSeedanceImageConstraints = {
  maxBytes: number;
  targetBytes: number;
  minDimensionPx: number;
  maxDimensionPx: number;
  minAspectRatio: number;
  maxAspectRatio: number;
};

export type KieSeedanceReferenceImageAdmissionResult = {
  buffer: Buffer;
  filename: string;
  mimeType: KieSeedanceImageMimeType | KieSeedanceEncodedMimeType;
  size: number;
  dimensions: ImageDimensions;
  admission: {
    profile: "kie_seedance_reference_image";
    status: "passthrough" | "admitted";
    originalBytes: number;
    admittedBytes: number;
    originalMimeType: string;
    admittedMimeType: KieSeedanceImageMimeType | KieSeedanceEncodedMimeType;
    originalDimensions: ImageDimensions;
    admittedDimensions: ImageDimensions;
    supabaseTransformUsed: false;
  };
};

export class KieSeedanceImageAdmissionError extends Error {
  readonly statusCode: number;
  readonly details: string;

  constructor(details: string, statusCode = 400) {
    super("Seedance image cannot be admitted for Kie.");
    this.name = "KieSeedanceImageAdmissionError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

const DEFAULT_IMAGE_CONSTRAINTS: KieSeedanceImageConstraints = {
  maxBytes: KIE_SEEDANCE_REFERENCE_IMAGE_MAX_BYTES,
  targetBytes: KIE_SEEDANCE_REFERENCE_IMAGE_TARGET_BYTES,
  minDimensionPx: KIE_SEEDANCE_MIN_DIMENSION_PX,
  maxDimensionPx: KIE_SEEDANCE_MAX_DIMENSION_PX,
  minAspectRatio: KIE_SEEDANCE_MIN_ASPECT_RATIO,
  maxAspectRatio: KIE_SEEDANCE_MAX_ASPECT_RATIO,
};

const JPEG_QUALITIES = [92, 84, 76, 68, 60, 52, 44, 36] as const;
const LONG_EDGE_LADDER = [
  6000, 4096, 3072, 2560, 2048, 1792, 1536, 1280, 1024, 896, 768, 640, 512, 384, 300,
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

const assertAspectWithinKieBounds = (
  dimensions: ImageDimensions,
  constraints: KieSeedanceImageConstraints
): void => {
  const aspectRatio = dimensions.width / dimensions.height;
  if (aspectRatio < constraints.minAspectRatio || aspectRatio > constraints.maxAspectRatio) {
    throw new KieSeedanceImageAdmissionError(
      "Seedance reference image aspect ratio must be between 0.4 and 2.5."
    );
  }
};

const assertDimensionsWithinKieBounds = (
  dimensions: ImageDimensions,
  constraints: KieSeedanceImageConstraints
): void => {
  if (
    dimensions.width < constraints.minDimensionPx ||
    dimensions.height < constraints.minDimensionPx ||
    dimensions.width > constraints.maxDimensionPx ||
    dimensions.height > constraints.maxDimensionPx
  ) {
    throw new KieSeedanceImageAdmissionError(
      "Seedance reference image width and height must be between 300 px and 6000 px."
    );
  }
  assertAspectWithinKieBounds(dimensions, constraints);
};

const resolvePassthroughMimeType = (mimeType: string): KieSeedanceImageMimeType | null => {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/png") return "image/png";
  if (normalized === "image/webp") return "image/webp";
  if (normalized === "image/gif") return "image/gif";
  return null;
};

const replaceFileExtension = (
  filename: string,
  mimeType: KieSeedanceImageMimeType | KieSeedanceEncodedMimeType
): string => {
  const parsed = path.parse(filename.trim() || "seedance-reference-image");
  const extension =
    mimeType === "image/png"
      ? ".png"
      : mimeType === "image/webp"
        ? ".webp"
        : mimeType === "image/gif"
          ? ".gif"
          : ".jpg";
  return `${parsed.name || "seedance-reference-image"}${extension}`;
};

const resolveBaseTargetDimensions = (
  dimensions: ImageDimensions,
  constraints: KieSeedanceImageConstraints
): ImageDimensions => {
  let scale = Math.max(
    1,
    constraints.minDimensionPx / dimensions.width,
    constraints.minDimensionPx / dimensions.height
  );
  const scaledWidth = dimensions.width * scale;
  const scaledHeight = dimensions.height * scale;
  if (scaledWidth > constraints.maxDimensionPx || scaledHeight > constraints.maxDimensionPx) {
    scale = Math.min(
      constraints.maxDimensionPx / dimensions.width,
      constraints.maxDimensionPx / dimensions.height
    );
  }
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  };
};

const scaleDimensionsToLongEdge = (
  dimensions: ImageDimensions,
  longEdge: number
): ImageDimensions => {
  const currentLongEdge = Math.max(dimensions.width, dimensions.height);
  if (currentLongEdge <= 0) return dimensions;
  const scale = longEdge / currentLongEdge;
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  };
};

const buildDimensionCandidates = (
  dimensions: ImageDimensions,
  constraints: KieSeedanceImageConstraints
): ImageDimensions[] => {
  const baseDimensions = resolveBaseTargetDimensions(dimensions, constraints);
  const baseLongEdge = Math.max(baseDimensions.width, baseDimensions.height);
  const candidates = [baseDimensions];
  for (const longEdge of LONG_EDGE_LADDER) {
    if (longEdge >= baseLongEdge) continue;
    const candidate = scaleDimensionsToLongEdge(baseDimensions, longEdge);
    try {
      assertDimensionsWithinKieBounds(candidate, constraints);
    } catch {
      continue;
    }
    candidates.push(candidate);
  }
  return Array.from(
    new Map(candidates.map((value) => [`${value.width}x${value.height}`, value])).values()
  );
};

const encodeCandidate = async ({
  buffer,
  dimensions,
  mimeType,
  quality,
}: {
  buffer: Buffer;
  dimensions: ImageDimensions;
  mimeType: KieSeedanceEncodedMimeType;
  quality?: number;
}): Promise<{
  buffer: Buffer;
  dimensions: ImageDimensions;
  mimeType: KieSeedanceEncodedMimeType;
}> => {
  const pipeline = sharp(buffer, { animated: false, limitInputPixels: false }).rotate().resize({
    width: dimensions.width,
    height: dimensions.height,
    fit: "inside",
    withoutEnlargement: false,
  });
  const encoded =
    mimeType === "image/png"
      ? pipeline.png({ compressionLevel: 9, adaptiveFiltering: true })
      : pipeline
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .jpeg({ quality: quality ?? 84, mozjpeg: true });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) {
    throw new KieSeedanceImageAdmissionError("Seedance reference image could not be decoded.");
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
  originalMimeType,
  hasAlpha,
  constraints,
}: {
  buffer: Buffer;
  originalDimensions: ImageDimensions;
  originalMimeType: string;
  hasAlpha: boolean;
  constraints: KieSeedanceImageConstraints;
}) => {
  let bestCandidate: {
    buffer: Buffer;
    dimensions: ImageDimensions;
    mimeType: KieSeedanceEncodedMimeType;
  } | null = null;
  const preferPng =
    hasAlpha ||
    originalDimensions.width < constraints.minDimensionPx ||
    originalDimensions.height < constraints.minDimensionPx ||
    normalizeMimeType(originalMimeType) === "image/png";
  const mimePlans: Array<{
    mimeType: KieSeedanceEncodedMimeType;
    qualities: readonly number[];
  }> = preferPng
    ? [
        { mimeType: "image/png", qualities: [0] },
        { mimeType: "image/jpeg", qualities: JPEG_QUALITIES },
      ]
    : [{ mimeType: "image/jpeg", qualities: JPEG_QUALITIES }];

  for (const dimensions of buildDimensionCandidates(originalDimensions, constraints)) {
    for (const plan of mimePlans) {
      for (const quality of plan.qualities) {
        let candidate: {
          buffer: Buffer;
          dimensions: ImageDimensions;
          mimeType: KieSeedanceEncodedMimeType;
        };
        try {
          candidate = await encodeCandidate({
            buffer,
            dimensions,
            mimeType: plan.mimeType,
            quality,
          });
        } catch {
          continue;
        }
        try {
          assertDimensionsWithinKieBounds(candidate.dimensions, constraints);
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

  throw new KieSeedanceImageAdmissionError(
    "Seedance reference image is still over Kie's 30 MB image limit after admission."
  );
};

/**
 * Admits one Seedance reference image for Kie's provider constraints.
 * Side effects: none; callers own provider upload and any storage decisions.
 */
export const admitKieSeedanceReferenceImage = async ({
  buffer,
  filename,
  mimeType,
  constraints = DEFAULT_IMAGE_CONSTRAINTS,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  constraints?: Partial<KieSeedanceImageConstraints>;
}): Promise<KieSeedanceReferenceImageAdmissionResult> => {
  const effectiveConstraints = {
    ...DEFAULT_IMAGE_CONSTRAINTS,
    ...constraints,
    targetBytes: Math.min(
      constraints.targetBytes ?? DEFAULT_IMAGE_CONSTRAINTS.targetBytes,
      constraints.maxBytes ?? DEFAULT_IMAGE_CONSTRAINTS.maxBytes
    ),
  };
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer, { animated: true, limitInputPixels: false }).metadata();
  } catch {
    throw new KieSeedanceImageAdmissionError(
      "Seedance reference image must be a readable still image."
    );
  }

  if ((metadata.pages ?? 1) > 1) {
    throw new KieSeedanceImageAdmissionError(
      "Seedance reference image must be a still image for automatic provider admission."
    );
  }

  const originalDimensions = readDimensions(metadata);
  if (!originalDimensions) {
    throw new KieSeedanceImageAdmissionError(
      "Seedance reference image dimensions could not be read."
    );
  }
  assertAspectWithinKieBounds(originalDimensions, effectiveConstraints);

  const passthroughMimeType = resolvePassthroughMimeType(mimeType);
  if (passthroughMimeType && buffer.length <= effectiveConstraints.maxBytes) {
    try {
      assertDimensionsWithinKieBounds(originalDimensions, effectiveConstraints);
      return {
        buffer,
        filename: replaceFileExtension(filename, passthroughMimeType),
        mimeType: passthroughMimeType,
        size: buffer.length,
        dimensions: originalDimensions,
        admission: {
          profile: "kie_seedance_reference_image",
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
    } catch {
      // Fall through to provider-facing normalization.
    }
  }

  const candidate = await chooseAdmittedImageCandidate({
    buffer,
    originalDimensions,
    originalMimeType: mimeType,
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
      profile: "kie_seedance_reference_image",
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
