/**
 * Validation helpers for Seedream submit payloads.
 * Guards image_size shape so API drift is surfaced early.
 */

type ValidationResult = {
  error: string;
  detail?: unknown;
} | null;

const ALLOWED_SEEDREAM_IMAGE_SIZES = new Set([
  "square_hd",
  "square",
  "portrait_4_3",
  "portrait_16_9",
  "landscape_4_3",
  "landscape_16_9",
  "auto_2K",
  "auto_4K",
]);

const MIN_CUSTOM_SIZE = 256;
const MAX_CUSTOM_SIZE = 4096;

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

export const validateSeedreamImageSize = (imageSize: unknown): ValidationResult => {
  if (imageSize == null) return null;

  if (typeof imageSize === "string") {
    const trimmed = imageSize.trim();
    if (!trimmed.length) {
      return {
        error: "Invalid image_size for Seedream generation.",
        detail: { field: "image_size", reason: "empty_string" },
      };
    }
    if (ALLOWED_SEEDREAM_IMAGE_SIZES.has(trimmed)) {
      return null;
    }
    return {
      error: "Invalid image_size for Seedream generation.",
      detail: { field: "image_size", allowed: Array.from(ALLOWED_SEEDREAM_IMAGE_SIZES) },
    };
  }

  if (!isObjectRecord(imageSize)) {
    return {
      error: "Invalid image_size for Seedream generation.",
      detail: {
        field: "image_size",
        allowed: [...Array.from(ALLOWED_SEEDREAM_IMAGE_SIZES), "{ width, height }"],
      },
    };
  }

  const width = asFiniteNumber(imageSize.width);
  const height = asFiniteNumber(imageSize.height);
  if (!width || !height) {
    return {
      error: "Invalid image_size for Seedream generation.",
      detail: { field: "image_size", required: ["width", "height"] },
    };
  }

  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return {
      error: "Invalid image_size for Seedream generation.",
      detail: { field: "image_size", reason: "width_height_must_be_integers" },
    };
  }

  if (
    width < MIN_CUSTOM_SIZE ||
    height < MIN_CUSTOM_SIZE ||
    width > MAX_CUSTOM_SIZE ||
    height > MAX_CUSTOM_SIZE
  ) {
    return {
      error: "Invalid image_size for Seedream generation.",
      detail: {
        field: "image_size",
        width,
        height,
        min: MIN_CUSTOM_SIZE,
        max: MAX_CUSTOM_SIZE,
      },
    };
  }

  return null;
};

export const validateSeedreamImageSizePayload = (
  payload: Record<string, unknown>
): ValidationResult => {
  return validateSeedreamImageSize(payload.image_size);
};
