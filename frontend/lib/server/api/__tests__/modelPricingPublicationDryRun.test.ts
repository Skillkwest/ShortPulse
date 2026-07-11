import { describe, expect, it } from "vitest";

import { getDefaultAdminPricingCustomRowsDocument } from "../../../model-runtime/adminPricingCustomRows";
import { getDefaultModelPricingPolicyDocument } from "../../../model-runtime/pricingPolicy";
import {
  buildModelPricingPublicationDryRun,
  buildSeedanceCompositionNeutralPublicationDryRun,
} from "../modelPricingPublicationDryRun";

describe("buildModelPricingPublicationDryRun", () => {
  it("deterministically reports the complete publication without mutating the active policy", () => {
    const activePolicy = getDefaultModelPricingPolicyDocument();
    const inputSnapshot = JSON.stringify(activePolicy);
    const input = {
      activePolicyVersion: 9,
      activePolicy,
      activeCustomRows: getDefaultAdminPricingCustomRowsDocument(),
    };

    const first = buildModelPricingPublicationDryRun(input);
    const second = buildModelPricingPublicationDryRun(input);

    expect(first.activePolicyVersion).toBe(9);
    expect(first.addedRules.length).toBeGreaterThan(0);
    expect(first.changedRules).toEqual([]);
    expect(first.removedRules).toEqual([]);
    expect(first.missingRules).toEqual([]);
    expect(first.complete).toBe(true);
    expect(first.publishedRuleCount).toBe(first.addedRules.length);
    expect(first.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toEqual(first);
    expect(JSON.stringify(activePolicy)).toBe(inputSnapshot);
  });
});

describe("buildSeedanceCompositionNeutralPublicationDryRun", () => {
  it("diffs the materialized legacy rows against a deterministic five-row target", () => {
    const activePolicy = {
      ...getDefaultModelPricingPolicyDocument(),
      schemaVersion: 4 as const,
      perModel: {
        "kie-ai/seedance-2": { markupBps: 5_000 },
      },
    };
    const inputSnapshot = JSON.stringify(activePolicy);
    const result = buildSeedanceCompositionNeutralPublicationDryRun({
      activePolicyVersion: 9,
      activePolicyVersionId: 10,
      activePolicy,
      activeCustomRows: getDefaultAdminPricingCustomRowsDocument(),
    });

    expect(result.activePolicyVersionId).toBe(10);
    expect(result.targetBillingVariantProfile).toBe("seedance_composition_neutral_v1");
    expect(result.addedRules).toHaveLength(5);
    expect(result.removedRules).toHaveLength(10);
    expect(result.changedRules).toEqual([]);
    expect(result.proposedSeedanceRules).toHaveLength(5);
    expect(
      result.proposedSeedanceRules.every((row) => !row.variantId?.includes("video_input:"))
    ).toBe(true);
    expect(result.rateComparisons).toHaveLength(5);
    expect(result.rateComparisons).toContainEqual({
      modelId: "kie-ai/seedance-2",
      resolution: "720p",
      continuityCostCreditsPerOutputSecond: 30.75,
      equalDurationConservativeCostCreditsPerOutputSecond: 37.5,
    });
    expect(result.marginEnvelopes).toHaveLength(100);
    expect(result.complete).toBe(true);
    const comparable = result.marginEnvelopes.filter(
      (row) =>
        row.modelId === "kie-ai/seedance-2" &&
        row.resolution === "720p" &&
        row.outputDurationSeconds === 4
    );
    expect(new Set(comparable.map((row) => row.customerCredits))).toHaveLength(1);
    expect(result.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(activePolicy)).toBe(inputSnapshot);
  });
});
