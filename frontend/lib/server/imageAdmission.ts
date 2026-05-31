/**
 * Server-side product image admission authority.
 * Wraps the existing Sharp normalization path in a reusable typed admission contract.
 */
import sharp from "sharp";
import {
  IMAGE_ADMISSION_MAX_BYTES,
  IMAGE_ADMISSION_POLICY_ID,
  IMAGE_ADMISSION_POLICY_VERSION,
  IMAGE_ADMISSION_TARGET_BYTES,
  type ImageAdmissionMetadata,
  type ImageAdmissionStatus,
  type ImageAdmissionStrategy,
} from "../imageAdmissionPolicy";
import type { ImageDimensions } from "../mediaDimensionMetadata";
import {
  maybeNormalizeOversizedImageUpload,
  UnsupportedOversizedAnimatedImageError,
} from "./imageUploadNormalization";

export type { ImageAdmissionMetadata } from "../imageAdmissionPolicy";

export type ImageAdmissionRejectionReason =
  | "animated_over_cap"
  | "decode_failed"
  | "encode_failed"
  | "no_smaller_candidate"
  | "still_oversized";

export type ImageAdmissionAcceptedResult = {
  status: Exclude<ImageAdmissionStatus, "rejected">;
  buffer: Buffer;
  dimensions: ImageDimensions | null;
  metadata: ImageAdmissionMetadata;
  mimeType: string;
};

export type ImageAdmissionRejectedResult = {
  status: "rejected";
  metadata: ImageAdmissionMetadata;
  reason: ImageAdmissionRejectionReason;
  userMessage: string;
};

export type ImageAdmissionResult = ImageAdmissionAcceptedResult | ImageAdmissionRejectedResult;

type BuildAdmissionMetadataInput = {
  status: ImageAdmissionStatus;
  strategy: ImageAdmissionStrategy;
  originalBytes: number;
  admittedBytes: number | null;
  originalMimeType: string;
  admittedMimeType: string | null;
  originalDimensions: ImageDimensions | null;
  admittedDimensions: ImageDimensions | null;
  maxBytes: number;
  targetBytes: number;
  originalPreserved: boolean;
  originalStoragePath: string | null;
  admittedStoragePath: string | null;
};

const OVERSIZED_ANIMATED_IMAGE_MESSAGE =
  "Animated images over 25 MB are not auto-resized yet. Export a smaller animated file or a static frame and try again.";

const STILL_IMAGE_UNFIT_MESSAGE = "Image file is too large. ShortPulse accepts images up to 25 MB.";

const readImageDimensions = async (buffer: Buffer): Promise<ImageDimensions | null> => {
  try {
    const metadata = await sharp(buffer, { animated: true, limitInputPixels: false }).metadata();
    if (!metadata.width || !metadata.height) return null;
    return {
      width: metadata.width,
      height: metadata.height,
    };
  } catch {
    return null;
  }
};

const buildAdmissionMetadata = ({
  status,
  strategy,
  originalBytes,
  admittedBytes,
  originalMimeType,
  admittedMimeType,
  originalDimensions,
  admittedDimensions,
  maxBytes,
  targetBytes,
  originalPreserved,
  originalStoragePath,
  admittedStoragePath,
}: BuildAdmissionMetadataInput): ImageAdmissionMetadata => ({
  version: IMAGE_ADMISSION_POLICY_VERSION,
  status,
  policy: IMAGE_ADMISSION_POLICY_ID,
  max_bytes: maxBytes,
  target_bytes: targetBytes,
  original_bytes: originalBytes,
  admitted_bytes: admittedBytes,
  original_mime_type: originalMimeType,
  admitted_mime_type: admittedMimeType,
  original_width: originalDimensions?.width ?? null,
  original_height: originalDimensions?.height ?? null,
  admitted_width: admittedDimensions?.width ?? null,
  admitted_height: admittedDimensions?.height ?? null,
  strategy,
  original_preserved: originalPreserved,
  original_storage_path: originalStoragePath,
  admitted_storage_path: admittedStoragePath,
  supabase_transform_used: false,
});

const mapNormalizationFailureReason = (
  failureReason: string | null | undefined
): ImageAdmissionRejectionReason => {
  if (failureReason === "decode_failed") return "decode_failed";
  if (failureReason === "encode_failed") return "encode_failed";
  if (failureReason === "no_smaller_candidate") return "no_smaller_candidate";
  return "still_oversized";
};

/**
 * Admits a still-image buffer for ShortPulse product processing and generation use.
 * Side effects: none; callers own any storage writes after a successful result.
 */
export const admitImageBufferForProductUse = async ({
  buffer,
  mimeType,
  maxBytes = IMAGE_ADMISSION_MAX_BYTES,
  targetBytes = IMAGE_ADMISSION_TARGET_BYTES,
  originalPreserved = false,
  originalStoragePath = null,
  admittedStoragePath = null,
}: {
  buffer: Buffer;
  mimeType: string;
  maxBytes?: number;
  targetBytes?: number;
  originalPreserved?: boolean;
  originalStoragePath?: string | null;
  admittedStoragePath?: string | null;
}): Promise<ImageAdmissionResult> => {
  const effectiveTargetBytes = Math.min(targetBytes, maxBytes);
  const originalDimensions = await readImageDimensions(buffer);

  if (buffer.length <= maxBytes) {
    return {
      status: "not_required",
      buffer,
      dimensions: originalDimensions,
      metadata: buildAdmissionMetadata({
        status: "not_required",
        strategy: "passthrough",
        originalBytes: buffer.length,
        admittedBytes: buffer.length,
        originalMimeType: mimeType,
        admittedMimeType: mimeType,
        originalDimensions,
        admittedDimensions: originalDimensions,
        maxBytes,
        targetBytes: effectiveTargetBytes,
        originalPreserved,
        originalStoragePath,
        admittedStoragePath,
      }),
      mimeType,
    };
  }

  try {
    const normalized = await maybeNormalizeOversizedImageUpload({
      buffer,
      mimeType,
      maxBytes,
    });

    const admittedDimensions =
      normalized.dimensions ?? (normalized.buffer === buffer ? originalDimensions : null);

    if (normalized.buffer.length <= maxBytes && normalized.metadata?.applied) {
      return {
        status: "admitted",
        buffer: normalized.buffer,
        dimensions: admittedDimensions,
        metadata: buildAdmissionMetadata({
          status: "admitted",
          strategy: "server_sharp",
          originalBytes: buffer.length,
          admittedBytes: normalized.buffer.length,
          originalMimeType: mimeType,
          admittedMimeType: normalized.mimeType,
          originalDimensions,
          admittedDimensions,
          maxBytes,
          targetBytes: effectiveTargetBytes,
          originalPreserved,
          originalStoragePath,
          admittedStoragePath,
        }),
        mimeType: normalized.mimeType,
      };
    }

    return {
      status: "rejected",
      reason: mapNormalizationFailureReason(normalized.metadata?.failure_reason),
      userMessage: STILL_IMAGE_UNFIT_MESSAGE,
      metadata: buildAdmissionMetadata({
        status: "rejected",
        strategy: "rejected_unfit",
        originalBytes: buffer.length,
        admittedBytes: null,
        originalMimeType: mimeType,
        admittedMimeType: null,
        originalDimensions,
        admittedDimensions: null,
        maxBytes,
        targetBytes: effectiveTargetBytes,
        originalPreserved,
        originalStoragePath,
        admittedStoragePath,
      }),
    };
  } catch (error) {
    if (error instanceof UnsupportedOversizedAnimatedImageError) {
      return {
        status: "rejected",
        reason: "animated_over_cap",
        userMessage: OVERSIZED_ANIMATED_IMAGE_MESSAGE,
        metadata: buildAdmissionMetadata({
          status: "rejected",
          strategy: "rejected_animated_over_cap",
          originalBytes: buffer.length,
          admittedBytes: null,
          originalMimeType: mimeType,
          admittedMimeType: null,
          originalDimensions,
          admittedDimensions: null,
          maxBytes,
          targetBytes: effectiveTargetBytes,
          originalPreserved,
          originalStoragePath,
          admittedStoragePath,
        }),
      };
    }
    throw error;
  }
};
