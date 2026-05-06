import type {
  AdminCreditPricingBreakdown,
  AdminPricingModelRow,
  AdminPricingPreviewVariant,
} from "./types";
import { buildDefaultPricingParams, computeCostForModel } from "../../lib/model-runtime/pricing";
import { shouldShowAudioSpecControl } from "./pricingDrafts";

export type CostDocsPopover = {
  x: number;
  y: number;
  title: string;
  sourceUrl: string;
  lines: string[];
};

const COST_DOCS_POPOVER_WIDTH = 380;
const COST_DOCS_POPOVER_HEIGHT = 260;

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
  variant: AdminPricingPreviewVariant | null
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
    case "gpt-image-2-per-image":
      return [
        "Provider cost basis used here: GPT Image 2 output image price by size and quality.",
        "1024x1024: low $0.006, medium $0.053, high $0.211.",
        "1024x1536 or 1536x1024: low $0.005, medium $0.041, high $0.165.",
        variant?.id === "edit"
          ? "Edit rows add the deterministic input-image surcharge for the selected size and input fidelity."
          : "Create rows use only the output image price unless extra inputs are supplied.",
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
    case "seedance-1.5-per-second":
      return [
        "Provider cost basis used here: Kie credits convert at $0.005 per credit.",
        "Seedance 1.5 Pro 1080p: 7.5 credits/sec without audio, 15 credits/sec with audio.",
        "720p: 3.5 credits/sec without audio, 7 credits/sec with audio. 480p: 2 credits/sec without audio, 4 credits/sec with audio.",
      ];
    case "seedance-2-per-second":
    case "seedance-2-fast-per-second":
      return [
        "Provider cost basis used here: tokenized video pricing by resolution, frame rate, duration, and audio setting.",
        "Formula: width x height x 24 fps x duration / 1024 tokens.",
        "Rates: $1.20 per million tokens without audio, $2.40 per million tokens with audio.",
      ];
    case "elevenlabs-music-per-minute":
      return [
        "Provider cost basis used here: $0.30 per generated music minute.",
        "Workbook formula: duration seconds / 60 multiplied by the provider rate.",
        "Duration controls follow the current ShortPulse music request range.",
      ];
    case "elevenlabs-sound-effect":
      return [
        "Provider cost basis used here: $0.12 per auto-duration sound-effect generation.",
        "Explicit-duration sound effects are normalized to $0.024 per second.",
        "The workbook starts at 5s because 5s matches the auto-duration $0.12 baseline.",
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
        "Provider cost basis used here: OpenAI standard short-context token rates.",
        "GPT-5.4: input $2.50/M, cached input $0.25/M, output $15.00/M.",
        "GPT-5.4 Mini: input $0.75/M, cached input $0.075/M, output $4.50/M.",
        "GPT-5.4 Nano: input $0.20/M, cached input $0.02/M, output $1.25/M.",
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

const shouldExpandAspectPricingVariants = (model: AdminPricingModelRow): boolean =>
  [
    "fal-per-mp",
    "fal-economy-image-per-mp",
    "fal-fill-per-mp",
    "fal-flux-kontext-inpaint-per-mp",
    "gpt-image-2-per-image",
    "seedance-2-per-second",
    "seedance-2-fast-per-second",
  ].includes(model.pricingStrategy);

const shouldExpandResolutionPricingVariants = (model: AdminPricingModelRow): boolean =>
  [
    "gpt-image-2-per-image",
    "nano-banana-2-per-image",
    "nano-banana-per-image",
    "seedream-per-image",
    "seedream-5-lite-per-image",
    "veo-3-per-second",
    "seedance-1.5-per-second",
    "seedance-2-per-second",
    "seedance-2-fast-per-second",
  ].includes(model.pricingStrategy);

const buildAspectOptions = (
  model: AdminPricingModelRow,
  options: { aspect?: string | null }
): string[] => {
  if (options.aspect) return [options.aspect];
  if (!shouldExpandAspectPricingVariants(model)) return [model.defaultAspect];
  return orderWithDefaultFirst(
    model.allowedAspects.length ? model.allowedAspects : [model.defaultAspect],
    model.defaultAspect
  );
};

const buildResolutionOptions = (
  model: AdminPricingModelRow,
  options: { resolution?: string | null }
): Array<string | null> => {
  if (options.resolution !== undefined) return [options.resolution ?? null];
  if (!shouldExpandResolutionPricingVariants(model)) return [model.defaultResolution ?? null];
  return orderWithDefaultFirst(
    model.allowedResolutions.length ? model.allowedResolutions : [model.defaultResolution ?? null],
    model.defaultResolution ?? null
  );
};

const buildAudioOptions = (
  model: AdminPricingModelRow,
  options: { audio?: boolean | null }
): Array<boolean | null> => {
  if (options.audio !== undefined) return [options.audio];
  if (!shouldShowAudioSpecControl(model)) return [null];
  return orderWithDefaultFirst([true, false], model.defaultAudio ?? true);
};

const buildVariantId = ({
  baseVariantId,
  aspect,
  resolution,
  audio,
}: {
  baseVariantId: string;
  aspect: string;
  resolution: string | null;
  audio: boolean | null;
}): string => {
  const idParts = [baseVariantId];
  if (resolution) idParts.push(`res:${resolution}`);
  if (aspect) idParts.push(`aspect:${aspect}`);
  if (audio != null) idParts.push(`audio:${audio ? "on" : "off"}`);
  return idParts.join("|");
};

export const buildDraftPricingPreviewVariants = (
  model: AdminPricingModelRow,
  pricingPolicy: Parameters<typeof computeCostForModel>[2],
  options: {
    durationSeconds?: number | null;
    aspect?: string | null;
    resolution?: string | null;
    audio?: boolean | null;
  } = {}
): AdminPricingPreviewVariant[] => {
  const serverVariants = model.pricingPreviewVariants.length
    ? model.pricingPreviewVariants
    : model.pricingPreview
      ? [{ id: "default", label: "Default", breakdown: model.pricingPreview }]
      : [];

  if (model.pricingAuthority !== "shared_policy") return serverVariants;

  const variants = serverVariants.length
    ? serverVariants
    : [{ id: "default", label: "Default", breakdown: null }];
  const aspectOptions = buildAspectOptions(model, { aspect: options.aspect });
  const resolutionOptions = buildResolutionOptions(model, { resolution: options.resolution });
  const audioOptions = buildAudioOptions(model, { audio: options.audio });

  const draftVariants = variants
    .flatMap((variant) =>
      resolutionOptions.flatMap((resolution) =>
        aspectOptions.flatMap((aspect) =>
          audioOptions.map((audio): AdminPricingPreviewVariant | null => {
            const durationSeconds = options.durationSeconds ?? null;
            const durationOverrides =
              durationSeconds != null
                ? model.pricingStrategy === "elevenlabs-voice-changer-per-minute"
                  ? { sourceDurationSeconds: durationSeconds }
                  : { durationSeconds }
                : {};
            const params = buildDefaultPricingParams(model.id, {
              ...(aspect ? { aspect } : {}),
              ...(resolution ? { resolution } : {}),
              ...(audio != null ? { audio } : {}),
              ...durationOverrides,
              ...(variant.id === "edit" ? { inputImageCount: 1, inputFidelity: "high" } : {}),
            });
            const breakdown =
              mapDraftPricingBreakdown(model.id, params, pricingPolicy) ?? variant.breakdown;
            if (!breakdown) return null;
            return {
              id: buildVariantId({
                baseVariantId: variant.id,
                aspect,
                resolution,
                audio,
              }),
              label: variant.label,
              aspect,
              resolution,
              audio,
              breakdown,
            } satisfies AdminPricingPreviewVariant;
          })
        )
      )
    )
    .filter((variant): variant is AdminPricingPreviewVariant => variant !== null);

  return draftVariants.length ? draftVariants : serverVariants;
};
