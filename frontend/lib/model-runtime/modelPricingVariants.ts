import { getModelConfig } from "./modelRegistry";
import type { PricingParams } from "./pricingTypes";

export type ModelPricingVariantParts = {
  baseVariantId?: string | null;
  aspect?: string | null;
  resolution?: string | null;
  audio?: boolean | null;
};

export const buildModelPricingVariantId = ({
  baseVariantId,
  aspect,
  resolution,
  audio,
}: ModelPricingVariantParts): string => {
  const idParts = [baseVariantId?.trim() || "default"];
  if (resolution) idParts.push(`res:${resolution}`);
  if (aspect) idParts.push(`aspect:${aspect}`);
  if (audio != null) idParts.push(`audio:${audio ? "on" : "off"}`);
  return idParts.join("|");
};

const resolveBaseVariantId = (params: PricingParams): string => {
  const config = getModelConfig(params.modelId);
  const hasEditInputs = (params.inputImageCount ?? 0) > 0 || params.maskPresent === true;
  if (config?.supportsTextToImage && config?.supportsImageToImage) {
    return hasEditInputs ? "edit" : "create";
  }
  if (hasEditInputs) return "edit";
  return "default";
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

  return buildModelPricingVariantId({
    baseVariantId: resolveBaseVariantId(params),
    aspect,
    resolution,
    audio,
  });
};
