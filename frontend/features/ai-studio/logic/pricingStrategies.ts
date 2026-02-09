/**
 * Pricing strategy implementations for AI Studio cost estimation.
 */
import { getModelConfig } from "./modelRegistry";
import { resolveAspectSize } from "./modelSizes";
import { CostBreakdown, PricingParams, PricingStrategyId } from "./pricingTypes";

/**
 * Rounds a credit value up to the nearest 5.
 * Examples: 4 → 5, 7 → 10, 12 → 15, 23 → 25
 */
const roundCreditsToNearest5 = (credits: number): number => {
  return Math.ceil(credits / 5) * 5;
};

const FAL_COST_PER_MP_USD = 0.025;
const FLUX2_COST_PER_MP_USD = 0.012;
const FLUX2_KLEIN_COST_PER_MP_USD = 0.006;
const FLUX2_PRO_FIRST_MP_USD = 0.03;
const FLUX2_PRO_ADDITIONAL_MP_USD = 0.015;
const GOOGLE_NANO_BANANA_PER_IMAGE_USD = 0.039;
const GPT_IMAGE_PER_IMAGE_USD = 0.04;
const CREDIT_VALUE_USD = 0.01;
export const DEFAULT_KLING_DURATION_SECONDS = 10;
const VEO_AUDIO_RATE_1080P_USD_PER_SECOND = 0.4;
const VEO_NO_AUDIO_RATE_1080P_USD_PER_SECOND = 0.2;
const VEO_AUDIO_RATE_4K_USD_PER_SECOND = 0.6;
const VEO_NO_AUDIO_RATE_4K_USD_PER_SECOND = 0.4;
const KLING_26_MOTION_USD_PER_SECOND = 0.112;
const KLING_3_RATE_AUDIO_OFF_USD_PER_SECOND = 0.224;
const KLING_3_RATE_AUDIO_ON_USD_PER_SECOND = 0.336;
const KLING_3_RATE_AUDIO_VOICE_USD_PER_SECOND = 0.392;
const SORA2_PRO_STANDARD_10S_USD_PER_SECOND = 0.15; // 150 credits / 10s
const SORA2_PRO_STANDARD_15S_USD_PER_SECOND = 0.18; // 270 credits / 15s
const SORA2_PRO_HIGH_10S_USD_PER_SECOND = 0.33; // 330 credits / 10s
const SORA2_PRO_HIGH_15S_USD_PER_SECOND = 0.42; // 630 credits / 15s
const SEEDANCE_AUDIO_RATE_USD_PER_M_TOKEN = 2.4;
const SEEDANCE_NO_AUDIO_RATE_USD_PER_M_TOKEN = 1.2;
const SEEDANCE_DEFAULT_FPS = 24;
const SEEDANCE_RESOLUTION_MAP = {
  "1080p": { width: 1920, height: 1080 },
  "720p": { width: 1280, height: 720 },
  "480p": { width: 854, height: 480 },
};

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
  const creditsRaw = Math.ceil((FAL_COST_PER_MP_USD / CREDIT_VALUE_USD) * roundedMp);
  const credits = roundCreditsToNearest5(creditsRaw);
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
  const creditsRaw = Math.max(1, Math.ceil(usdRaw / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
  const usd = credits * CREDIT_VALUE_USD;

  return { credits, usd, megapixels, width: size.width, height: size.height };
};

const computeFlux2KleinPerMpCost: StrategyFn = ({ modelId, aspect }) => {
  const config = getModelConfig(modelId);
  if (!config?.sizeMap) return null;

  const size = resolveAspectSize(aspect, config.sizeMap, config.defaultAspect);
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const usdRaw = megapixels * FLUX2_KLEIN_COST_PER_MP_USD;
  const creditsRaw = Math.max(1, Math.ceil(usdRaw / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
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
  const creditsRaw = Math.max(1, Math.ceil(usdRaw / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
  const usd = credits * CREDIT_VALUE_USD;

  return { credits, usd, megapixels, width: size.width, height: size.height };
};

const computeGoogleNanoBananaPerImageCost: StrategyFn = () => {
  const usd = GOOGLE_NANO_BANANA_PER_IMAGE_USD;
  const creditsRaw = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
  return { credits, usd: credits * CREDIT_VALUE_USD, megapixels: 0, width: 0, height: 0 };
};

const computeGptImagePerImageCost: StrategyFn = () => {
  const creditsRaw = Math.max(1, Math.ceil(GPT_IMAGE_PER_IMAGE_USD / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const computeGpt41NanoPerTokenCost: StrategyFn = ({ inputTokens = 0, outputTokens = 0 }) => {
  // Rates are per 1M tokens: input $0.10, output $0.025.
  const INPUT_USD_PER_M = 0.10;
  const OUTPUT_USD_PER_M = 0.025;
  const totalUsd =
    ((Math.max(0, inputTokens) / 1_000_000) * INPUT_USD_PER_M) +
    ((Math.max(0, outputTokens) / 1_000_000) * OUTPUT_USD_PER_M);
  const creditsRaw = Math.max(1, Math.ceil(totalUsd / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
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
  const creditsRaw = Math.max(1, Math.ceil(totalUsd / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
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
  const creditsRaw = Math.max(1, Math.ceil(totalUsd / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const computeKling26MotionPerSecondCost: StrategyFn = (params) => {
  const duration = resolveDefaultDuration(params, DEFAULT_KLING_DURATION_SECONDS);
  const usd = KLING_26_MOTION_USD_PER_SECOND * duration;
  const creditsRaw = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const computeKling3PerSecondCost: StrategyFn = (params) => {
  const duration = resolveDefaultDuration(params, DEFAULT_KLING_DURATION_SECONDS);
  const hasAudio = resolveDefaultAudio(params, true);
  const usesVoiceControl = params.voiceControl === true;
  const usdPerSecond = hasAudio
    ? (usesVoiceControl ? KLING_3_RATE_AUDIO_VOICE_USD_PER_SECOND : KLING_3_RATE_AUDIO_ON_USD_PER_SECOND)
    : KLING_3_RATE_AUDIO_OFF_USD_PER_SECOND;
  const usd = usdPerSecond * duration;
  const creditsRaw = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
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
  const creditsRaw = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const computeSora2ProPerSecondCost: StrategyFn = (params) => {
  const duration = resolveDefaultDuration(params, 10);
  // Kie supports 10s or 15s; clamp to those tiers for pricing consistency.
  const tierDuration = duration <= 10 ? 10 : 15;
  const res = resolveDefaultResolution(params, "High").toLowerCase();
  const isStandard = res.includes("720") || res.includes("standard");
  const usdPerSecond = isStandard
    ? (tierDuration === 10 ? SORA2_PRO_STANDARD_10S_USD_PER_SECOND : SORA2_PRO_STANDARD_15S_USD_PER_SECOND)
    : (tierDuration === 10 ? SORA2_PRO_HIGH_10S_USD_PER_SECOND : SORA2_PRO_HIGH_15S_USD_PER_SECOND);
  const usd = usdPerSecond * tierDuration;
  const creditsRaw = Math.max(1, Math.ceil(usd / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);
  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: 0,
    height: 0,
  };
};

const resolveSeedanceDuration = (value?: number) => {
  if (!Number.isFinite(value)) return 10;
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
  const ratePerMillionTokens = hasAudio ? SEEDANCE_AUDIO_RATE_USD_PER_M_TOKEN : SEEDANCE_NO_AUDIO_RATE_USD_PER_M_TOKEN;
  const tokens = (resolution.width * resolution.height * SEEDANCE_DEFAULT_FPS * duration) / 1024;
  const usdRaw = (tokens / 1_000_000) * ratePerMillionTokens;
  const creditsRaw = Math.max(1, Math.ceil(usdRaw / CREDIT_VALUE_USD));
  const credits = roundCreditsToNearest5(creditsRaw);

  return {
    credits,
    usd: credits * CREDIT_VALUE_USD,
    megapixels: 0,
    width: resolution.width,
    height: resolution.height,
  };
};

export const pricingStrategies: Record<PricingStrategyId, StrategyFn> = {
  "fal-per-mp": computeFalPerMpCost,
  "fal-flux2-per-mp": computeFlux2PerMpCost,
  "fal-flux2-klein-per-mp": computeFlux2KleinPerMpCost,
  "fal-flux2-pro-per-mp": computeFlux2ProPerMpCost,
  "gpt-image-per-image": computeGptImagePerImageCost,
  "google-nano-banana-per-image": computeGoogleNanoBananaPerImageCost,
  "gpt41nano-per-token": computeGpt41NanoPerTokenCost,
  "nano-banana-per-image": computeNanoBananaPerImageCost,
  "seedream-per-image": computeSeedreamPerImageCost,
  "kling-2.6-motion-per-second": computeKling26MotionPerSecondCost,
  "kling-3-per-second": computeKling3PerSecondCost,
  "veo-3-per-second": computeVeoPerSecondCost,
  "sora-2-pro-per-second": computeSora2ProPerSecondCost,
  "seedance-1.5-per-second": computeSeedancePerSecondCost,
};
