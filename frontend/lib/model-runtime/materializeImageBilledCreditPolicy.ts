import { buildDefaultPricingParams, listPricingModelConfigs } from "./pricing";
import { buildModelPricingVariantId } from "./modelPricingVariants";
import type { ModelConfig } from "./modelRegistry";
import {
  compactModelPricingPolicyDocument,
  type ModelPricingPerModelOverride,
  type ModelPricingPolicyDocument,
  type ModelPricingVariantOverride,
} from "./pricingPolicy";
import { resolvePricingGridCostBreakdown } from "./pricingGridBilledCredits";
import {
  shouldExpandAspectPricingVariants,
  shouldExpandResolutionPricingVariants,
} from "./pricingGridVariantRules";

type ImageVariantBase = {
  baseVariantId: string;
  editLike: boolean;
};

const orderWithDefaultFirst = <T extends string | null>(values: T[], defaultValue: T): T[] => {
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

const buildAspectOptions = (model: ModelConfig): string[] => {
  if (!shouldExpandAspectPricingVariants(model.pricingStrategy)) {
    return model.defaultAspect ? [model.defaultAspect] : [];
  }
  return orderWithDefaultFirst(
    model.allowedAspects?.length
      ? model.allowedAspects
      : [model.defaultAspect ?? null].filter(Boolean),
    model.defaultAspect ?? null
  ).filter((value): value is string => Boolean(value));
};

const buildResolutionOptions = (model: ModelConfig): Array<string | null> => {
  if (!shouldExpandResolutionPricingVariants(model.pricingStrategy)) {
    return [model.defaultResolution ?? null];
  }
  return orderWithDefaultFirst(
    model.allowedResolutions?.length ? model.allowedResolutions : [model.defaultResolution ?? null],
    model.defaultResolution ?? null
  );
};

const buildImageVariantBases = (model: ModelConfig): ImageVariantBase[] => {
  if (model.mediaType !== "image") return [];
  if (model.supportsTextToImage && model.supportsImageToImage) {
    return [
      { baseVariantId: "create", editLike: false },
      { baseVariantId: "edit", editLike: true },
    ];
  }
  if (model.supportsImageToImage) {
    return [{ baseVariantId: "default", editLike: true }];
  }
  return [{ baseVariantId: "default", editLike: false }];
};

const mergeVariantOverride = (
  override: ModelPricingPerModelOverride | undefined,
  variantId: string,
  billedCreditsOverride: number
): ModelPricingPerModelOverride => {
  const existingVariants = override?.variants ?? {};
  const existingVariant = existingVariants[variantId] ?? {};
  const nextVariant: ModelPricingVariantOverride = {
    ...existingVariant,
    billedCreditsOverride,
  };
  return {
    ...(override ?? {}),
    variants: {
      ...existingVariants,
      [variantId]: nextVariant,
    },
  };
};

/**
 * Produces a runtime-only policy document where image-model billed credits are
 * materialized per pricing-grid variant. This preserves Scott's admin pricing
 * page as the calculator/authoring surface while letting product runtime paths
 * consume explicit billed-credit rows instead of falling back to shared-policy math.
 */
export const materializeImageBilledCreditPolicy = (
  policy: ModelPricingPolicyDocument | null | undefined
): ModelPricingPolicyDocument => {
  const normalized = compactModelPricingPolicyDocument(policy);
  const nextPolicy: ModelPricingPolicyDocument = {
    ...normalized,
    perModel: { ...normalized.perModel },
  };

  const pricingModels = listPricingModelConfigs();
  pricingModels.forEach((model) => {
    if (model.mediaType !== "image") return;
    const variantBases = buildImageVariantBases(model);
    if (!variantBases.length) return;
    const aspects = buildAspectOptions(model);
    const resolutions = buildResolutionOptions(model);

    variantBases.forEach((variantBase) => {
      aspects.forEach((aspect) => {
        resolutions.forEach((resolution) => {
          const params = buildDefaultPricingParams(model.id, {
            ...(aspect ? { aspect } : {}),
            ...(resolution ? { resolution } : {}),
            ...(variantBase.editLike
              ? {
                  inputImageCount: 1,
                  inputFidelity: "high" as const,
                }
              : {}),
          });

          const breakdown = resolvePricingGridCostBreakdown({
            modelId: model.id,
            params,
            pricingPolicy: normalized,
          });
          if (!breakdown?.credits || breakdown.credits <= 0) return;

          const variantId = buildModelPricingVariantId({
            baseVariantId: variantBase.baseVariantId,
            aspect: aspect ?? null,
            resolution,
            ...(variantBase.editLike
              ? {
                  inputImageCount: 1,
                  inputFidelity: "high" as const,
                  maskPresent: false,
                }
              : {}),
          });

          nextPolicy.perModel[model.id] = mergeVariantOverride(
            nextPolicy.perModel[model.id],
            variantId,
            breakdown.credits
          );
        });
      });
    });
  });

  return compactModelPricingPolicyDocument(nextPolicy);
};
