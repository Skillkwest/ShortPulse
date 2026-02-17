/**
 * Seedream image_size helpers.
 * Sends exact ratios via custom dimensions when no native enum exists.
 */
import { isSeedreamAutoImageSize } from "./imageResolution";

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

/**
 * Resolves a Seedream-compatible image_size for the selected aspect/resolution.
 */
export const resolveSeedreamImageSize = (
  aspect: string,
  requestedResolution?: string | null
): SeedreamImageSize => {
  if (isSeedreamAutoImageSize(requestedResolution)) {
    return requestedResolution;
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
