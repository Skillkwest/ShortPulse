import { getModelConfig } from "./modelRegistry";
import type { PricingParams } from "./pricingTypes";
import { normalizeDurationForModelConfig } from "./modelDurationConstraints";
import { shouldExpandDurationPricingVariants } from "./pricingGridVariantRules";

export type ModelPricingVariantParts = {
  baseVariantId?: string | null;
  aspect?: string | null;
  resolution?: string | null;
  durationSeconds?: number | null;
  audio?: boolean | null;
  videoInput?: boolean | null;
  inputImageCount?: number | null;
  inputFidelity?: string | null;
  maskPresent?: boolean | null;
};

const INPUT_SENSITIVE_EDIT_PRICING_STRATEGIES = new Set(["gpt-image-2-per-image"]);

export const buildModelPricingVariantId = ({
  baseVariantId,
  aspect,
  resolution,
  durationSeconds,
  audio,
  videoInput,
  inputImageCount,
  inputFidelity,
  maskPresent,
}: ModelPricingVariantParts): string => {
  const idParts = [baseVariantId?.trim() || "default"];
  if (resolution) idParts.push(`res:${resolution}`);
  if (aspect) idParts.push(`aspect:${aspect}`);
  if (durationSeconds != null && Number.isFinite(durationSeconds)) {
    idParts.push(`duration:${Number(durationSeconds.toFixed(3))}s`);
  }
  if (audio != null) idParts.push(`audio:${audio ? "on" : "off"}`);
  if (videoInput != null) idParts.push(`video_input:${videoInput ? "with" : "none"}`);
  if (inputImageCount != null && Number.isFinite(inputImageCount)) {
    idParts.push(`input_images:${Math.max(0, Math.trunc(inputImageCount))}`);
  }
  if (inputFidelity) idParts.push(`input_fidelity:${inputFidelity}`);
  if (maskPresent != null) idParts.push(`mask:${maskPresent ? "yes" : "no"}`);
  return idParts.join("|");
};

const resolveBaseVariantId = (params: PricingParams): string => {
  if (typeof params.variantBaseId === "string" && params.variantBaseId.trim().length > 0) {
    return params.variantBaseId.trim();
  }
  const config = getModelConfig(params.modelId);
  const hasEditInputs = (params.inputImageCount ?? 0) > 0 || params.maskPresent === true;
  if (config?.supportsTextToImage && config?.supportsImageToImage) {
    return hasEditInputs ? "edit" : "create";
  }
  if (hasEditInputs) return "edit";
  return "default";
};

const shouldIncludeEditInputPricingDimensions = (modelId: string): boolean => {
  const pricingStrategy = getModelConfig(modelId)?.pricingStrategy ?? null;
  return pricingStrategy != null && INPUT_SENSITIVE_EDIT_PRICING_STRATEGIES.has(pricingStrategy);
};

export const resolveModelPricingVariantId = (params: PricingParams): string => {
  const config = getModelConfig(params.modelId);
  const aspect = params.aspect ?? config?.defaultAspect ?? null;
  const resolution = params.resolution ?? config?.defaultResolution ?? null;
  const audio =
    typeof params.audio === "boolean"
      ? params.audio
      : typeof config?.defaultAudio === "boolean"
        ? config.defaultAudio
        : null;
  const durationSeconds = shouldExpandDurationPricingVariants(config?.pricingStrategy)
    ? (normalizeDurationForModelConfig(
        typeof params.durationSeconds === "number" ? params.durationSeconds : null,
        config
      ) ??
      normalizeDurationForModelConfig(config?.defaultDurationSeconds ?? null, config) ??
      null)
    : null;
  const videoInput =
    typeof params.inputVideoCount === "number" && Number.isFinite(params.inputVideoCount)
      ? params.inputVideoCount > 0
      : null;
  const includeEditInputPricingDimensions = shouldIncludeEditInputPricingDimensions(params.modelId);

  return buildModelPricingVariantId({
    baseVariantId: resolveBaseVariantId(params),
    aspect,
    resolution,
    durationSeconds,
    audio,
    videoInput,
    inputImageCount:
      includeEditInputPricingDimensions &&
      typeof params.inputImageCount === "number" &&
      Number.isFinite(params.inputImageCount)
        ? params.inputImageCount
        : null,
    inputFidelity: includeEditInputPricingDimensions ? (params.inputFidelity ?? null) : null,
    maskPresent:
      includeEditInputPricingDimensions && typeof params.maskPresent === "boolean"
        ? params.maskPresent
        : null,
  });
};
