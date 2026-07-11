import { describe, expect, it } from "vitest";

import { getDefaultAdminPricingCustomRowsDocument } from "../../../model-runtime/adminPricingCustomRows";
import { getDefaultModelPricingPolicyDocument } from "../../../model-runtime/pricingPolicy";
import { buildModelPricingPublicationDryRun } from "../modelPricingPublicationDryRun";

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
