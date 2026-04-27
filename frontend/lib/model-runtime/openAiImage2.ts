/**
 * Shared GPT Image 2 request-shaping and pricing constants.
 * Keeps aspect -> size and quality normalization aligned across UI and server lanes.
 */
export const OPENAI_GPT_IMAGE_2_MODEL_ID = "gpt-image-2";
export const OPENAI_GPT_IMAGE_2_DEFAULT_SIZE = "1024x1024";
export const OPENAI_GPT_IMAGE_2_DEFAULT_QUALITY = "medium";

export type OpenAiImage2Size = "1024x1024" | "1024x1536" | "1536x1024";
export type OpenAiImage2Quality = "low" | "medium" | "high";

export const OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD: Record<
  OpenAiImage2Size,
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
  OpenAiImage2Size,
  { width: number; height: number }
> = {
  "1024x1024": { width: 1024, height: 1024 },
  "1024x1536": { width: 1024, height: 1536 },
  "1536x1024": { width: 1536, height: 1024 },
};

const OPENAI_GPT_IMAGE_2_ASPECT_TO_SIZE: Record<string, OpenAiImage2Size> = {
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

/**
 * Maps an AI Studio aspect selection onto the supported GPT Image 2 size matrix.
 */
export const resolveOpenAiGptImage2SizeForAspect = (
  aspect: string | null | undefined
): OpenAiImage2Size => {
  const normalized = aspect?.trim().toLowerCase();
  if (!normalized) return OPENAI_GPT_IMAGE_2_DEFAULT_SIZE;
  return OPENAI_GPT_IMAGE_2_ASPECT_TO_SIZE[normalized] ?? OPENAI_GPT_IMAGE_2_DEFAULT_SIZE;
};

/**
 * Normalizes quality-like inputs used by the current image-resolution control.
 */
export const normalizeOpenAiGptImage2Quality = (
  value: string | null | undefined
): OpenAiImage2Quality => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") {
    return normalized;
  }
  return OPENAI_GPT_IMAGE_2_DEFAULT_QUALITY;
};
