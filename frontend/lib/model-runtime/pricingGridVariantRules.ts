/**
 * Shared admin-pricing-grid variant expansion rules.
 * Keeps runtime billed-credit lookups aligned with how the admin pricing grid authors rows.
 */
import {
  resolveModelBillingVariantProfile,
  type ModelPricingPolicyDocument,
} from "./pricingPolicy";

const GPT_IMAGE_2_APP_SUPPORTED_ASPECTS = ["9:16", "4:5", "1:1", "5:4", "16:9"] as const;

const ASPECT_EXPANDED_PRICING_STRATEGIES = new Set<string>([
  "fal-per-mp",
  "fal-economy-image-per-mp",
  "fal-fill-per-mp",
  "fal-flux-kontext-inpaint-per-mp",
  "kie-gpt-image-2-per-image",
]);

const RESOLUTION_EXPANDED_PRICING_STRATEGIES = new Set<string>([
  "kie-gpt-image-2-per-image",
  "kling-3-per-second",
  "nano-banana-2-per-image",
  "nano-banana-per-image",
  "omnihuman-v15-per-second",
  "seedream-per-image",
  "seedream-5-lite-per-image",
  "veo-3-per-second",
  "seedance-2-per-second",
  "seedance-2-fast-per-second",
]);

const VIDEO_INPUT_EXPANDED_PRICING_STRATEGIES = new Set<string>([
  "seedance-2-per-second",
  "seedance-2-fast-per-second",
]);

const CUSTOMER_OUTPUT_DURATION_INPUT_PRICING_STRATEGIES = new Set<string>([
  "seedance-2-per-second",
  "seedance-2-fast-per-second",
]);

export const shouldExpandAspectPricingVariants = (pricingStrategy?: string | null): boolean =>
  Boolean(pricingStrategy && ASPECT_EXPANDED_PRICING_STRATEGIES.has(pricingStrategy));

export const shouldExpandResolutionPricingVariants = (pricingStrategy?: string | null): boolean =>
  Boolean(pricingStrategy && RESOLUTION_EXPANDED_PRICING_STRATEGIES.has(pricingStrategy));

export const shouldExpandVideoInputPricingVariants = (pricingStrategy?: string | null): boolean =>
  Boolean(pricingStrategy && VIDEO_INPUT_EXPANDED_PRICING_STRATEGIES.has(pricingStrategy));

export const shouldUseOutputDurationForCustomerQuantity = (
  pricingStrategy?: string | null
): boolean =>
  Boolean(
    pricingStrategy && CUSTOMER_OUTPUT_DURATION_INPUT_PRICING_STRATEGIES.has(pricingStrategy)
  );

/**
 * Resolves the customer-facing video-input dimension for a model and policy.
 * Provider economics continue using the low-level split variant identifiers.
 */
export const shouldExpandCustomerVideoInputPricingVariants = ({
  modelId,
  pricingStrategy,
  pricingPolicy,
}: {
  modelId: string;
  pricingStrategy?: string | null;
  pricingPolicy?: ModelPricingPolicyDocument | null;
}): boolean =>
  shouldExpandVideoInputPricingVariants(pricingStrategy) &&
  resolveModelBillingVariantProfile(pricingPolicy, modelId) !== "seedance_composition_neutral_v1";

export const resolvePricingGridAspectOptions = ({
  pricingStrategy,
  allowedAspects,
  defaultAspect,
}: {
  pricingStrategy?: string | null;
  allowedAspects?: readonly string[] | null;
  defaultAspect?: string | null;
}): string[] => {
  const baseAspects = allowedAspects?.length
    ? [...allowedAspects]
    : [defaultAspect].filter((value): value is string => Boolean(value));

  if (pricingStrategy === "kie-gpt-image-2-per-image") {
    const appAspects = ["auto", ...GPT_IMAGE_2_APP_SUPPORTED_ASPECTS];
    return appAspects.filter((aspect) => baseAspects.includes(aspect));
  }

  return baseAspects;
};
