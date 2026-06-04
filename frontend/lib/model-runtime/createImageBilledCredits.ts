import { getModelConfig } from "./modelRegistry";
import {
  resolvePricingGridCostBreakdown,
  type PricingGridCostBreakdown,
} from "./pricingGridBilledCredits";
import type { ModelPricingPolicyDocument, ModelPricingRuntimeAuthority } from "./pricingPolicy";
import type { PricingParams } from "./pricingTypes";

export type CreateImageBilledCreditLookup = {
  modelId: string;
  params: Omit<PricingParams, "modelId">;
  breakdown: PricingGridCostBreakdown | null;
  authorityMode: "explicit_row" | "runtime_quantity_derived" | null;
};

const hasEditLikeCreateInputs = (params: Omit<PricingParams, "modelId">): boolean =>
  (params.inputImageCount ?? 0) > 0 || params.maskPresent === true;

export const normalizeCreateImageBilledPricingParams = (
  modelId: string,
  params: Omit<PricingParams, "modelId"> = {}
): Omit<PricingParams, "modelId"> => {
  const normalized: Omit<PricingParams, "modelId"> = { ...params };
  const config = getModelConfig(modelId);
  const editLike = hasEditLikeCreateInputs(normalized);

  if (config?.supportsTextToImage && config?.supportsImageToImage) {
    normalized.variantBaseId = editLike ? "edit" : "create";
  } else if (config?.supportsTextToImage) {
    // Ref-driven standard Create stays on the text-image priced row unless the
    // model uses a combined create/edit catalog entry like GPT Image 2.
    if (editLike) {
      normalized.variantBaseId = "default";
    }
  } else if (editLike) {
    normalized.variantBaseId = "edit";
  }

  if (editLike && normalized.maskPresent == null) {
    normalized.maskPresent = false;
  }

  return normalized;
};

function resolveCreateImageRuntimeAuthority(
  modelId: string,
  pricingPolicy: ModelPricingPolicyDocument | null | undefined
): ModelPricingRuntimeAuthority | null {
  const authority = pricingPolicy?.perModel?.[modelId]?.runtimeAuthorities?.create_image;
  if (!authority || authority.mode !== "runtime_quantity_derived") {
    return null;
  }
  return authority;
}

export const resolveCreateImageBilledCreditLookup = ({
  modelId,
  params = {},
  pricingPolicy = null,
}: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): CreateImageBilledCreditLookup => {
  const normalizedParams = normalizeCreateImageBilledPricingParams(modelId, params);
  const explicitBreakdown = resolvePricingGridCostBreakdown({
    modelId,
    params: normalizedParams,
    pricingPolicy,
    requireExplicitBilledCreditsOverride: true,
  });
  const derivedAuthority = resolveCreateImageRuntimeAuthority(modelId, pricingPolicy);
  const breakdown =
    explicitBreakdown ??
    (derivedAuthority
      ? resolvePricingGridCostBreakdown({
          modelId,
          params: normalizedParams,
          pricingPolicy,
          requireExplicitBilledCreditsOverride: false,
        })
      : null);
  return {
    modelId,
    params: normalizedParams,
    breakdown,
    authorityMode: explicitBreakdown
      ? "explicit_row"
      : breakdown && derivedAuthority
        ? "runtime_quantity_derived"
        : null,
  };
};

export const resolveCreateImageBilledCreditBreakdown = (input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): PricingGridCostBreakdown | null => resolveCreateImageBilledCreditLookup(input).breakdown;

export const resolveCreateImageBilledCredits = (input: {
  modelId: string;
  params?: Omit<PricingParams, "modelId">;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): number | null => resolveCreateImageBilledCreditBreakdown(input)?.credits ?? null;
