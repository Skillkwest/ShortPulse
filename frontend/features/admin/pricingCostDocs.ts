import type {
  AdminCreditPricingBreakdown,
  AdminPricingModelRow,
  AdminPricingPreviewVariant,
} from "./types";
import { buildDefaultPricingParams, computeCostForModel } from "../../lib/model-runtime/pricing";
import {
  isKieKling30MotionControlPricingVariant,
  KIE_KLING_30_MOTION_CONTROL_VARIANT_ID,
} from "../../lib/model-runtime/klingMotionControlPricing";
import { buildModelUsagePricingOverrides, shouldShowAudioSpecControl } from "./pricingDrafts";
import {
  buildModelPricingVariantId,
  resolveModelPricingVariantId,
} from "../../lib/model-runtime/modelPricingVariants";
import {
  ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_LABEL,
  ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_DEFAULT_SECONDS,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_LABEL,
  ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
  ELEVENLABS_SOUND_EFFECTS_MODEL_ID,
} from "../../lib/model-runtime/elevenLabsModels";
import { convertUsdToCredits } from "../../lib/model-runtime/pricingCredits";
import {
  resolvePricingGridAspectOptions,
  shouldExpandAspectPricingVariants,
  shouldExpandResolutionPricingVariants,
  shouldExpandVideoInputPricingVariants,
} from "../../lib/model-runtime/pricingGridVariantRules";

export type CostDocsPopover = {
  x: number;
  y: number;
  title: string;
  sourceUrl: string;
  lines: string[];
};

const COST_DOCS_POPOVER_WIDTH = 380;
const COST_DOCS_POPOVER_HEIGHT = 260;
const OPENAI_TEXT_50K_CHARACTER_OUTPUT_USD: Record<string, number> = {
  "gpt-5.5": 0.281,
  "gpt-5.5-pro": 1.69,
  "gpt-5.4": 0.141,
  "gpt-5.4-pro": 1.69,
  "gpt-5.4-mini": 0.033,
  "gpt-5.4-nano": 0.009,
};
const OPENAI_TEXT_50K_CHARACTER_VARIANT_ID = "per-50000-characters";
const OPENAI_TEXT_50K_CHARACTER_LABEL = "Blended characters";

export const getCostDocsPosition = (clientX: number, clientY: number): { x: number; y: number } => {
  if (typeof window === "undefined") return { x: clientX + 14, y: clientY + 14 };
  const maxX = Math.max(16, window.innerWidth - COST_DOCS_POPOVER_WIDTH - 16);
  const maxY = Math.max(16, window.innerHeight - COST_DOCS_POPOVER_HEIGHT - 16);
  return {
    x: Math.max(16, Math.min(clientX + 14, maxX)),
    y: Math.max(16, Math.min(clientY + 14, maxY)),
  };
};

const getProviderPricingDocLines = (
  model: AdminPricingModelRow,
  variant?: AdminPricingPreviewVariant | null
): string[] => {
  switch (model.pricingStrategy) {
    case "fal-per-mp":
      return [
        "Provider cost basis used here: $0.025 per output megapixel.",
        "Workbook formula: output width x height / 1,000,000 multiplied by the provider rate.",
      ];
    case "fal-economy-image-per-mp":
      return model.id === "fal-ai/bria/background/remove"
        ? [
            "Provider cost basis used here: $0.018 per completed background-removal image.",
            "Workbook formula: one provider charge per generated output image.",
          ]
        : [
            "Provider cost basis used here: $0.006 per output megapixel.",
            "Workbook formula: output width x height / 1,000,000 multiplied by the provider rate.",
          ];
    case "fal-fill-per-mp":
      return [
        "Provider cost basis used here: $0.05 per output megapixel.",
        "Workbook formula: output width x height / 1,000,000 multiplied by the provider rate.",
      ];
    case "fal-flux-kontext-inpaint-per-mp":
      return [
        "Provider cost basis used here: $0.035 per output megapixel.",
        "Workbook formula: output width x height / 1,000,000 multiplied by the provider rate.",
      ];
    case "google-nano-banana-per-image":
      return [
        "Provider cost basis used here: $0.039 per generated image.",
        "Workbook formula: one provider charge per completed output image.",
      ];
    case "nano-banana-2-per-image":
      return [
        "Provider cost basis used here: $0.08 per 1K image.",
        "Resolution multipliers: 0.5K is 0.75x, 2K is 1.5x, and 4K is 2x.",
        "Web search adds $0.015 when enabled.",
      ];
    case "nano-banana-per-image":
      return [
        "Provider cost basis used here: $0.15 per 1K image.",
        "4K requests are modeled at 2x the base provider price.",
        "Web search adds $0.015 when enabled.",
      ];
    case "seedream-per-image":
      return [
        "Provider cost basis used here: $0.04 per image at the default resolution.",
        "4K requests are modeled at 2x the base provider price.",
      ];
    case "seedream-5-lite-per-image":
      return [
        "Provider cost basis used here: $0.035 per image.",
        "Workbook formula: one provider charge per completed output image.",
      ];
    case "kling-3-per-second":
      if (variant?.id.startsWith(`${KIE_KLING_30_MOTION_CONTROL_VARIANT_ID}|`)) {
        return [
          "Provider cost basis used here: Kie credits convert at $0.005 per credit.",
          "Kling 3.0 Motion Control uses the dedicated Kie motion-control mode with 720p or 1080p output.",
          "Motion Control pricing follows the selected resolution and audio setting; it does not use standard-video aspect rows.",
        ];
      }
      return [
        "Provider cost basis used here: Kie credits convert at $0.005 per credit.",
        "Kling 3.0 standard mode: 14 credits/sec without audio, 21 credits/sec with audio.",
        "Kling 3.0 pro mode: 18 credits/sec without audio, 27 credits/sec with audio.",
      ];
    case "veo-3-per-second":
      return model.id.includes("veo")
        ? [
            "Provider cost basis used here: Kie Veo 3.1 Fast image-to-video is modeled as $0.40 per completed video.",
            "The duration field is still shown for request shape review, but this row currently charges a flat provider cost.",
          ]
        : [
            "Provider cost basis used here: 1080p video costs $0.20/sec without audio or $0.40/sec with audio.",
            "4K video costs $0.40/sec without audio or $0.60/sec with audio.",
          ];
    case "seedance-2-per-second":
      return [
        "Provider cost basis used here: Kie credits convert at $0.005 per credit.",
        "No video input: unit price × output duration. With video input: unit price × (input video duration + output duration).",
        "No video input: 1080p 102 credits/sec, 720p 41 credits/sec, 480p 19 credits/sec.",
        "With video input: 1080p 62 credits/sec, 720p 25 credits/sec, 480p 11.5 credits/sec.",
      ];
    case "seedance-2-fast-per-second":
      return [
        "Provider cost basis used here: Kie credits convert at $0.005 per credit.",
        "No video input: unit price × output duration. With video input: unit price × (input video duration + output duration).",
        "No video input: 720p 33 credits/sec, 480p 15.5 credits/sec.",
        "With video input: 720p 20 credits/sec, 480p 9 credits/sec.",
      ];
    case "elevenlabs-music-per-minute":
      return [
        "Provider cost basis used here: $0.15 per generated music minute.",
        "Workbook formula: duration seconds / 60 multiplied by the provider rate.",
        "Duration controls follow the current ShortPulse music request range.",
      ];
    case "elevenlabs-sound-effect":
      return [
        "Provider cost basis used here: $0.12 per auto-duration API sound-effect generation.",
        "Explicit-duration API sound effects are normalized to $0.0132 per second.",
        "ShortPulse defaults the Sound Effects panel to Auto; the explicit-duration row uses the workbook duration input.",
      ];
    case "elevenlabs-text-to-speech-per-kchar":
      return [
        "Provider cost basis used here: $0.10 per 1,000 text characters.",
        "Workbook formula: rounded character count / 1,000 multiplied by the provider rate.",
      ];
    case "elevenlabs-voice-changer-per-minute":
      return [
        "Provider cost basis used here: $0.12 per processed source-audio minute.",
        "Workbook formula: source duration seconds / 60 multiplied by the provider rate.",
      ];
    case "openai-text-token":
      return [
        "Provider cost basis used here: the screenshot-style blended OpenAI figures per 50,000 characters.",
        "GPT-5.5: about $0.281, GPT-5.4: about $0.141, GPT-5.4 Mini: about $0.033, and GPT-5.4 Nano: about $0.009 per 50,000 characters.",
        "Pro tiers are modeled at about $1.69 per 50,000 blended characters.",
      ];
    default:
      return [
        `Provider cost basis used here: ${model.pricingStrategyLabel}.`,
        "Open the provider source link for the canonical docs page behind this workbook row.",
      ];
  }
};

export const getProviderPricingDocs = (
  model: AdminPricingModelRow,
  variant: AdminPricingPreviewVariant | null
): Omit<CostDocsPopover, "x" | "y"> => ({
  title: `${model.label}${variant && variant.id !== "default" ? ` ${variant.label}` : ""}`,
  sourceUrl: model.sourceUrl,
  lines: getProviderPricingDocLines(model, variant),
});

const mapDraftPricingBreakdown = (
  modelId: string,
  params: ReturnType<typeof buildDefaultPricingParams>,
  pricingPolicy: Parameters<typeof computeCostForModel>[2]
): AdminCreditPricingBreakdown | null => {
  const breakdown = computeCostForModel(modelId, params, pricingPolicy);
  if (!breakdown) return null;
  return {
    usdRaw: breakdown.usdRaw,
    rawCredits: breakdown.rawCredits,
    billedCredits: breakdown.credits,
    billedUsd: breakdown.usd,
  };
};

const orderWithDefaultFirst = <T extends string | boolean | null>(
  values: T[],
  defaultValue: T
): T[] => {
  const ordered: T[] = [];
  if (values.some((value) => value === defaultValue)) {
    ordered.push(defaultValue);
  }
  values.forEach((value) => {
    if (!ordered.some((existing) => existing === value)) {
      ordered.push(value);
    }
  });
  return ordered.length ? ordered : [defaultValue];
};

const buildAspectOptions = (
  model: AdminPricingModelRow,
  variantBaseId: string | null,
  options: { aspect?: string | null }
): Array<string | null> => {
  if (isKieKling30MotionControlPricingVariant(variantBaseId)) return [null];
  const allowedAspects = model.allowedAspects ?? [];
  if (!shouldExpandAspectPricingVariants(model.pricingStrategy)) return [model.defaultAspect];
  if (options.aspect) return [options.aspect];
  return orderWithDefaultFirst(
    resolvePricingGridAspectOptions({
      pricingStrategy: model.pricingStrategy,
      allowedAspects,
      defaultAspect: model.defaultAspect,
    }),
    model.defaultAspect
  );
};

const buildResolutionOptions = (
  model: AdminPricingModelRow,
  options: { resolution?: string | null }
): Array<string | null> => {
  const allowedResolutions = model.allowedResolutions ?? [];
  if (!shouldExpandResolutionPricingVariants(model.pricingStrategy)) {
    return [model.defaultResolution ?? null];
  }
  if (options.resolution !== undefined) return [options.resolution ?? null];
  return orderWithDefaultFirst(
    allowedResolutions.length ? allowedResolutions : [model.defaultResolution ?? null],
    model.defaultResolution ?? null
  );
};

const buildAudioOptions = (
  model: AdminPricingModelRow,
  options: { audio?: boolean | null }
): Array<boolean | null> => {
  if (!shouldShowAudioSpecControl(model)) return [null];
  if (options.audio !== undefined) return [options.audio];
  return orderWithDefaultFirst([true, false], model.defaultAudio ?? true);
};

const buildVideoInputOptions = (
  model: AdminPricingModelRow,
  options: { videoInput?: boolean | null }
): Array<boolean | null> => {
  if (!shouldExpandVideoInputPricingVariants(model.pricingStrategy)) return [null];
  if (options.videoInput !== undefined) return [options.videoInput];
  return [true, false];
};

export const buildDraftPricingPreviewVariants = (
  model: AdminPricingModelRow,
  pricingPolicy: Parameters<typeof computeCostForModel>[2],
  options: {
    usageAmount?: number | null;
    baseVariantId?: string | null;
    label?: string | null;
    aspect?: string | null;
    resolution?: string | null;
    audio?: boolean | null;
    videoInput?: boolean | null;
  } = {}
): AdminPricingPreviewVariant[] => {
  const serverVariants = model.pricingPreviewVariants.length
    ? model.pricingPreviewVariants
    : model.pricingPreview
      ? [{ id: "default", label: "Default", breakdown: model.pricingPreview }]
      : [];

  if (model.pricingAuthority !== "shared_policy") return serverVariants;

  if (model.pricingStrategy === "openai-text-token") {
    const baseUsdRaw = OPENAI_TEXT_50K_CHARACTER_OUTPUT_USD[model.id];
    if (!(Number.isFinite(baseUsdRaw) && baseUsdRaw > 0)) {
      return serverVariants;
    }
    const characterCount =
      options.usageAmount != null && Number.isFinite(options.usageAmount) && options.usageAmount > 0
        ? Math.max(1, Math.round(options.usageAmount))
        : 50_000;
    const usdRaw = baseUsdRaw * (characterCount / 50_000);
    const variantId = buildModelPricingVariantId({
      baseVariantId: OPENAI_TEXT_50K_CHARACTER_VARIANT_ID,
    });
    const quantized = convertUsdToCredits({
      usdRaw,
      modelId: model.id,
      policy: pricingPolicy,
      variantId,
      applyMarkup: true,
    });
    return [
      {
        id: variantId,
        label: OPENAI_TEXT_50K_CHARACTER_LABEL,
        breakdown: {
          usdRaw,
          rawCredits: quantized.rawCredits,
          billedCredits: quantized.credits,
          billedUsd: quantized.billedUsd,
        },
      },
    ];
  }

  if (model.id === ELEVENLABS_SOUND_EFFECTS_MODEL_ID) {
    const autoVariantId = resolveModelPricingVariantId({
      modelId: model.id,
      variantBaseId: ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_VARIANT_ID,
      generationCount: 1,
    });
    const explicitDurationSeconds =
      options.usageAmount != null && Number.isFinite(options.usageAmount) && options.usageAmount > 0
        ? options.usageAmount
        : ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_DEFAULT_SECONDS;
    const autoBreakdown = mapDraftPricingBreakdown(
      model.id,
      buildDefaultPricingParams(model.id, { generationCount: 1 }),
      pricingPolicy
    );
    const explicitBreakdown = mapDraftPricingBreakdown(
      model.id,
      buildDefaultPricingParams(model.id, {
        variantBaseId: ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
        durationSeconds: explicitDurationSeconds,
      }),
      pricingPolicy
    );

    return [
      autoBreakdown
        ? {
            id: autoVariantId,
            label: ELEVENLABS_SOUND_EFFECTS_AUTO_DURATION_LABEL,
            breakdown: autoBreakdown,
          }
        : null,
      explicitBreakdown
        ? {
            id: resolveModelPricingVariantId({
              modelId: model.id,
              variantBaseId: ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID,
              durationSeconds: explicitDurationSeconds,
            }),
            label: ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_LABEL,
            breakdown: explicitBreakdown,
          }
        : null,
    ].filter((variant): variant is AdminPricingPreviewVariant => variant !== null);
  }

  const variants = options.baseVariantId
    ? [
        {
          id: options.baseVariantId,
          label: options.label?.trim() || options.baseVariantId,
          breakdown: null,
        },
      ]
    : serverVariants.length
      ? serverVariants
      : [{ id: "default", label: "Default", breakdown: null }];
  const resolutionOptions = buildResolutionOptions(model, { resolution: options.resolution });
  const audioOptions = buildAudioOptions(model, { audio: options.audio });
  const videoInputOptions = buildVideoInputOptions(model, { videoInput: options.videoInput });

  const draftVariants = variants
    .flatMap((variant) =>
      resolutionOptions.flatMap((resolution) =>
        buildAspectOptions(model, variant.id, { aspect: options.aspect }).flatMap((aspect) =>
          videoInputOptions.flatMap((videoInput) =>
            audioOptions.map((audio): AdminPricingPreviewVariant | null => {
              const usageOverrides = buildModelUsagePricingOverrides(
                model,
                options.usageAmount ?? null
              );
              const inputVideoDurationSeconds =
                videoInput === true
                  ? (usageOverrides.durationSeconds ?? model.defaultDurationSeconds ?? null)
                  : null;
              const params = buildDefaultPricingParams(model.id, {
                variantBaseId: variant.id,
                ...(aspect ? { aspect } : {}),
                ...(resolution ? { resolution } : {}),
                ...(audio != null ? { audio } : {}),
                ...(videoInput != null ? { inputVideoCount: videoInput ? 1 : 0 } : {}),
                ...(inputVideoDurationSeconds != null ? { inputVideoDurationSeconds } : {}),
                ...usageOverrides,
                ...(variant.id === "edit" ? { inputImageCount: 1, inputFidelity: "high" } : {}),
              });
              const breakdown =
                mapDraftPricingBreakdown(model.id, params, pricingPolicy) ?? variant.breakdown;
              if (!breakdown) return null;
              return {
                id: resolveModelPricingVariantId({
                  modelId: model.id,
                  variantBaseId: variant.id,
                  ...(aspect ? { aspect } : {}),
                  ...(resolution ? { resolution } : {}),
                  ...(audio != null ? { audio } : {}),
                  ...(videoInput != null ? { inputVideoCount: videoInput ? 1 : 0 } : {}),
                  ...(inputVideoDurationSeconds != null ? { inputVideoDurationSeconds } : {}),
                  ...(variant.id === "edit"
                    ? {
                        inputImageCount: 1,
                        inputFidelity: "high",
                        maskPresent: false,
                      }
                    : {}),
                }),
                label: variant.label,
                aspect,
                resolution,
                audio,
                videoInput,
                breakdown,
              } satisfies AdminPricingPreviewVariant;
            })
          )
        )
      )
    )
    .filter((variant): variant is AdminPricingPreviewVariant => variant !== null);

  return draftVariants.length ? draftVariants : serverVariants;
};
