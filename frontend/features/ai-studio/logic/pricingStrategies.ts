import { getModelConfig } from "./modelRegistry";
import { resolveAspectSize } from "./modelSizes";
import { CostBreakdown, PricingParams, PricingStrategyId } from "./pricingTypes";

const FAL_COST_PER_MP_USD = 0.025;
const FLUX2_COST_PER_MP_USD = 0.012;
const FLUX2_PRO_FIRST_MP_USD = 0.03;
const FLUX2_PRO_ADDITIONAL_MP_USD = 0.015;
const FLUX2_MAX_FIRST_MP_USD = 0.07;
const FLUX2_MAX_ADDITIONAL_MP_USD = 0.03;
const IMAGEN4_FAST_PER_IMAGE_USD = 0.02;
const GOOGLE_NANO_BANANA_PER_IMAGE_USD = 0.039;
const CREDIT_VALUE_USD = 0.01;
const KLING_VIDEO_COST_PER_SECOND_USD = 0.095;
export const DEFAULT_KLING_DURATION_SECONDS = 10;
const KLING_25_BASE_USD_FOR_5S = 0.35;
const KLING_25_ADDITIONAL_PER_SECOND_USD = 0.07;
const VEO_AUDIO_RATE_1080P_USD_PER_SECOND = 0.4;
const VEO_NO_AUDIO_RATE_1080P_USD_PER_SECOND = 0.2;
const VEO_AUDIO_RATE_4K_USD_PER_SECOND = 0.6;
const VEO_NO_AUDIO_RATE_4K_USD_PER_SECOND = 0.4;
const KLING_26_RATE_AUDIO_OFF_USD_PER_SECOND = 0.07;
const KLING_26_RATE_AUDIO_ON_USD_PER_SECOND = 0.14;

type StrategyFn = (params: PricingParams) => CostBreakdown | null;

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

const computeFalPerMpCost: StrategyFn = ({ modelId, aspect }) => {
  const config = getModelConfig(modelId);
  if (!config?.sizeMap) return null;

  const size = resolveAspectSize(aspect, config.sizeMap, config.defaultAspect);
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const roundedMp = Math.ceil(megapixels);
  const credits = Math.ceil((FAL_COST_PER_MP_USD / CREDIT_VALUE_USD) * roundedMp);
  const usd = credits * CREDIT_VALUE_USD;

  return { credits, usd, megapixels, width: size.width, height: size.height };
};

const computeFlux2PerMpCost: StrategyFn = ({ modelId, aspect }) => {
  const config = getModelConfig(modelId);
  if (!config?.sizeMap) return null;

  const size = resolveAspectSize(aspect, config.sizeMap, config.defaultAspect);
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const usdRaw = megapixels * FLUX2_COST_PER_MP_USD;
  const credits = Math.max(1, Math.ceil(usdRaw / CREDIT_VALUE_USD));
  const usd = credits * CREDIT_VALUE_USD;

  return { credits, usd, megapixels, width: size.width, height: size.height };
};

const computeFlux2ProPerMpCost: StrategyFn = ({ modelId, aspect }) => {
  const config = getModelConfig(modelId);
  if (!config?.sizeMap) return null;

  const size = resolveAspectSize(aspect, config.sizeMap, config.defaultAspect);
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const roundedMp = Math.max(1, Math.ceil(megapixels));
  const usdRaw = FLUX2_PRO_FIRST_MP_USD + Math.max(0, roundedMp - 1) * FLUX2_PRO_ADDITIONAL_MP_USD;
  const credits = Math.max(1, Math.ceil(usdRaw / CREDIT_VALUE_USD));
  const usd = credits * CREDIT_VALUE_USD;

  return { credits, usd, megapixels, width: size.width, height: size.height };
};

const computeFlux2MaxPerMpCost: StrategyFn = ({ modelId, aspect }) => {
  const config = getModelConfig(modelId);
  if (!config?.sizeMap) return null;

  const size = resolveAspectSize(aspect, config.sizeMap, config.defaultAspect);
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const roundedMp = Math.max(1, Math.ceil(megapixels));
  const usdRaw = FLUX2_MAX_FIRST_MP_USD + Math.max(0, roundedMp - 1) * FLUX2_MAX_ADDITIONAL_MP_USD;
  const credits = Math.max(1, Math.ceil(usdRaw / CREDIT_VALUE_USD));
  const usd = credits * CREDIT_VALUE_USD;

  return { credits, usd, megapixels, width: size.width, height: size.height };
};

const computeImagen4FastPerImageCost: StrategyFn = () => {
  const usd = IMAGEN4_FAST_PER_IMAGE_USD;
  const credits = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  return { credits, usd: credits * CREDIT_VALUE_USD, megapixels: 0, width: 0, height: 0 };
};

const computeGoogleNanoBananaPerImageCost: StrategyFn = () => {
  const usd = GOOGLE_NANO_BANANA_PER_IMAGE_USD;
  const credits = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  return { credits, usd: credits * CREDIT_VALUE_USD, megapixels: 0, width: 0, height: 0 };
};
const computeGpt41NanoPerTokenCost: StrategyFn = ({ inputTokens = 0, outputTokens = 0 }) => {
  // Rates are per 1M tokens: input $0.10, output $0.025.
  const INPUT_USD_PER_M = 0.10;
  const OUTPUT_USD_PER_M = 0.025;
  const totalUsd =
    ((Math.max(0, inputTokens) / 1_000_000) * INPUT_USD_PER_M) +
    ((Math.max(0, outputTokens) / 1_000_000) * OUTPUT_USD_PER_M);
  const credits = Math.max(1, Math.ceil(totalUsd / CREDIT_VALUE_USD));
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const computeFalKlingPerRequestCost: StrategyFn = () => {
  return null;
};

const computeSeedreamPerImageCost: StrategyFn = ({ resolution }) => {
  const baseUsd = 0.04;
  const resolutionMultiplier = resolution === "4K" ? 2 : 1;
  const totalUsd = baseUsd * resolutionMultiplier;
  const credits = Math.max(1, Math.ceil(totalUsd / CREDIT_VALUE_USD));
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const computeNanoBananaPerImageCost: StrategyFn = ({ resolution, webSearch }) => {
  const baseUsd = 0.15;
  const resolutionMultiplier = resolution === "4K" ? 2 : 1;
  const webSearchUsd = webSearch ? 0.015 : 0;
  const totalUsd = baseUsd * resolutionMultiplier + webSearchUsd;
  const credits = Math.max(1, Math.ceil(totalUsd / CREDIT_VALUE_USD));
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const computeFalKlingPerDurationCost: StrategyFn = (params) => {
  const duration = resolveDefaultDuration(params, DEFAULT_KLING_DURATION_SECONDS);
  const usd = duration * KLING_VIDEO_COST_PER_SECOND_USD;
  const credits = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const computeKling25PerDurationCost: StrategyFn = (params) => {
  const duration = resolveDefaultDuration(params, DEFAULT_KLING_DURATION_SECONDS);
  const clampedDuration = Math.max(5, duration);
  const additionalSeconds = Math.max(0, clampedDuration - 5);
  const usd = KLING_25_BASE_USD_FOR_5S + additionalSeconds * KLING_25_ADDITIONAL_PER_SECOND_USD;
  const credits = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const computeKling26PerSecondCost: StrategyFn = (params) => {
  const duration = resolveDefaultDuration(params, 10);
  const hasAudio = resolveDefaultAudio(params, true);
  const usdPerSecond = hasAudio ? KLING_26_RATE_AUDIO_ON_USD_PER_SECOND : KLING_26_RATE_AUDIO_OFF_USD_PER_SECOND;
  const usd = usdPerSecond * duration;
  const credits = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const computeVeoPerSecondCost: StrategyFn = (params) => {
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
  const credits = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

export const pricingStrategies: Record<PricingStrategyId, StrategyFn> = {
  "fal-per-mp": computeFalPerMpCost,
  "fal-flux2-per-mp": computeFlux2PerMpCost,
  "fal-flux2-max-per-mp": computeFlux2MaxPerMpCost,
  "fal-flux2-pro-per-mp": computeFlux2ProPerMpCost,
  "imagen4-fast-per-image": computeImagen4FastPerImageCost,
  "google-nano-banana-per-image": computeGoogleNanoBananaPerImageCost,
  "gpt41nano-per-token": computeGpt41NanoPerTokenCost,
  "fal-kling-video-per-request": computeFalKlingPerDurationCost,
  "nano-banana-per-image": computeNanoBananaPerImageCost,
  "seedream-per-image": computeSeedreamPerImageCost,
  "kling-2.5-per-duration": computeKling25PerDurationCost,
  "kling-2.6-per-second": computeKling26PerSecondCost,
  "veo-3-per-second": computeVeoPerSecondCost,
};
