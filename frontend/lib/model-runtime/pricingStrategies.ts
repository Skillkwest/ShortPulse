/**
 * Pricing strategy implementations for AI Studio cost estimation.
 */
import { getModelConfig } from "./modelRegistry";
import { resolveAspectSize } from "./modelSizes";
import {
  OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD,
  OPENAI_GPT_IMAGE_2_DEFAULT_SIZE,
  OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS,
  resolveOpenAiGptImage2InputImageUsd,
  normalizeOpenAiGptImage2Quality,
  normalizeOpenAiGptImage2InputFidelity,
  resolveOpenAiGptImage2SizeForAspect,
} from "./openAiImage2";
import { convertUsdToCredits } from "./pricingCredits";
import { CostBreakdown, PricingParams, PricingStrategyId } from "./pricingTypes";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "./providerModelIds";
import { resolveModelPricingVariantId } from "./modelPricingVariants";

const FAL_COST_PER_MP_USD = 0.025;
const ECONOMY_IMAGE_COST_PER_MP_USD = 0.006;
const FLUX_PRO_FILL_COST_PER_MP_USD = 0.05;
const FLUX_KONTEXT_INPAINT_COST_PER_MP_USD = 0.035;
const BRIA_BACKGROUND_REMOVE_PER_IMAGE_USD = 0.018;
const GOOGLE_NANO_BANANA_PER_IMAGE_USD = 0.039;
export const DEFAULT_KLING_DURATION_SECONDS = 10;
const ELEVENLABS_TEXT_TO_SPEECH_USD_PER_1K_CHARACTERS = 0.1;
const ELEVENLABS_VOICE_CHANGER_USD_PER_MINUTE = 0.12;
const ELEVENLABS_SOUND_EFFECT_AUTO_USD_PER_GENERATION = 0.01;
// ElevenLabs API pricing documents sound effects at 100 credits / generation for auto-duration
// and 20 credits / second when duration is explicitly requested.
const ELEVENLABS_SOUND_EFFECT_EXPLICIT_USD_PER_SECOND =
  ELEVENLABS_SOUND_EFFECT_AUTO_USD_PER_GENERATION / 5;
const ELEVENLABS_MUSIC_USD_PER_MINUTE = 0.3;
const OPENAI_TEXT_TOKEN_RATES_USD_PER_M: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  "gpt-5.4": { input: 2.5, cachedInput: 0.25, output: 15 },
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, cachedInput: 0.02, output: 1.25 },
};
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

const resolvePositiveFiniteNumber = (value: number | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return value;
};

const resolveOutputCount = (generationCount: number | undefined): number =>
  Math.max(1, Math.round(resolvePositiveFiniteNumber(generationCount) ?? 1));

const toCostBreakdown = ({
  modelId,
  usdRaw,
  megapixels,
  width,
  height,
  applyMarkup,
  policy,
  variantId = null,
}: {
  modelId: string;
  usdRaw: number;
  megapixels: number;
  width: number;
  height: number;
  applyMarkup?: boolean;
  policy?: PricingParams["pricingPolicy"];
  variantId?: string | null;
}): CostBreakdown => {
  const quantized = convertUsdToCredits({
    usdRaw,
    modelId,
    applyMarkup: applyMarkup ?? true,
    policy,
    variantId,
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

const resolveGptImage2Size = (
  params: Omit<PricingParams, "modelId">
): keyof typeof OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD => {
  const directSize = (params.size ?? "").trim() as keyof typeof OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD;
  if (directSize in OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD) {
    return directSize;
  }
  return resolveOpenAiGptImage2SizeForAspect(params.aspect);
};

const resolveGptImage2Quality = (
  params: Omit<PricingParams, "modelId">
): keyof (typeof OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD)[typeof OPENAI_GPT_IMAGE_2_DEFAULT_SIZE] => {
  return normalizeOpenAiGptImage2Quality(params.quality ?? params.resolution);
};

const computeFalPerMpCost: StrategyFn = ({
  modelId,
  aspect,
  imageWidth,
  imageHeight,
  generationCount,
  pricingPolicy,
}) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight, pricingPolicy });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const usdRaw = megapixels * FAL_COST_PER_MP_USD * resolveOutputCount(generationCount);
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({
      modelId,
      aspect,
      imageWidth,
      imageHeight,
      pricingPolicy,
    }),
  });
};

const computeEconomyFalImageCost: StrategyFn = ({
  modelId,
  aspect,
  imageWidth,
  imageHeight,
  generationCount,
  pricingPolicy,
}) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight, pricingPolicy });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const outputCount = resolveOutputCount(generationCount);
  const usdRaw =
    modelId === "fal-ai/bria/background/remove"
      ? BRIA_BACKGROUND_REMOVE_PER_IMAGE_USD * outputCount
      : megapixels * ECONOMY_IMAGE_COST_PER_MP_USD * outputCount;
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({
      modelId,
      aspect,
      imageWidth,
      imageHeight,
      pricingPolicy,
    }),
  });
};

const computeFalFillPerMpCost: StrategyFn = ({
  modelId,
  aspect,
  imageWidth,
  imageHeight,
  generationCount,
  pricingPolicy,
}) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight, pricingPolicy });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const usdRaw = megapixels * FLUX_PRO_FILL_COST_PER_MP_USD * resolveOutputCount(generationCount);
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({
      modelId,
      aspect,
      imageWidth,
      imageHeight,
      pricingPolicy,
    }),
  });
};

const computeFluxKontextInpaintPerMpCost: StrategyFn = ({
  modelId,
  aspect,
  imageWidth,
  imageHeight,
  generationCount,
  pricingPolicy,
}) => {
  const size = resolveImageSizeForMp({ modelId, aspect, imageWidth, imageHeight, pricingPolicy });
  if (!size) return null;

  const megapixels = (size.width * size.height) / 1_000_000;
  const usdRaw =
    megapixels * FLUX_KONTEXT_INPAINT_COST_PER_MP_USD * resolveOutputCount(generationCount);
  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels,
    width: size.width,
    height: size.height,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({
      modelId,
      aspect,
      imageWidth,
      imageHeight,
      pricingPolicy,
    }),
  });
};

const computeGoogleNanoBananaPerImageCost: StrategyFn = ({
  modelId,
  generationCount,
  pricingPolicy,
}) => {
  return toCostBreakdown({
    modelId,
    usdRaw: GOOGLE_NANO_BANANA_PER_IMAGE_USD * resolveOutputCount(generationCount),
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({ modelId, pricingPolicy }),
  });
};

const computeGptImage2PerImageCost: StrategyFn = ({
  modelId,
  generationCount,
  pricingPolicy,
  inputImageCount = 0,
  inputFidelity,
  maskPresent = false,
  ...params
}) => {
  const size = resolveGptImage2Size(params);
  const quality = resolveGptImage2Quality(params);
  const outputUsdPerImage = OPENAI_GPT_IMAGE_2_CREATE_COSTS_USD[size][quality];
  const outputCount = resolveOutputCount(generationCount);
  const dimensions = OPENAI_GPT_IMAGE_2_SIZE_TO_DIMENSIONS[size];
  const megapixels = (dimensions.width * dimensions.height) / 1_000_000;
  const normalizedInputImageCount = Math.max(
    0,
    Math.round(resolvePositiveFiniteNumber(inputImageCount) ?? 0)
  );
  const normalizedInputFidelity = normalizeOpenAiGptImage2InputFidelity(inputFidelity);
  const perInputImageUsd = resolveOpenAiGptImage2InputImageUsd({
    size,
    inputFidelity: normalizedInputFidelity,
  });
  const maskUsd = maskPresent
    ? resolveOpenAiGptImage2InputImageUsd({
        size,
        inputFidelity: "low",
      })
    : 0;
  return toCostBreakdown({
    modelId,
    usdRaw:
      outputUsdPerImage * outputCount + perInputImageUsd * normalizedInputImageCount + maskUsd,
    megapixels,
    width: dimensions.width,
    height: dimensions.height,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({
      modelId,
      inputImageCount,
      inputFidelity,
      maskPresent,
      size,
      quality,
      resolution: quality,
      pricingPolicy,
    }),
  });
};

const computeOpenAiTextTokenCost: StrategyFn = ({
  modelId,
  inputTokens = 0,
  cachedInputTokens = 0,
  outputTokens = 0,
  pricingPolicy,
}) => {
  const rates = OPENAI_TEXT_TOKEN_RATES_USD_PER_M[modelId];
  if (!rates) return null;
  const totalUsd =
    (Math.max(0, inputTokens) / 1_000_000) * rates.input +
    (Math.max(0, cachedInputTokens) / 1_000_000) * rates.cachedInput +
    (Math.max(0, outputTokens) / 1_000_000) * rates.output;
  return toCostBreakdown({
    modelId,
    usdRaw: totalUsd,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({ modelId, pricingPolicy }),
  });
};

const computeElevenLabsTextToSpeechCost: StrategyFn = ({
  modelId,
  pricingPolicy,
  textCharacters,
}) => {
  const resolvedCharacters = resolvePositiveFiniteNumber(textCharacters);
  if (resolvedCharacters == null) return null;

  return toCostBreakdown({
    modelId,
    usdRaw:
      (Math.round(resolvedCharacters) / 1_000) * ELEVENLABS_TEXT_TO_SPEECH_USD_PER_1K_CHARACTERS,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({ modelId, textCharacters, pricingPolicy }),
  });
};

const computeElevenLabsVoiceChangerCost: StrategyFn = ({
  modelId,
  pricingPolicy,
  sourceDurationSeconds,
}) => {
  const resolvedDurationSeconds = resolvePositiveFiniteNumber(sourceDurationSeconds);
  if (resolvedDurationSeconds == null) return null;

  return toCostBreakdown({
    modelId,
    usdRaw: (resolvedDurationSeconds / 60) * ELEVENLABS_VOICE_CHANGER_USD_PER_MINUTE,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({
      modelId,
      sourceDurationSeconds,
      pricingPolicy,
    }),
  });
};

const computeElevenLabsSoundEffectCost: StrategyFn = ({
  durationSeconds,
  generationCount,
  modelId,
  pricingPolicy,
}) => {
  const resolvedDurationSeconds = resolvePositiveFiniteNumber(durationSeconds);
  const resolvedGenerationCount = Math.max(
    1,
    Math.round(resolvePositiveFiniteNumber(generationCount) ?? 1)
  );
  const usdRaw =
    resolvedDurationSeconds == null
      ? resolvedGenerationCount * ELEVENLABS_SOUND_EFFECT_AUTO_USD_PER_GENERATION
      : resolvedDurationSeconds * ELEVENLABS_SOUND_EFFECT_EXPLICIT_USD_PER_SECOND;

  return toCostBreakdown({
    modelId,
    usdRaw,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({
      modelId,
      durationSeconds,
      generationCount,
      pricingPolicy,
    }),
  });
};

const computeElevenLabsMusicCost: StrategyFn = ({ durationSeconds, modelId, pricingPolicy }) => {
  const resolvedDurationSeconds =
    resolvePositiveFiniteNumber(durationSeconds) ?? resolveDefaultDuration({ modelId }, 60);
  const normalizedDurationSeconds = resolvePositiveFiniteNumber(resolvedDurationSeconds);
  if (normalizedDurationSeconds == null) return null;

  return toCostBreakdown({
    modelId,
    usdRaw: (normalizedDurationSeconds / 60) * ELEVENLABS_MUSIC_USD_PER_MINUTE,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({ modelId, durationSeconds, pricingPolicy }),
  });
};

const computeSeedreamPerImageCost: StrategyFn = ({
  modelId,
  resolution,
  generationCount,
  pricingPolicy,
}) => {
  const baseUsd = 0.04;
  const resolutionMultiplier = resolution === "4K" ? 2 : 1;
  const outputCount = resolveOutputCount(generationCount);
  return toCostBreakdown({
    modelId,
    usdRaw: baseUsd * resolutionMultiplier * outputCount,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({ modelId, resolution, pricingPolicy }),
  });
};

const computeSeedream5LitePerImageCost: StrategyFn = ({
  modelId,
  generationCount,
  pricingPolicy,
}) => {
  return toCostBreakdown({
    modelId,
    usdRaw: 0.035 * resolveOutputCount(generationCount),
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({ modelId, pricingPolicy }),
  });
};

const computeNanoBanana2PerImageCost: StrategyFn = ({
  modelId,
  resolution,
  webSearch,
  generationCount,
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
  const outputCount = resolveOutputCount(generationCount);
  return toCostBreakdown({
    modelId,
    usdRaw: (baseUsd * resolutionMultiplier + webSearchUsd) * outputCount,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({
      modelId,
      resolution,
      webSearch,
      pricingPolicy,
    }),
  });
};

const computeNanoBananaPerImageCost: StrategyFn = ({
  modelId,
  resolution,
  webSearch,
  generationCount,
  pricingPolicy,
}) => {
  const baseUsd = 0.15;
  const resolutionMultiplier = resolution === "4K" ? 2 : 1;
  const webSearchUsd = webSearch ? 0.015 : 0;
  const outputCount = resolveOutputCount(generationCount);
  return toCostBreakdown({
    modelId,
    usdRaw: (baseUsd * resolutionMultiplier + webSearchUsd) * outputCount,
    megapixels: 0,
    width: 0,
    height: 0,
    policy: pricingPolicy,
    variantId: resolveModelPricingVariantId({
      modelId,
      resolution,
      webSearch,
      pricingPolicy,
    }),
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
    variantId: resolveModelPricingVariantId(params),
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
      variantId: resolveModelPricingVariantId(params),
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
    variantId: resolveModelPricingVariantId(params),
  });
};

const resolveSeedance15Duration = (value?: number) => {
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

const resolveSeedance2Duration = (value?: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 10;
  if (value <= 5) return 5;
  if (value <= 10) return 10;
  return 15;
};

const computeSeedancePerSecondCost: StrategyFn = (params) => {
  if (params.modelId === KIE_SEEDANCE_15_PRO_MODEL_ID) {
    const duration = resolveSeedance15Duration(params.durationSeconds);
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
      variantId: resolveModelPricingVariantId(params),
    });
  }

  const duration = resolveSeedance2Duration(params.durationSeconds);
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
    variantId: resolveModelPricingVariantId(params),
  });
};

export const pricingStrategies: Record<PricingStrategyId, StrategyFn> = {
  "elevenlabs-music-per-minute": computeElevenLabsMusicCost,
  "elevenlabs-sound-effect": computeElevenLabsSoundEffectCost,
  "elevenlabs-text-to-speech-per-kchar": computeElevenLabsTextToSpeechCost,
  "elevenlabs-voice-changer-per-minute": computeElevenLabsVoiceChangerCost,
  "fal-per-mp": computeFalPerMpCost,
  "fal-economy-image-per-mp": computeEconomyFalImageCost,
  "fal-fill-per-mp": computeFalFillPerMpCost,
  "fal-flux-kontext-inpaint-per-mp": computeFluxKontextInpaintPerMpCost,
  "gpt-image-2-per-image": computeGptImage2PerImageCost,
  "google-nano-banana-per-image": computeGoogleNanoBananaPerImageCost,
  "nano-banana-2-per-image": computeNanoBanana2PerImageCost,
  "openai-text-token": computeOpenAiTextTokenCost,
  "nano-banana-per-image": computeNanoBananaPerImageCost,
  "seedream-per-image": computeSeedreamPerImageCost,
  "seedream-5-lite-per-image": computeSeedream5LitePerImageCost,
  "kling-3-per-second": computeKling3PerSecondCost,
  "veo-3-per-second": computeVeoPerSecondCost,
  "seedance-1.5-per-second": computeSeedancePerSecondCost,
  "seedance-2-per-second": computeSeedancePerSecondCost,
  "seedance-2-fast-per-second": computeSeedancePerSecondCost,
};
