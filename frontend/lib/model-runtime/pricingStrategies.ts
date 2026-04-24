/**
 * Pricing strategy implementations for AI Studio cost estimation.
 */
import { getModelConfig } from "./modelRegistry";
import { resolveAspectSize } from "./modelSizes";
import { convertUsdToCredits } from "./pricingCredits";
import { CostBreakdown, PricingParams, PricingStrategyId } from "./pricingTypes";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "./providerModelIds";

const FAL_COST_PER_MP_USD = 0.025;
const ECONOMY_IMAGE_COST_PER_MP_USD = 0.006;
const FLUX_PRO_FILL_COST_PER_MP_USD = 0.05;
const FLUX_KONTEXT_INPAINT_COST_PER_MP_USD = 0.035;
const BRIA_BACKGROUND_REMOVE_PER_IMAGE_USD = 0.018;
const GOOGLE_NANO_BANANA_PER_IMAGE_USD = 0.039;
const GPT_IMAGE_PER_IMAGE_USD = 0.04;
export const DEFAULT_KLING_DURATION_SECONDS = 10;
const VEO_AUDIO_RATE_1080P_USD_PER_SECOND = 0.4;
const VEO_NO_AUDIO_RATE_1080P_USD_PER_SECOND = 0.2;
const VEO_AUDIO_RATE_4K_USD_PER_SECOND = 0.6;
const VEO_NO_AUDIO_RATE_4K_USD_PER_SECOND = 0.4;
const KLING_3_FAL_RATE_AUDIO_OFF_USD_PER_SECOND = 0.112;
const KLING_3_FAL_RATE_AUDIO_ON_USD_PER_SECOND = 0.168;
const KLING_3_FAL_RATE_AUDIO_VOICE_USD_PER_SECOND = 0.196;
const KIE_CREDIT_USD = 0.005;
const KLING_3_KIE_STD_AUDIO_OFF_CREDITS_PER_SECOND = 14;
const KLING_3_KIE_STD_AUDIO_ON_CREDITS_PER_SECOND = 21;
const KLING_3_KIE_PRO_AUDIO_OFF_CREDITS_PER_SECOND = 18;
const KLING_3_KIE_PRO_AUDIO_ON_CREDITS_PER_SECOND = 27;
const KIE_VEO_31_FAST_I2V_PER_VIDEO_USD = 0.4;
const SEEDANCE_AUDIO_RATE_USD_PER_M_TOKEN = 2.4;
const SEEDANCE_NO_AUDIO_RATE_USD_PER_M_TOKEN = 1.2;
const SEEDANCE_DEFAULT_FPS = 24;
const SEEDANCE_RESOLUTION_MAP = {
  "1080p": { width: 1920, height: 1080 },
  "720p": { width: 1280, height: 720 },
  "480p": { width: 854, height: 480 },
};

const kieCreditsToUsd = (credits: number): number => credits * KIE_CREDIT_USD;

type StrategyFn = (params: PricingParams) => CostBreakdown | null;

const toCostBreakdown = ({
  modelId,
  usdRaw,
  megapixels,
  width,
  height,
  applyMarkup,
  policy,
}: {
  modelId: string;
  usdRaw: number;
  megapixels: number;
  width: number;
  height: number;
  applyMarkup?: boolean;
  policy?: PricingParams["pricingPolicy"];
}): CostBreakdown => {
  const quantized = convertUsdToCredits({
    usdRaw,
    modelId,
    applyMarkup: applyMarkup ?? true,
    policy,
  });
  return {
    credits: quantized.credits,
    usd: quantized.billedUsd,
    rawCredits: quantized.rawCredits,
    usdRaw,
    megapixels,
    width,
    height,
  };
};

const resolveDefaultDuration = (params: PricingParams, fallback: number) => {
  const config = params.modelId ? getModelConfig(params.modelId) : null;
  const configDefault = config?.defaultDurationSeconds;
  return Number.isFinite(params.durationSeconds) && params.durationSeconds
    ? params.durationSeconds
    : Number.isFinite(configDefault) && configDefault
      ? configDefault
      : fallback;
};

const resolveDefaultResolution = (params: PricingParams, fallback: string) => {
  const config = params.modelId ? getModelConfig(params.modelId) : null;
  return params.resolution ?? config?.defaultResolution ?? fallback;
};

const resolveDefaultAudio = (params: PricingParams, fallback: boolean) => {
  const config = params.modelId ? getModelConfig(params.modelId) : null;
  return params.audio ?? config?.defaultAudio ?? fallback;
};

const resolveImageSizeForMp = (params: PricingParams) => {
  const width = Number(params.imageWidth ?? 0);
  const height = Number(params.imageHeight ?? 0);
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return {
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  const config = getModelConfig(params.modelId);
  if (!config?.sizeMap) return null;
  return resolveAspectSize(params.aspect, config.sizeMap, config.defaultAspect);
};

const computeFalPerMpCost: StrategyFn = ({
  modelId,
  aspect,
  imageWidth,
  imageHeight,
  pricingPolicy,
}) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight, pricingPolicy });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const roundedMp = Math.ceil(megapixels);
  const usdRaw = roundedMp * FAL_COST_PER_MP_USD;
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
    policy: pricingPolicy,
  });
};

const computeEconomyFalImageCost: StrategyFn = ({
  modelId,
  aspect,
  imageWidth,
  imageHeight,
  pricingPolicy,
}) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight, pricingPolicy });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const usdRaw =
    modelId === "fal-ai/bria/background/remove"
      ? BRIA_BACKGROUND_REMOVE_PER_IMAGE_USD
      : megapixels * ECONOMY_IMAGE_COST_PER_MP_USD;
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
    policy: pricingPolicy,
  });
};

const computeFalFillPerMpCost: StrategyFn = ({
  modelId,
  aspect,
  imageWidth,
  imageHeight,
  pricingPolicy,
}) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight, pricingPolicy });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const roundedOutputMp = Math.max(1, Math.ceil(megapixels));
  const usdRaw = roundedOutputMp * FLUX_PRO_FILL_COST_PER_MP_USD;
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
    policy: pricingPolicy,
  });
};

const computeFluxKontextInpaintPerMpCost: StrategyFn = ({
  modelId,
  aspect,
  imageWidth,
  imageHeight,
  pricingPolicy,
}) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight, pricingPolicy });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const roundedOutputMp = Math.max(1, Math.ceil(megapixels));
  const usdRaw = roundedOutputMp * FLUX_KONTEXT_INPAINT_COST_PER_MP_USD;
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
    policy: pricingPolicy,
  });
};

const computeGoogleNanoBananaPerImageCost: StrategyFn = ({ modelId, pricingPolicy }) => {
  return toCostBreakdown({
    modelId,
    usdRaw: GOOGLE_NANO_BANANA_PER_IMAGE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
  });
};

const computeGptImagePerImageCost: StrategyFn = ({ modelId, pricingPolicy }) => {
  return toCostBreakdown({
    modelId,
    usdRaw: GPT_IMAGE_PER_IMAGE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
  });
};

const computeGpt41NanoPerTokenCost: StrategyFn = ({
  modelId,
  inputTokens = 0,
  outputTokens = 0,
  pricingPolicy,
}) => {
  // Rates are per 1M tokens: input $0.10, output $0.025.
  const INPUT_USD_PER_M = 0.1;
  const OUTPUT_USD_PER_M = 0.025;
  const totalUsd =
    (Math.max(0, inputTokens) / 1_000_000) * INPUT_USD_PER_M +
    (Math.max(0, outputTokens) / 1_000_000) * OUTPUT_USD_PER_M;
  return toCostBreakdown({
    modelId,
    usdRaw: totalUsd,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
  });
};

const computeSeedreamPerImageCost: StrategyFn = ({ modelId, resolution, pricingPolicy }) => {
  const baseUsd = 0.04;
  const resolutionMultiplier = resolution === "4K" ? 2 : 1;
  return toCostBreakdown({
    modelId,
    usdRaw: baseUsd * resolutionMultiplier,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
  });
};

const computeSeedream5LitePerImageCost: StrategyFn = ({ modelId, pricingPolicy }) => {
  return toCostBreakdown({
    modelId,
    usdRaw: 0.035,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
  });
};

const computeNanoBanana2PerImageCost: StrategyFn = ({
  modelId,
  resolution,
  webSearch,
  pricingPolicy,
}) => {
  const baseUsd = 0.08;
  const normalizedResolution = (resolution ?? "1K").trim().toUpperCase();
  const resolutionMultiplier =
    normalizedResolution === "4K"
      ? 2
      : normalizedResolution === "2K"
        ? 1.5
        : normalizedResolution === "0.5K"
          ? 0.75
          : 1;
  const webSearchUsd = webSearch ? 0.015 : 0;
  return toCostBreakdown({
    modelId,
    usdRaw: baseUsd * resolutionMultiplier + webSearchUsd,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
  });
};

const computeNanoBananaPerImageCost: StrategyFn = ({
  modelId,
  resolution,
  webSearch,
  pricingPolicy,
}) => {
  const baseUsd = 0.15;
  const resolutionMultiplier = resolution === "4K" ? 2 : 1;
  const webSearchUsd = webSearch ? 0.015 : 0;
  return toCostBreakdown({
    modelId,
    usdRaw: baseUsd * resolutionMultiplier + webSearchUsd,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
  });
};

const computeKling3PerSecondCost: StrategyFn = (params) => {
  const duration = resolveDefaultDuration(params, DEFAULT_KLING_DURATION_SECONDS);
  const hasAudio = resolveDefaultAudio(params, true);
  const usesVoiceControl = params.voiceControl === true;
  const isKieModel = params.modelId === KIE_KLING_30_MODEL_ID;
  const rates = isKieModel
    ? (() => {
        const normalizedMode = (params.mode ?? "").trim().toLowerCase();
        const inferredMode =
          normalizedMode === "std" || normalizedMode === "pro"
            ? normalizedMode
            : resolveDefaultResolution(params, "1080p").toLowerCase().includes("720")
              ? "std"
              : "pro";
        return {
          audioOff:
            inferredMode === "std"
              ? kieCreditsToUsd(KLING_3_KIE_STD_AUDIO_OFF_CREDITS_PER_SECOND)
              : kieCreditsToUsd(KLING_3_KIE_PRO_AUDIO_OFF_CREDITS_PER_SECOND),
          // Sound-on pricing remains inferred from observed Kie mode costs with a standard 1.5x premium.
          audioOn:
            inferredMode === "std"
              ? kieCreditsToUsd(KLING_3_KIE_STD_AUDIO_ON_CREDITS_PER_SECOND)
              : kieCreditsToUsd(KLING_3_KIE_PRO_AUDIO_ON_CREDITS_PER_SECOND),
          audioVoice:
            inferredMode === "std"
              ? kieCreditsToUsd(KLING_3_KIE_STD_AUDIO_ON_CREDITS_PER_SECOND)
              : kieCreditsToUsd(KLING_3_KIE_PRO_AUDIO_ON_CREDITS_PER_SECOND),
        };
      })()
    : {
        audioOff: KLING_3_FAL_RATE_AUDIO_OFF_USD_PER_SECOND,
        audioOn: KLING_3_FAL_RATE_AUDIO_ON_USD_PER_SECOND,
        audioVoice: KLING_3_FAL_RATE_AUDIO_VOICE_USD_PER_SECOND,
      };
  const usdPerSecond = hasAudio
    ? usesVoiceControl
      ? rates.audioVoice
      : rates.audioOn
    : rates.audioOff;
  const usd = usdPerSecond * duration;
  return toCostBreakdown({
    modelId: params.modelId,
    usdRaw: usd,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: params.pricingPolicy,
  });
};

const computeVeoPerSecondCost: StrategyFn = (params) => {
  if (params.modelId === KIE_VEO_31_FAST_I2V_MODEL_ID) {
    return toCostBreakdown({
      modelId: params.modelId,
      usdRaw: KIE_VEO_31_FAST_I2V_PER_VIDEO_USD,
      megapixels: 0,
      width: 0,
      height: 0,
      policy: params.pricingPolicy,
    });
  }

  const duration = resolveDefaultDuration(params, 8);
  const res = resolveDefaultResolution(params, "1080p").toLowerCase();
  const hasAudio = resolveDefaultAudio(params, true);
  const is4k = res.includes("4k");
  const usdPerSecond = is4k
    ? hasAudio
      ? VEO_AUDIO_RATE_4K_USD_PER_SECOND
      : VEO_NO_AUDIO_RATE_4K_USD_PER_SECOND
    : hasAudio
      ? VEO_AUDIO_RATE_1080P_USD_PER_SECOND
      : VEO_NO_AUDIO_RATE_1080P_USD_PER_SECOND;
  const usd = usdPerSecond * duration;
  return toCostBreakdown({
    modelId: params.modelId,
    usdRaw: usd,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: params.pricingPolicy,
  });
};

const resolveSeedanceDuration = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 10;
  if (value <= 4) return 4;
  if (value <= 5) return 5;
  if (value <= 6) return 6;
  if (value <= 7) return 7;
  if (value <= 8) return 8;
  if (value <= 9) return 9;
  if (value <= 10) return 10;
  if (value <= 11) return 11;
  return 12;
};

const computeSeedancePerSecondCost: StrategyFn = (params) => {
  if (params.modelId === KIE_SEEDANCE_15_PRO_MODEL_ID) {
    const duration = resolveSeedanceDuration(params.durationSeconds);
    const res = resolveDefaultResolution(params, "720p").toLowerCase();
    const resolutionKey = res.includes("1080") ? "1080p" : res.includes("480") ? "480p" : "720p";
    const hasAudio = resolveDefaultAudio(params, false);
    const kieCreditsPerSecond = (() => {
      if (resolutionKey === "1080p") return hasAudio ? 15 : 7.5;
      if (resolutionKey === "720p") return hasAudio ? 7 : 3.5;
      // 480p has no direct evidence yet; keep a conservative half-step relative to 720p.
      return hasAudio ? 4 : 2;
    })();
    const usdRaw = kieCreditsToUsd(kieCreditsPerSecond * duration);
    const resolution = SEEDANCE_RESOLUTION_MAP[resolutionKey];
    return toCostBreakdown({
      modelId: params.modelId,
      usdRaw,
      megapixels: 0,
      width: resolution.width,
      height: resolution.height,
      policy: params.pricingPolicy,
    });
  }

  const duration = resolveSeedanceDuration(params.durationSeconds);
  const res = resolveDefaultResolution(params, "1080p").toLowerCase();
  const resolutionKey = res.includes("1080")
    ? "1080p"
    : res.includes("720") || res.includes("high")
      ? "720p"
      : "480p";
  const resolution = SEEDANCE_RESOLUTION_MAP[resolutionKey];
  if (!resolution) return null;

  const hasAudio = resolveDefaultAudio(params, true);
  const ratePerMillionTokens = hasAudio
    ? SEEDANCE_AUDIO_RATE_USD_PER_M_TOKEN
    : SEEDANCE_NO_AUDIO_RATE_USD_PER_M_TOKEN;
  const tokens = (resolution.width * resolution.height * SEEDANCE_DEFAULT_FPS * duration) / 1024;
  const usdRaw = (tokens / 1_000_000) * ratePerMillionTokens;
  return toCostBreakdown({
    modelId: params.modelId,
    usdRaw,
    megapixels: 0,
    width: resolution.width,
    height: resolution.height,
    policy: params.pricingPolicy,
  });
};

export const pricingStrategies: Record<PricingStrategyId, StrategyFn> = {
  "fal-per-mp": computeFalPerMpCost,
  "fal-economy-image-per-mp": computeEconomyFalImageCost,
  "fal-fill-per-mp": computeFalFillPerMpCost,
  "fal-flux-kontext-inpaint-per-mp": computeFluxKontextInpaintPerMpCost,
  "gpt-image-per-image": computeGptImagePerImageCost,
  "google-nano-banana-per-image": computeGoogleNanoBananaPerImageCost,
  "nano-banana-2-per-image": computeNanoBanana2PerImageCost,
  "gpt41nano-per-token": computeGpt41NanoPerTokenCost,
  "nano-banana-per-image": computeNanoBananaPerImageCost,
  "seedream-per-image": computeSeedreamPerImageCost,
  "seedream-5-lite-per-image": computeSeedream5LitePerImageCost,
  "kling-3-per-second": computeKling3PerSecondCost,
  "veo-3-per-second": computeVeoPerSecondCost,
  "seedance-1.5-per-second": computeSeedancePerSecondCost,
  "seedance-2-per-second": computeSeedancePerSecondCost,
  "seedance-2-fast-per-second": computeSeedancePerSecondCost,
};
