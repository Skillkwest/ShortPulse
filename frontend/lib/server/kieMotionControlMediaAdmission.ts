/**
 * Kie Motion Control provider-admission rules for media bytes.
 * Converts ShortPulse-valid character images into Kie-compatible provider inputs.
 */
import path from "path";
import sharp, { type Metadata } from "sharp";
import type { ImageDimensions } from "../mediaDimensionMetadata";

export const KIE_MOTION_CONTROL_CHARACTER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const KIE_MOTION_CONTROL_CHARACTER_IMAGE_TARGET_BYTES = 9 * 1024 * 1024;
export const KIE_MOTION_CONTROL_MIN_DIMENSION_PX = 341;
export const KIE_MOTION_CONTROL_MIN_ASPECT_RATIO = 2 / 5;
export const KIE_MOTION_CONTROL_MAX_ASPECT_RATIO = 5 / 2;

type KieMotionControlImageMimeType = "image/jpeg" | "image/png";

type KieMotionControlImageConstraints = {
  maxBytes: number;
  targetBytes: number;
  minDimensionPx: number;
  minAspectRatio: number;
  maxAspectRatio: number;
};

export type KieMotionControlCharacterImageAdmissionResult = {
  buffer: Buffer;
  filename: string;
  mimeType: KieMotionControlImageMimeType;
  size: number;
  dimensions: ImageDimensions;
  admission: {
    profile: "kie_motion_control_character_image";
    status: "passthrough" | "admitted";
    originalBytes: number;
    admittedBytes: number;
    originalMimeType: string;
    admittedMimeType: KieMotionControlImageMimeType;
    originalDimensions: ImageDimensions;
    admittedDimensions: ImageDimensions;
    supabaseTransformUsed: false;
  };
};

export class KieMotionControlMediaAdmissionError extends Error {
  readonly statusCode: number;
  readonly details: string;

  constructor(details: string, statusCode = 400) {
    super("Motion Control media cannot be admitted for Kie.");
    this.name = "KieMotionControlMediaAdmissionError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

const DEFAULT_IMAGE_CONSTRAINTS: KieMotionControlImageConstraints = {
  maxBytes: KIE_MOTION_CONTROL_CHARACTER_IMAGE_MAX_BYTES,
  targetBytes: KIE_MOTION_CONTROL_CHARACTER_IMAGE_TARGET_BYTES,
  minDimensionPx: KIE_MOTION_CONTROL_MIN_DIMENSION_PX,
  minAspectRatio: KIE_MOTION_CONTROL_MIN_ASPECT_RATIO,
  maxAspectRatio: KIE_MOTION_CONTROL_MAX_ASPECT_RATIO,
};

const JPEG_QUALITIES = [92, 84, 76, 68, 60, 52, 44, 36] as const;
const LONG_EDGE_LADDER = [
  4096, 3072, 2560, 2048, 1792, 1536, 1280, 1024, 896, 768, 640, 512, 384,
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

const assertDimensionsWithinKieBounds = (
  dimensions: ImageDimensions,
  constraints: KieMotionControlImageConstraints
): void => {
  if (
    dimensions.width < constraints.minDimensionPx ||
    dimensions.height < constraints.minDimensionPx
  ) {
    throw new KieMotionControlMediaAdmissionError(
      "Motion Control character image must be at least 341 px wide and 341 px tall."
    );
  }

  const aspectRatio = dimensions.width / dimensions.height;
  if (aspectRatio < constraints.minAspectRatio || aspectRatio > constraints.maxAspectRatio) {
    throw new KieMotionControlMediaAdmissionError(
      "Motion Control character image aspect ratio must be between 2:5 and 5:2."
    );
  }
};

const resolvePassthroughMimeType = (mimeType: string): KieMotionControlImageMimeType | null => {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/png") return "image/png";
  return null;
};

const replaceFileExtension = (
  filename: string,
  mimeType: KieMotionControlImageMimeType
): string => {
  const parsed = path.parse(filename.trim() || "character-image");
  const extension = mimeType === "image/png" ? ".png" : ".jpg";
  return `${parsed.name || "character-image"}${extension}`;
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
  mimeType: KieMotionControlImageMimeType;
  quality?: number;
}): Promise<{
  buffer: Buffer;
  dimensions: ImageDimensions;
  mimeType: KieMotionControlImageMimeType;
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
      : pipeline
          .flatten({ background: { r: 255, g: 255, b: 255 } })
          .jpeg({ quality: quality ?? 84, mozjpeg: true });
  const { data, info } = await encoded.toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) {
    throw new KieMotionControlMediaAdmissionError(
      "Motion Control character image could not be decoded."
    );
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
  constraints: KieMotionControlImageConstraints;
}) => {
  let bestCandidate: {
    buffer: Buffer;
    dimensions: ImageDimensions;
    mimeType: KieMotionControlImageMimeType;
  } | null = null;
  const mimePlans: Array<{
    mimeType: KieMotionControlImageMimeType;
    qualities: readonly number[];
  }> = hasAlpha
    ? [
        { mimeType: "image/png", qualities: [0] },
        { mimeType: "image/jpeg", qualities: JPEG_QUALITIES },
      ]
    : [{ mimeType: "image/jpeg", qualities: JPEG_QUALITIES }];

  for (const longEdge of buildLongEdgeCandidates(originalDimensions)) {
    for (const plan of mimePlans) {
      for (const quality of plan.qualities) {
        let candidate: {
          buffer: Buffer;
          dimensions: ImageDimensions;
          mimeType: KieMotionControlImageMimeType;
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

  throw new KieMotionControlMediaAdmissionError(
    "Motion Control character image is still over Kie's 10 MB image limit after admission."
  );
};

/**
 * Admits one Motion Control character image for Kie's provider constraints.
 * Side effects: none; callers own provider upload and any storage decisions.
 */
export const admitKieMotionControlCharacterImage = async ({
  buffer,
  filename,
  mimeType,
  constraints = DEFAULT_IMAGE_CONSTRAINTS,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  constraints?: Partial<KieMotionControlImageConstraints>;
}): Promise<KieMotionControlCharacterImageAdmissionResult> => {
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
    throw new KieMotionControlMediaAdmissionError(
      "Motion Control character image must be a readable still image."
    );
  }

  if ((metadata.pages ?? 1) > 1) {
    throw new KieMotionControlMediaAdmissionError(
      "Motion Control character image must be a still JPEG or PNG image."
    );
  }

  const originalDimensions = readDimensions(metadata);
  if (!originalDimensions) {
    throw new KieMotionControlMediaAdmissionError(
      "Motion Control character image dimensions could not be read."
    );
  }
  assertDimensionsWithinKieBounds(originalDimensions, effectiveConstraints);

  const passthroughMimeType = resolvePassthroughMimeType(mimeType);
  if (passthroughMimeType && buffer.length <= effectiveConstraints.maxBytes) {
    return {
      buffer,
      filename: replaceFileExtension(filename, passthroughMimeType),
      mimeType: passthroughMimeType,
      size: buffer.length,
      dimensions: originalDimensions,
      admission: {
        profile: "kie_motion_control_character_image",
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
      profile: "kie_motion_control_character_image",
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
