/**
 * Shared pricing identifiers for Kling 3.0 Motion Control.
 */

export const KIE_KLING_30_MOTION_CONTROL_VARIANT_ID = "motion_control";
export const KIE_KLING_30_MOTION_CONTROL_LABEL = "Motion Control";
export const KIE_KLING_30_MOTION_CONTROL_PROVIDER_MODEL = "kling-3.0/motion-control";

/**
 * Returns true when pricing params should resolve against the Motion Control row family.
 */
export const isKieKling30MotionControlPricingVariant = (
  variantBaseId: string | null | undefined
): boolean => variantBaseId === KIE_KLING_30_MOTION_CONTROL_VARIANT_ID;

/**
 * Returns true when a Kie payload targets the provider's Motion Control model.
 */
export const isKieKling30MotionControlProviderModel = (value: string | null | undefined): boolean =>
  value?.trim().toLowerCase() === KIE_KLING_30_MOTION_CONTROL_PROVIDER_MODEL;
