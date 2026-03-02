/**
 * Seedream image_size helpers.
 * Sends exact ratios via custom dimensions when no native enum exists.
 */
import {
  isSeedreamAutoImageSize,
  SEEDREAM_AUTO_2K_IMAGE_SIZE,
  SEEDREAM_AUTO_3K_IMAGE_SIZE,
  SEEDREAM_AUTO_4K_IMAGE_SIZE,
} from "./imageResolution";

export type SeedreamImageSize = string | { width: number; height: number };

const nativeImageSizeByAspect: Record<string, string> = {
  "1:1": "square",
  "4:3": "landscape_4_3",
  "3:4": "portrait_4_3",
  "16:9": "landscape_16_9",
  "9:16": "portrait_16_9",
};

const customImageSizeByAspect: Record<string, { width: number; height: number }> = {
  "5:4": { width: 2400, height: 1920 },
  "4:5": { width: 1920, height: 2400 },
  "3:2": { width: 2880, height: 1920 },
  "2:3": { width: 1920, height: 2880 },
  "21:9": { width: 4032, height: 1728 },
};

const AUTO_IMAGE_AREA_BY_RESOLUTION: Record<
  | typeof SEEDREAM_AUTO_2K_IMAGE_SIZE
  | typeof SEEDREAM_AUTO_3K_IMAGE_SIZE
  | typeof SEEDREAM_AUTO_4K_IMAGE_SIZE,
  number
> = {
  [SEEDREAM_AUTO_2K_IMAGE_SIZE]: 3_686_400,
  [SEEDREAM_AUTO_3K_IMAGE_SIZE]: 5_308_416,
  [SEEDREAM_AUTO_4K_IMAGE_SIZE]: 8_294_400,
};

const MIN_IMAGE_SIDE = 256;
const MAX_IMAGE_SIDE = 4096;

const roundToNearestEven = (value: number): number => {
  if (!Number.isFinite(value)) return MIN_IMAGE_SIDE;
  return Math.max(2, Math.round(value / 2) * 2);
};

const clampSide = (value: number): number =>
  Math.min(MAX_IMAGE_SIDE, Math.max(MIN_IMAGE_SIDE, roundToNearestEven(value)));

const resolveAspectRatio = (aspect: string): number => {
  const [widthToken, heightToken] = aspect.split(":");
  const width = Number(widthToken?.trim());
  const height = Number(heightToken?.trim());
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 1;
  }
  return width / height;
};

const resolveSeedreamAutoSize = (
  aspect: string,
  requestedResolution:
    | typeof SEEDREAM_AUTO_2K_IMAGE_SIZE
    | typeof SEEDREAM_AUTO_3K_IMAGE_SIZE
    | typeof SEEDREAM_AUTO_4K_IMAGE_SIZE
): { width: number; height: number } => {
  const area = AUTO_IMAGE_AREA_BY_RESOLUTION[requestedResolution];
  const ratio = resolveAspectRatio(aspect);
  let width = roundToNearestEven(Math.sqrt(area * ratio));
  let height = roundToNearestEven(Math.sqrt(area / ratio));

  if (width > MAX_IMAGE_SIDE) {
    width = MAX_IMAGE_SIDE;
    height = roundToNearestEven(width / ratio);
  }
  if (height > MAX_IMAGE_SIDE) {
    height = MAX_IMAGE_SIDE;
    width = roundToNearestEven(height * ratio);
  }
  if (width < MIN_IMAGE_SIDE) {
    width = MIN_IMAGE_SIDE;
    height = roundToNearestEven(width / ratio);
  }
  if (height < MIN_IMAGE_SIDE) {
    height = MIN_IMAGE_SIDE;
    width = roundToNearestEven(height * ratio);
  }

  return {
    width: clampSide(width),
    height: clampSide(height),
  };
};

/**
 * Resolves a Seedream-compatible image_size for the selected aspect/resolution.
 */
export const resolveSeedreamImageSize = (
  aspect: string,
  requestedResolution?: string | null
): SeedreamImageSize => {
  if (isSeedreamAutoImageSize(requestedResolution)) {
    return resolveSeedreamAutoSize(aspect, requestedResolution);
  }

  const normalizedAspect = aspect.trim();
  if (nativeImageSizeByAspect[normalizedAspect]) {
    return nativeImageSizeByAspect[normalizedAspect];
  }

  if (customImageSizeByAspect[normalizedAspect]) {
    return customImageSizeByAspect[normalizedAspect];
  }

  return "square";
};
