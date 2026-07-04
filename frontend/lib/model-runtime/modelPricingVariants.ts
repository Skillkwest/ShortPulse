import { getModelConfig } from "./modelRegistry";
import { isKieKling30MotionControlPricingVariant } from "./klingMotionControlPricing";
import { ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID } from "./elevenLabsModels";
import type { PricingParams } from "./pricingTypes";

export type ModelPricingVariantParts = {
  baseVariantId?: string | null;
  aspect?: string | null;
  resolution?: string | null;
  audio?: boolean | null;
  videoInput?: boolean | null;
  inputImageCount?: number | null;
  inputFidelity?: string | null;
  maskPresent?: boolean | null;
};

const INPUT_SENSITIVE_EDIT_PRICING_STRATEGIES = new Set<string>();

export const buildModelPricingVariantId = ({
  baseVariantId,
  aspect,
  resolution,
  audio,
  videoInput,
  inputImageCount,
  inputFidelity,
  maskPresent,
}: ModelPricingVariantParts): string => {
  const idParts = [baseVariantId?.trim() || "default"];
  if (resolution) idParts.push(`res:${resolution}`);
  if (aspect) idParts.push(`aspect:${aspect}`);
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
  if (
    config?.pricingStrategy === "elevenlabs-sound-effect" &&
    typeof params.durationSeconds === "number" &&
    Number.isFinite(params.durationSeconds) &&
    params.durationSeconds > 0
  ) {
    return ELEVENLABS_SOUND_EFFECTS_EXPLICIT_DURATION_VARIANT_ID;
  }
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
  const isKlingMotionControl = isKieKling30MotionControlPricingVariant(
    params.variantBaseId ?? null
  );
  const aspect = isKlingMotionControl ? null : (params.aspect ?? config?.defaultAspect ?? null);
  const resolution = params.resolution ?? config?.defaultResolution ?? null;
  const audio =
    typeof params.audio === "boolean"
      ? params.audio
      : typeof config?.defaultAudio === "boolean"
        ? config.defaultAudio
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
