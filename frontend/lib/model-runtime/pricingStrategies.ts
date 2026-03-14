/**
 * Pricing strategy implementations for AI Studio cost estimation.
 */
import { getModelConfig } from "./modelRegistry";
import { resolveAspectSize } from "./modelSizes";
import { convertUsdToCredits } from "./pricingCredits";
import { CostBreakdown, PricingParams, PricingStrategyId } from "./pricingTypes";
import { KIE_KLING_30_MODEL_ID, KIE_VEO_31_FAST_I2V_MODEL_ID } from "./providerModelIds";

const FAL_COST_PER_MP_USD = 0.025;
const FLUX2_COST_PER_MP_USD = 0.012;
const FLUX2_KLEIN_COST_PER_MP_USD = 0.006;
const FLUX2_EDIT_INPUT_MP = 1;
const FLUX2_PRO_FIRST_MP_USD = 0.03;
const FLUX2_PRO_ADDITIONAL_MP_USD = 0.015;
const FLUX2_PRO_EDIT_NORMALIZED_INPUT_MP = 1;
const FLUX_PRO_FILL_COST_PER_MP_USD = 0.05;
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
const KLING_3_KIE_RATE_AUDIO_OFF_1080P_USD_PER_SECOND = 0.135;
const KLING_3_KIE_RATE_AUDIO_ON_1080P_USD_PER_SECOND = 0.2;
const KLING_3_KIE_RATE_AUDIO_OFF_720P_USD_PER_SECOND = 0.1;
const KLING_3_KIE_RATE_AUDIO_ON_720P_USD_PER_SECOND = 0.15;
const KIE_VEO_31_FAST_I2V_PER_VIDEO_USD = 0.3;
const SORA2_PRO_720P_USD_PER_SECOND = 0.3;
const SORA2_PRO_1080P_USD_PER_SECOND = 0.5;
const SEEDANCE_AUDIO_RATE_USD_PER_M_TOKEN = 2.4;
const SEEDANCE_NO_AUDIO_RATE_USD_PER_M_TOKEN = 1.2;
const SEEDANCE_DEFAULT_FPS = 24;
const SEEDANCE_RESOLUTION_MAP = {
  "1080p": { width: 1920, height: 1080 },
  "720p": { width: 1280, height: 720 },
  "480p": { width: 854, height: 480 },
};

type StrategyFn = (params: PricingParams) => CostBreakdown | null;

const toCostBreakdown = ({
  modelId,
  usdRaw,
  megapixels,
  width,
  height,
  applyMarkup,
}: {
  modelId: string;
  usdRaw: number;
  megapixels: number;
  width: number;
  height: number;
  applyMarkup?: boolean;
}): CostBreakdown => {
  const quantized = convertUsdToCredits({
    usdRaw,
    modelId,
    applyMarkup: applyMarkup ?? true,
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

const computeFalPerMpCost: StrategyFn = ({ modelId, aspect, imageWidth, imageHeight }) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight });
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
  });
};

const computeFlux2PerMpCost: StrategyFn = ({ modelId, aspect, imageWidth, imageHeight }) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const usdRaw =
    modelId === "fal/flux-2/edit"
      ? (FLUX2_EDIT_INPUT_MP + megapixels) * FLUX2_COST_PER_MP_USD
      : megapixels * FLUX2_COST_PER_MP_USD;
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
  });
};

const computeFlux2KleinPerMpCost: StrategyFn = ({ modelId, aspect, imageWidth, imageHeight }) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const usdRaw =
    modelId === "fal-ai/bria/background/remove"
      ? BRIA_BACKGROUND_REMOVE_PER_IMAGE_USD
      : megapixels * FLUX2_KLEIN_COST_PER_MP_USD;
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
  });
};

const computeFlux2ProPerMpCost: StrategyFn = ({ modelId, aspect, imageWidth, imageHeight }) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const roundedOutputMp = Math.max(1, Math.ceil(megapixels));
  const usdRaw = (() => {
    if (modelId === "fal-ai/flux-pro/v1/fill") {
      return roundedOutputMp * FLUX_PRO_FILL_COST_PER_MP_USD;
    }
    if (modelId === "fal/flux-2-pro/edit") {
      // Provider pricing includes output first MP plus additional rounded output+input MP.
      // Runtime normalizes edit input to 1 MP for deterministic debit parity.
      const additionalUnits = Math.max(0, roundedOutputMp - 1) + FLUX2_PRO_EDIT_NORMALIZED_INPUT_MP;
      return FLUX2_PRO_FIRST_MP_USD + additionalUnits * FLUX2_PRO_ADDITIONAL_MP_USD;
    }
    return FLUX2_PRO_FIRST_MP_USD + Math.max(0, roundedOutputMp - 1) * FLUX2_PRO_ADDITIONAL_MP_USD;
  })();
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
  });
};

const computeGoogleNanoBananaPerImageCost: StrategyFn = ({ modelId }) => {
  return toCostBreakdown({
    modelId,
    usdRaw: GOOGLE_NANO_BANANA_PER_IMAGE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  });
};

const computeGptImagePerImageCost: StrategyFn = ({ modelId }) => {
  return toCostBreakdown({
    modelId,
    usdRaw: GPT_IMAGE_PER_IMAGE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  });
};

const computeGpt41NanoPerTokenCost: StrategyFn = ({
  modelId,
  inputTokens = 0,
  outputTokens = 0,
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
  });
};

const computeSeedreamPerImageCost: StrategyFn = ({ modelId, resolution }) => {
  const baseUsd = 0.04;
  const resolutionMultiplier = resolution === "4K" ? 2 : 1;
  return toCostBreakdown({
    modelId,
    usdRaw: baseUsd * resolutionMultiplier,
    megapixels: 0,
    width: 0,
    height: 0,
  });
};

const computeSeedream5LitePerImageCost: StrategyFn = ({ modelId }) => {
  return toCostBreakdown({
    modelId,
    usdRaw: 0.035,
    megapixels: 0,
    width: 0,
    height: 0,
  });
};

const computeNanoBanana2PerImageCost: StrategyFn = ({ modelId, resolution, webSearch }) => {
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
  });
};

const computeNanoBananaPerImageCost: StrategyFn = ({ modelId, resolution, webSearch }) => {
  const baseUsd = 0.15;
  const resolutionMultiplier = resolution === "4K" ? 2 : 1;
  const webSearchUsd = webSearch ? 0.015 : 0;
  return toCostBreakdown({
    modelId,
    usdRaw: baseUsd * resolutionMultiplier + webSearchUsd,
    megapixels: 0,
    width: 0,
    height: 0,
  });
};

const computeKling3PerSecondCost: StrategyFn = (params) => {
  const duration = resolveDefaultDuration(params, DEFAULT_KLING_DURATION_SECONDS);
  const hasAudio = resolveDefaultAudio(params, true);
  const usesVoiceControl = params.voiceControl === true;
  const isKieModel = params.modelId === KIE_KLING_30_MODEL_ID;
  const rates = isKieModel
    ? (() => {
        const res = resolveDefaultResolution(params, "1080p").toLowerCase();
        const is720p = res.includes("720");
        return {
          audioOff: is720p
            ? KLING_3_KIE_RATE_AUDIO_OFF_720P_USD_PER_SECOND
            : KLING_3_KIE_RATE_AUDIO_OFF_1080P_USD_PER_SECOND,
          audioOn: is720p
            ? KLING_3_KIE_RATE_AUDIO_ON_720P_USD_PER_SECOND
            : KLING_3_KIE_RATE_AUDIO_ON_1080P_USD_PER_SECOND,
          // Kie pricing evidence does not publish a separate voice-control tier.
          audioVoice: is720p
            ? KLING_3_KIE_RATE_AUDIO_ON_720P_USD_PER_SECOND
            : KLING_3_KIE_RATE_AUDIO_ON_1080P_USD_PER_SECOND,
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
  });
};

const computeSora2ProPerSecondCost: StrategyFn = (params) => {
  const duration = resolveDefaultDuration(params, 8);
  const res = resolveDefaultResolution(params, "1080p").toLowerCase();
  const usdPerSecond = res.includes("720")
    ? SORA2_PRO_720P_USD_PER_SECOND
    : SORA2_PRO_1080P_USD_PER_SECOND;
  const usd = usdPerSecond * duration;
  return toCostBreakdown({
    modelId: params.modelId,
    usdRaw: usd,
    megapixels: 0,
    width: 0,
    height: 0,
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
  });
};

export const pricingStrategies: Record<PricingStrategyId, StrategyFn> = {
  "fal-per-mp": computeFalPerMpCost,
  "fal-flux2-per-mp": computeFlux2PerMpCost,
  "fal-flux2-klein-per-mp": computeFlux2KleinPerMpCost,
  "fal-flux2-pro-per-mp": computeFlux2ProPerMpCost,
  "gpt-image-per-image": computeGptImagePerImageCost,
  "google-nano-banana-per-image": computeGoogleNanoBananaPerImageCost,
  "nano-banana-2-per-image": computeNanoBanana2PerImageCost,
  "gpt41nano-per-token": computeGpt41NanoPerTokenCost,
  "nano-banana-per-image": computeNanoBananaPerImageCost,
  "seedream-per-image": computeSeedreamPerImageCost,
  "seedream-5-lite-per-image": computeSeedream5LitePerImageCost,
  "kling-3-per-second": computeKling3PerSecondCost,
  "veo-3-per-second": computeVeoPerSecondCost,
  "sora-2-pro-per-second": computeSora2ProPerSecondCost,
  "seedance-1.5-per-second": computeSeedancePerSecondCost,
};
