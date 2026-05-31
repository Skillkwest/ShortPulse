/**
 * Shared GPT Image 2 request-shaping and pricing constants.
 * Keeps aspect -> size and quality normalization aligned across UI and server lanes.
 */
export const OPENAI_GPT_IMAGE_2_MODEL_ID = "gpt-image-2";
export const OPENAI_GPT_IMAGE_2_DEFAULT_SIZE = "2048x2048";
export const OPENAI_GPT_IMAGE_2_DEFAULT_QUALITY = "medium";
export const OPENAI_GPT_IMAGE_2_DEFAULT_INPUT_FIDELITY = "high";
export const OPENAI_GPT_IMAGE_2_DEFAULT_MODERATION = "low";

export const OPENAI_GPT_IMAGE_2_UI_ALLOWED_ASPECTS = ["9:16", "4:5", "1:1", "5:4", "16:9"] as const;
export const OPENAI_GPT_IMAGE_2_UI_ALLOWED_RESOLUTIONS = ["1K", "2K", "4K"] as const;
export const OPENAI_GPT_IMAGE_2_ALLOWED_SIZES = [
  "1008x1792",
  "1024x1024",
  "1024x1280",
  "1024x1536",
  "1152x2048",
  "1280x1024",
  "1536x1024",
  "1664x2080",
  "1792x1008",
  "2048x1152",
  "2048x2048",
  "2080x1664",
  "2160x3840",
  "2560x3200",
  "2880x2880",
  "3200x2560",
  "3840x2160",
] as const;

export type OpenAiImage2UiAspect = (typeof OPENAI_GPT_IMAGE_2_UI_ALLOWED_ASPECTS)[number];
export type OpenAiImage2ResolutionPreset =
  (typeof OPENAI_GPT_IMAGE_2_UI_ALLOWED_RESOLUTIONS)[number];
export type OpenAiImage2PricingSize = "1024x1024" | "1024x1536" | "1536x1024";
export type OpenAiImage2Size = (typeof OPENAI_GPT_IMAGE_2_ALLOWED_SIZES)[number];
export type OpenAiImage2Quality = "low" | "medium" | "high";
export type OpenAiImage2InputFidelity = "high" | "low";
export type OpenAiImage2Moderation = "auto" | "low";

export const OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD: Record<
  OpenAiImage2PricingSize,
  Record<OpenAiImage2Quality, number>
> = {
  "1024x1024": {
    low: 0.006,
    medium: 0.053,
    high: 0.211,
  },
  "1024x1536": {
    low: 0.005,
    medium: 0.041,
    high: 0.165,
  },
  "1536x1024": {
    low: 0.005,
    medium: 0.041,
    high: 0.165,
  },
};

export const OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS: Record<
  OpenAiImage2PricingSize,
  { width: number; height: number }
> = {
  "1024x1024": { width: 1024, height: 1024 },
  "1024x1536": { width: 1024, height: 1536 },
  "1536x1024": { width: 1536, height: 1024 },
};

export const OPENAI_GPT_IMAGE_2_ALLOWED_SIZE_TO_DIMENSIONS: Record<
  OpenAiImage2Size,
  { width: number; height: number }
> = {
  "1008x1792": { width: 1008, height: 1792 },
  "1024x1024": { width: 1024, height: 1024 },
  "1024x1280": { width: 1024, height: 1280 },
  "1024x1536": { width: 1024, height: 1536 },
  "1152x2048": { width: 1152, height: 2048 },
  "1280x1024": { width: 1280, height: 1024 },
  "1536x1024": { width: 1536, height: 1024 },
  "1664x2080": { width: 1664, height: 2080 },
  "1792x1008": { width: 1792, height: 1008 },
  "2048x1152": { width: 2048, height: 1152 },
  "2048x2048": { width: 2048, height: 2048 },
  "2080x1664": { width: 2080, height: 1664 },
  "2160x3840": { width: 2160, height: 3840 },
  "2560x3200": { width: 2560, height: 3200 },
  "2880x2880": { width: 2880, height: 2880 },
  "3200x2560": { width: 3200, height: 2560 },
  "3840x2160": { width: 3840, height: 2160 },
};

const OPENAI_GPT_IMAGE_2_INPUT_IMAGE_PRICE_PER_MILLION_TOKENS_USD = 8;
const OPENAI_GPT_IMAGE_FAMILY_INPUT_BASE_TOKENS = 65;
const OPENAI_GPT_IMAGE_FAMILY_INPUT_TILE_TOKENS = 129;
const OPENAI_GPT_IMAGE_FAMILY_HIGH_FIDELITY_SQUARE_BONUS_TOKENS = 4160;
const OPENAI_GPT_IMAGE_FAMILY_HIGH_FIDELITY_RECT_BONUS_TOKENS = 6240;

const OPENAI_GPT_IMAGE_2_ASPECT_TO_PRICING_SIZE: Record<string, OpenAiImage2PricingSize> = {
  auto: "1024x1024",
  "1:1": "1024x1024",
  "4:5": "1024x1536",
  "3:4": "1024x1536",
  "2:3": "1024x1536",
  "9:16": "1024x1536",
  "5:4": "1536x1024",
  "4:3": "1536x1024",
  "3:2": "1536x1024",
  "16:9": "1536x1024",
  "21:9": "1536x1024",
};

const OPENAI_GPT_IMAGE_2_OUTPUT_SIZE_MATRIX: Record<
  OpenAiImage2ResolutionPreset,
  Record<OpenAiImage2UiAspect, OpenAiImage2Size>
> = {
  "1K": {
    "9:16": "1008x1792",
    "4:5": "1024x1280",
    "1:1": "1024x1024",
    "5:4": "1280x1024",
    "16:9": "1792x1008",
  },
  "2K": {
    "9:16": "1152x2048",
    "4:5": "1664x2080",
    "1:1": "2048x2048",
    "5:4": "2080x1664",
    "16:9": "2048x1152",
  },
  "4K": {
    "9:16": "2160x3840",
    "4:5": "2560x3200",
    "1:1": "2880x2880",
    "5:4": "3200x2560",
    "16:9": "3840x2160",
  },
};

const OPENAI_GPT_IMAGE_2_SIZE_TO_ASPECT: Partial<Record<OpenAiImage2Size, OpenAiImage2UiAspect>> = {
  "1008x1792": "9:16",
  "1024x1024": "1:1",
  "1024x1280": "4:5",
  "1024x1536": "9:16",
  "1152x2048": "9:16",
  "1280x1024": "5:4",
  "1536x1024": "16:9",
  "1664x2080": "4:5",
  "1792x1008": "16:9",
  "2048x1152": "16:9",
  "2048x2048": "1:1",
  "2080x1664": "5:4",
  "2160x3840": "9:16",
  "2560x3200": "4:5",
  "2880x2880": "1:1",
  "3200x2560": "5:4",
  "3840x2160": "16:9",
};

const OPENAI_GPT_IMAGE_2_QUALITY_TO_RESOLUTION_PRESET: Record<
  OpenAiImage2Quality,
  OpenAiImage2ResolutionPreset
> = {
  low: "1K",
  medium: "2K",
  high: "4K",
};

const OPENAI_GPT_IMAGE_2_RESOLUTION_PRESET_TO_QUALITY: Record<
  OpenAiImage2ResolutionPreset,
  OpenAiImage2Quality
> = {
  "1K": "low",
  "2K": "medium",
  "4K": "high",
};

/**
 * Maps an AI Studio aspect selection onto the workbook-backed GPT Image 2 pricing size matrix.
 */
export const resolveOpenAiGptImage2PricingSizeForAspect = (
  aspect: string | null | undefined
): OpenAiImage2PricingSize => {
  const normalized = aspect?.trim().toLowerCase();
  if (!normalized) return "1024x1024";
  return OPENAI_GPT_IMAGE_2_ASPECT_TO_PRICING_SIZE[normalized] ?? "1024x1024";
};

/**
 * Backward-compatible alias for the pricing-size resolver.
 */
export const resolveOpenAiGptImage2SizeForAspect = resolveOpenAiGptImage2PricingSizeForAspect;

/**
 * Returns the user-facing GPT Image 2 resolution preset from legacy or current values.
 */
export const normalizeOpenAiGptImage2ResolutionPreset = (
  value: string | null | undefined
): OpenAiImage2ResolutionPreset => {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "1008x1792" ||
    normalized === "1024x1024" ||
    normalized === "1024x1280" ||
    normalized === "1024x1536" ||
    normalized === "1280x1024" ||
    normalized === "1536x1024" ||
    normalized === "1792x1008" ||
    normalized === "1k" ||
    normalized === "low"
  ) {
    return "1K";
  }
  if (
    normalized === "1152x2048" ||
    normalized === "1664x2080" ||
    normalized === "2048x1152" ||
    normalized === "2048x2048" ||
    normalized === "2080x1664" ||
    normalized === "2k" ||
    normalized === "medium"
  ) {
    return "2K";
  }
  if (
    normalized === "2160x3840" ||
    normalized === "2560x3200" ||
    normalized === "2880x2880" ||
    normalized === "3200x2560" ||
    normalized === "3840x2160" ||
    normalized === "4k" ||
    normalized === "high"
  ) {
    return "4K";
  }
  return "2K";
};

/**
 * Normalizes the GPT Image 2 quality tier from legacy or current resolution-like inputs.
 */
export const normalizeOpenAiGptImage2Quality = (
  value: string | null | undefined
): OpenAiImage2Quality => {
  return OPENAI_GPT_IMAGE_2_RESOLUTION_PRESET_TO_QUALITY[
    normalizeOpenAiGptImage2ResolutionPreset(value)
  ];
};

/**
 * Normalizes GPT Image 2 aspect choices to the five app-supported UI aspects.
 */
export const normalizeOpenAiGptImage2UiAspect = (
  value: string | null | undefined
): OpenAiImage2UiAspect => {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "9:16":
      return "9:16";
    case "4:5":
      return "4:5";
    case "5:4":
      return "5:4";
    case "16:9":
      return "16:9";
    default:
      return "1:1";
  }
};

/**
 * Resolves the exact GPT Image 2 output size to send to OpenAI for one aspect + resolution choice.
 */
export const resolveOpenAiGptImage2OutputSize = ({
  aspect,
  resolution,
}: {
  aspect: string | null | undefined;
  resolution: string | null | undefined;
}): OpenAiImage2Size => {
  const normalizedAspect = normalizeOpenAiGptImage2UiAspect(aspect);
  const preset = normalizeOpenAiGptImage2ResolutionPreset(resolution);
  return OPENAI_GPT_IMAGE_2_OUTPUT_SIZE_MATRIX[preset][normalizedAspect];
};

/**
 * Returns the app-supported aspect token for a GPT Image 2 size when it is known exactly.
 */
export const resolveOpenAiGptImage2AspectForSize = (
  size: string | null | undefined
): OpenAiImage2UiAspect | null => {
  const normalized = size?.trim().toLowerCase() as OpenAiImage2Size | undefined;
  if (!normalized) return null;
  return OPENAI_GPT_IMAGE_2_SIZE_TO_ASPECT[normalized] ?? null;
};

/**
 * Returns whether the provided size is one of the allowed GPT Image 2 output sizes.
 */
export const isOpenAiGptImage2Size = (value: unknown): value is OpenAiImage2Size => {
  if (typeof value !== "string") return false;
  return value.trim().toLowerCase() in OPENAI_GPT_IMAGE_2_ALLOWED_SIZE_TO_DIMENSIONS;
};

/**
 * Returns whether the provided aspect is one of the five GPT Image 2 UI aspects.
 */
export const isOpenAiGptImage2UiAspect = (value: string | null | undefined): boolean => {
  const normalized = value?.trim();
  return (
    normalized === "9:16" ||
    normalized === "4:5" ||
    normalized === "1:1" ||
    normalized === "5:4" ||
    normalized === "16:9"
  );
};

/**
 * Normalizes edit fidelity inputs used by the OpenAI Images edit lane.
 */
export const normalizeOpenAiGptImage2InputFidelity = (
  value: string | null | undefined
): OpenAiImage2InputFidelity => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "low" || normalized === "high") {
    return normalized;
  }
  return OPENAI_GPT_IMAGE_2_DEFAULT_INPUT_FIDELITY;
};

const resolveGptImageFamilyScaledInputDimensions = (
  width: number,
  height: number
): { width: number; height: number } => {
  let scaledWidth = width;
  let scaledHeight = height;
  const longestSide = Math.max(scaledWidth, scaledHeight);
  if (longestSide > 2048) {
    const downscale = 2048 / longestSide;
    scaledWidth *= downscale;
    scaledHeight *= downscale;
  }
  const shortestSide = Math.min(scaledWidth, scaledHeight);
  if (shortestSide <= 0) {
    return { width, height };
  }
  const shortestSideScale = 512 / shortestSide;
  return {
    width: scaledWidth * shortestSideScale,
    height: scaledHeight * shortestSideScale,
  };
};

/**
 * Computes one deterministic input-image USD charge for GPT Image 2 edits.
 * Uses the GPT image family tile-based reference-image sizing rules as a stable request-shape proxy.
 */
export const resolveOpenAiGptImage2InputImageUsd = ({
  size,
  inputFidelity = OPENAI_GPT_IMAGE_2_DEFAULT_INPUT_FIDELITY,
}: {
  size: OpenAiImage2PricingSize;
  inputFidelity?: OpenAiImage2InputFidelity;
}): number => {
  const dimensions = OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS[size];
  const scaled = resolveGptImageFamilyScaledInputDimensions(dimensions.width, dimensions.height);
  const tileCount = Math.max(1, Math.ceil(scaled.width / 512) * Math.ceil(scaled.height / 512));
  const baseTokens =
    OPENAI_GPT_IMAGE_FAMILY_INPUT_BASE_TOKENS +
    tileCount * OPENAI_GPT_IMAGE_FAMILY_INPUT_TILE_TOKENS;
  const highFidelityBonusTokens =
    inputFidelity === "high"
      ? dimensions.width === dimensions.height
        ? OPENAI_GPT_IMAGE_FAMILY_HIGH_FIDELITY_SQUARE_BONUS_TOKENS
        : OPENAI_GPT_IMAGE_FAMILY_HIGH_FIDELITY_RECT_BONUS_TOKENS
      : 0;
  const totalTokens = baseTokens + highFidelityBonusTokens;
  return (totalTokens * OPENAI_GPT_IMAGE_2_INPUT_IMAGE_PRICE_PER_MILLION_TOKENS_USD) / 1_000_000;
};
