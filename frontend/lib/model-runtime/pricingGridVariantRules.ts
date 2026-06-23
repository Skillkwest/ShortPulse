/**
 * Shared admin-pricing-grid variant expansion rules.
 * Keeps runtime billed-credit lookups aligned with how the admin pricing grid authors rows.
 */
import { OPENAI_GPT_IMAGE_2_UI_ALLOWED_ASPECTS } from "./openAiImage2";

const ASPECT_EXPANDED_PRICING_STRATEGIES = new Set<string>([
  "fal-per-mp",
  "fal-economy-image-per-mp",
  "fal-fill-per-mp",
  "fal-flux-kontext-inpaint-per-mp",
  "gpt-image-2-per-image",
  "kie-gpt-image-2-per-image",
]);

const RESOLUTION_EXPANDED_PRICING_STRATEGIES = new Set<string>([
  "gpt-image-2-per-image",
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

export const shouldExpandAspectPricingVariants = (pricingStrategy?: string | null): boolean =>
  Boolean(pricingStrategy && ASPECT_EXPANDED_PRICING_STRATEGIES.has(pricingStrategy));

export const shouldExpandResolutionPricingVariants = (pricingStrategy?: string | null): boolean =>
  Boolean(pricingStrategy && RESOLUTION_EXPANDED_PRICING_STRATEGIES.has(pricingStrategy));

export const shouldExpandVideoInputPricingVariants = (pricingStrategy?: string | null): boolean =>
  Boolean(pricingStrategy && VIDEO_INPUT_EXPANDED_PRICING_STRATEGIES.has(pricingStrategy));

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

  if (pricingStrategy === "gpt-image-2-per-image") {
    return [...OPENAI_GPT_IMAGE_2_UI_ALLOWED_ASPECTS].filter((aspect) =>
      baseAspects.includes(aspect)
    );
  }

  if (pricingStrategy === "kie-gpt-image-2-per-image") {
    const appAspects = ["auto", ...OPENAI_GPT_IMAGE_2_UI_ALLOWED_ASPECTS];
    return appAspects.filter((aspect) => baseAspects.includes(aspect));
  }

  return baseAspects;
};
