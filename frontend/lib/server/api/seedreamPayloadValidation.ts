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
  "auto_3K",
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

const VIDEO_FILE_PATTERN = /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i;

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isClearlyVideoSource = (value: string): boolean =>
  /^data:video\//i.test(value) || value.startsWith("blob:") || VIDEO_FILE_PATTERN.test(value);

const readImageUrls = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];

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

export const validateSeedreamEditPayload = (payload: Record<string, unknown>): ValidationResult => {
  const prompt = asTrimmedString(payload.prompt);
  if (!prompt) {
    return {
      error: "Missing required prompt for Seedream edit generation.",
      detail: { field: "prompt" },
    };
  }

  const imageUrls = readImageUrls(payload.image_urls);
  if (!imageUrls.length) {
    return {
      error: "Seedream edit requires at least one reference image URL.",
      detail: { field: "image_urls", min: 1, max: 10 },
    };
  }
  if (imageUrls.length > 10) {
    return {
      error: "Seedream edit accepts at most 10 reference image URLs.",
      detail: { field: "image_urls", min: 1, max: 10 },
    };
  }

  const videoLikeImageUrl = imageUrls.find((url) => isClearlyVideoSource(url));
  if (videoLikeImageUrl) {
    return {
      error: "image_urls must only contain image sources.",
      detail: { field: "image_urls" },
    };
  }

  return validateSeedreamImageSizePayload(payload);
};
