/**
 * Kie Kling provider-admission rules for image reference bytes.
 * Converts ShortPulse-valid still images into Kling-compatible JPEG/PNG inputs.
 */
import path from "path";
import sharp, { type Metadata } from "sharp";
import type { ImageDimensions } from "../mediaDimensionMetadata";

export const KIE_KLING_REFERENCE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const KIE_KLING_REFERENCE_IMAGE_TARGET_BYTES = 9 * 1024 * 1024;
export const KIE_KLING_MIN_DIMENSION_PX = 300;

type KieKlingImageMimeType = "image/jpeg" | "image/png";

type KieKlingImageConstraints = {
  maxBytes: number;
  targetBytes: number;
  minDimensionPx: number;
};

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

const DEFAULT_IMAGE_CONSTRAINTS: KieKlingImageConstraints = {
  maxBytes: KIE_KLING_REFERENCE_IMAGE_MAX_BYTES,
  targetBytes: KIE_KLING_REFERENCE_IMAGE_TARGET_BYTES,
  minDimensionPx: KIE_KLING_MIN_DIMENSION_PX,
};

const JPEG_QUALITIES = [92, 84, 76, 68, 60, 52, 44, 36] as const;
const LONG_EDGE_LADDER = [
  4096, 3072, 2560, 2048, 1792, 1536, 1280, 1024, 896, 768, 640, 512, 384, 300,
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

const resolvePassthroughMimeType = (mimeType: string): KieKlingImageMimeType | null => {
  const normalized = normalizeMimeType(mimeType);
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/png") return "image/png";
  return null;
};

const assertDimensionsWithinKieBounds = (
  dimensions: ImageDimensions,
  constraints: KieKlingImageConstraints
): void => {
  if (
    dimensions.width < constraints.minDimensionPx ||
    dimensions.height < constraints.minDimensionPx
  ) {
    throw new KieKlingImageAdmissionError(
      "Kling reference image must be at least 300 px wide and 300 px tall."
    );
  }
};

const replaceFileExtension = (filename: string, mimeType: KieKlingImageMimeType): string => {
  const parsed = path.parse(filename.trim() || "kling-reference-image");
  const extension = mimeType === "image/png" ? ".png" : ".jpg";
  return `${parsed.name || "kling-reference-image"}${extension}`;
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
  mimeType: KieKlingImageMimeType;
  quality?: number;
}): Promise<{
  buffer: Buffer;
  dimensions: ImageDimensions;
  mimeType: KieKlingImageMimeType;
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
      : pipeline.flatten({ background: { r: 255, g: 255, b: 255 } }).jpeg({
          quality: quality ?? 84,
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
  constraints: KieKlingImageConstraints;
}) => {
  let bestCandidate: {
    buffer: Buffer;
    dimensions: ImageDimensions;
    mimeType: KieKlingImageMimeType;
  } | null = null;
  const mimePlans: Array<{
    mimeType: KieKlingImageMimeType;
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
          mimeType: KieKlingImageMimeType;
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

  throw new KieKlingImageAdmissionError(
    "Kling reference image is still over Kie's 10 MB image limit after admission."
  );
};

/**
 * Admits one Kling reference image for Kie's provider constraints.
 * Side effects: none; callers own provider upload and any storage decisions.
 */
export const admitKieKlingReferenceImage = async ({
  buffer,
  filename,
  mimeType,
  constraints = DEFAULT_IMAGE_CONSTRAINTS,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  constraints?: Partial<KieKlingImageConstraints>;
}): Promise<KieKlingReferenceImageAdmissionResult> => {
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
