/**
 * Verifies pricing-policy normalization for legacy and composition-neutral billing contracts.
 */
import { describe, expect, it } from "vitest";

import {
  compactModelPricingPolicyDocument,
  getDefaultModelPricingPolicyDocument,
  modelPricingPolicyDocumentsEqual,
  normalizeModelPricingPolicyDocument,
  resolveModelBillingVariantProfile,
} from "../pricingPolicy";

describe("pricingPolicy", () => {
  it("preserves legacy schema v4 when no v5 billing contract is present", () => {
    const normalized = normalizeModelPricingPolicyDocument({
      schemaVersion: 4,
      global: { creditUsdScale: 100 },
      perModel: { "kie-ai/seedance-2": { markupBps: 5_000 } },
    });

    expect(normalized.schemaVersion).toBe(4);
    expect(resolveModelBillingVariantProfile(normalized, "kie-ai/seedance-2")).toBeNull();
  });

  it("round-trips the composition-neutral profile and output-only quantity basis", () => {
    const policy = compactModelPricingPolicyDocument({
      ...getDefaultModelPricingPolicyDocument(),
      perModel: {
        "kie-ai/seedance-2": {
          billingVariantProfile: "seedance_composition_neutral_v1",
          variants: {
            "default|res:720p|aspect:16:9|audio:on": {
              billedCreditsQuantityRule: {
                costCreditsPerUnit: 6.15,
                markupBps: 5_000,
                roundingIncrement: 1,
                quantityBasis: "per_output_second",
              },
            },
          },
        },
      },
    });

    expect(policy.schemaVersion).toBe(5);
    expect(resolveModelBillingVariantProfile(policy, "kie-ai/seedance-2")).toBe(
      "seedance_composition_neutral_v1"
    );
    expect(
      policy.perModel["kie-ai/seedance-2"]?.variants?.["default|res:720p|aspect:16:9|audio:on"]
        ?.billedCreditsQuantityRule?.quantityBasis
    ).toBe("per_output_second");
  });

  it("treats the profile as part of policy equality", () => {
    const legacy = getDefaultModelPricingPolicyDocument();
    const neutral = {
      ...legacy,
      perModel: {
        "kie-ai/seedance-2": {
          billingVariantProfile: "seedance_composition_neutral_v1" as const,
        },
      },
    };

    expect(modelPricingPolicyDocumentsEqual(legacy, neutral)).toBe(false);
  });

  it("rejects unknown billing profiles instead of reverting to legacy behavior", () => {
    expect(() =>
      normalizeModelPricingPolicyDocument({
        schemaVersion: 5,
        global: { creditUsdScale: 100 },
        perModel: {
          "kie-ai/seedance-2": { billingVariantProfile: "unknown_profile" },
        },
      })
    ).toThrow("Unsupported model billing variant profile");
  });
});
