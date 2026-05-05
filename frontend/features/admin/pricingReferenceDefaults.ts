/**
 * Reference calculator defaults mirrored from the standalone pricing calculator.
 * These values are draft-only when loaded into the admin pricing surface.
 */
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
} from "../../lib/model-runtime/providerModelIds";
import type { ModelPricingPolicyDocument } from "../../lib/model-runtime/pricingPolicy";
import type { PlanEconomicsDraft } from "./pricingAnalysis";

export const CALCULATOR_REFERENCE_CREDIT_USD_SCALE = 30;
export const CALCULATOR_REFERENCE_MARKUP_BPS = 8_000;
export const CALCULATOR_REFERENCE_DURATION_SECONDS = "15";
export const CALCULATOR_REFERENCE_PLAN_PRICE_USD = "49.00";
export const CALCULATOR_REFERENCE_INCLUDED_CREDITS = "1500";
export const CALCULATOR_REFERENCE_DISCOUNT_PCT = "0";
export const CALCULATOR_REFERENCE_AFFILIATE_PCT = "0";
export const CALCULATOR_REFERENCE_PROCESSOR_PCT = "2.9";
export const CALCULATOR_REFERENCE_PROCESSOR_FLAT_USD = "0.30";

export const CALCULATOR_REFERENCE_MODEL_IDS = [
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
] as const;

/** Build the small-calculator plan defaults used for analysis-only tabs. */
export const buildCalculatorReferencePlanDraft = (): PlanEconomicsDraft => ({
  priceUsd: CALCULATOR_REFERENCE_PLAN_PRICE_USD,
  includedCredits: CALCULATOR_REFERENCE_INCLUDED_CREDITS,
  discountPct: CALCULATOR_REFERENCE_DISCOUNT_PCT,
  affiliatePct: CALCULATOR_REFERENCE_AFFILIATE_PCT,
  processorPct: CALCULATOR_REFERENCE_PROCESSOR_PCT,
  processorFlatUsd: CALCULATOR_REFERENCE_PROCESSOR_FLAT_USD,
});

/** Apply the calculator's known shared-policy defaults to the current draft policy. */
export const applyCalculatorReferencePolicyDefaults = (
  currentPolicy: ModelPricingPolicyDocument
): ModelPricingPolicyDocument => ({
  ...currentPolicy,
  global: {
    ...currentPolicy.global,
    creditUsdScale: CALCULATOR_REFERENCE_CREDIT_USD_SCALE,
  },
  perModel: {
    ...currentPolicy.perModel,
    ...Object.fromEntries(
      CALCULATOR_REFERENCE_MODEL_IDS.map((modelId) => [
        modelId,
        {
          ...currentPolicy.perModel[modelId],
          markupBps: CALCULATOR_REFERENCE_MARKUP_BPS,
        },
      ])
    ),
  },
});

/** Apply the calculator's known duration defaults to the current duration draft map. */
export const applyCalculatorReferenceDurationDrafts = (
  currentDrafts: Record<string, string>
): Record<string, string> => ({
  ...currentDrafts,
  ...Object.fromEntries(
    CALCULATOR_REFERENCE_MODEL_IDS.map((modelId) => [
      modelId,
      CALCULATOR_REFERENCE_DURATION_SECONDS,
    ])
  ),
});
