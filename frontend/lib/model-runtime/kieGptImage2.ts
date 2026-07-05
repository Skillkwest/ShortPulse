import {
  KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID,
  KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID,
} from "./providerModelIds";

export const KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_PROVIDER_MODEL_ID = "gpt-image-2-text-to-image";
export const KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_PROVIDER_MODEL_ID = "gpt-image-2-image-to-image";

export const KIE_GPT_IMAGE_2_ALLOWED_ASPECTS = [
  "auto",
  "1:1",
  "3:2",
  "2:3",
  "4:3",
  "3:4",
  "5:4",
  "4:5",
  "16:9",
  "9:16",
  "2:1",
  "1:2",
  "3:1",
  "1:3",
  "21:9",
  "9:21",
] as const;

export const KIE_GPT_IMAGE_2_ALLOWED_RESOLUTIONS = ["1K", "2K", "4K"] as const;
export const KIE_GPT_IMAGE_2_2K_4K_UNSUPPORTED_ASPECTS = [
  "5:4",
  "4:5",
  "3:1",
  "1:3",
  "9:21",
] as const;

export const KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_ALLOWED_ASPECTS = KIE_GPT_IMAGE_2_ALLOWED_ASPECTS;
export const KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_ALLOWED_ASPECTS = KIE_GPT_IMAGE_2_ALLOWED_ASPECTS;
export const KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_ALLOWED_RESOLUTIONS =
  KIE_GPT_IMAGE_2_ALLOWED_RESOLUTIONS;
export const KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_ALLOWED_RESOLUTIONS =
  KIE_GPT_IMAGE_2_ALLOWED_RESOLUTIONS;

export type KieGptImage2AspectRatio = (typeof KIE_GPT_IMAGE_2_ALLOWED_ASPECTS)[number];
export type KieGptImage2Resolution = (typeof KIE_GPT_IMAGE_2_ALLOWED_RESOLUTIONS)[number];
export type KieGptImage2Size = Exclude<KieGptImage2AspectRatio, "auto">;

export const KIE_GPT_IMAGE_2_DEFAULT_ASPECT: KieGptImage2AspectRatio = "auto";
export const KIE_GPT_IMAGE_2_DEFAULT_RESOLUTION: KieGptImage2Resolution = "1K";
export const KIE_GPT_IMAGE_2_MAX_PROMPT_CHARS = 20_000;
export const KIE_GPT_IMAGE_2_MAX_INPUT_IMAGES = 16;
export const KIE_GPT_IMAGE_2_ENABLE_SAFETY_CHECKER = false;
export const KIE_GPT_IMAGE_2_SAFETY_TOLERANCE = 5;

export const KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_DEFAULT_ASPECT = KIE_GPT_IMAGE_2_DEFAULT_ASPECT;
export const KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_DEFAULT_ASPECT = KIE_GPT_IMAGE_2_DEFAULT_ASPECT;
export const KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_DEFAULT_RESOLUTION = KIE_GPT_IMAGE_2_DEFAULT_RESOLUTION;
export const KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_DEFAULT_RESOLUTION = KIE_GPT_IMAGE_2_DEFAULT_RESOLUTION;
export const KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MAX_PROMPT_CHARS = KIE_GPT_IMAGE_2_MAX_PROMPT_CHARS;
export const KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MAX_PROMPT_CHARS = KIE_GPT_IMAGE_2_MAX_PROMPT_CHARS;

export const isKieGptImage2TextToImageModelId = (modelId: string | null | undefined): boolean =>
  modelId === KIE_GPT_IMAGE_2_TEXT_TO_IMAGE_MODEL_ID;

export const isKieGptImage2ImageToImageModelId = (modelId: string | null | undefined): boolean =>
  modelId === KIE_GPT_IMAGE_2_IMAGE_TO_IMAGE_MODEL_ID;

export const normalizeKieGptImage2AspectRatio = (
  value: string | null | undefined
): KieGptImage2AspectRatio => {
  const normalized = value?.trim();
  return KIE_GPT_IMAGE_2_ALLOWED_ASPECTS.includes(normalized as KieGptImage2AspectRatio)
    ? (normalized as KieGptImage2AspectRatio)
    : KIE_GPT_IMAGE_2_DEFAULT_ASPECT;
};

export const normalizeKieGptImage2Resolution = (
  value: string | null | undefined,
  fallback: KieGptImage2Resolution = KIE_GPT_IMAGE_2_DEFAULT_RESOLUTION
): KieGptImage2Resolution => {
  const normalized = value?.trim().toUpperCase();
  if (normalized === "4K") return "4K";
  if (normalized === "2K") return "2K";
  if (normalized === "1K") return "1K";
  return fallback;
};

export const normalizeKieGptImage2ResolutionForAspect = ({
  aspect,
  resolution,
}: {
  aspect: string | null | undefined;
  resolution: string | null | undefined;
}): KieGptImage2Resolution => {
  const normalizedAspect = normalizeKieGptImage2AspectRatio(aspect);
  const normalizedResolution = normalizeKieGptImage2Resolution(resolution);
  if (normalizedAspect === "auto") return "1K";
  if (
    (normalizedResolution === "2K" || normalizedResolution === "4K") &&
    KIE_GPT_IMAGE_2_2K_4K_UNSUPPORTED_ASPECTS.includes(
      normalizedAspect as (typeof KIE_GPT_IMAGE_2_2K_4K_UNSUPPORTED_ASPECTS)[number]
    )
  ) {
    return "1K";
  }
  return normalizedResolution;
};

export const resolveKieGptImage2SizeForAspect = (
  aspect: string | null | undefined
): KieGptImage2Size | null => {
  const normalizedAspect = normalizeKieGptImage2AspectRatio(aspect);
  return normalizedAspect === "auto" ? null : normalizedAspect;
};
