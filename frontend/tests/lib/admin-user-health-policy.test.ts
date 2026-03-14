/**
 * Regression tests for admin fleet user-health finding/risk policy.
 */
import { describe, expect, it } from "vitest";
import { evaluateFleetUserHealth } from "../../lib/server/adminUserHealth/policy";

const baseMetrics = {
  userId: "user-1",
  email: "user@example.com",
  generatedAt: "2026-03-14T16:00:00.000Z",
  spendableCents: 1000,
  reservedCents: 0,
  failRate24hPercent: 0,
  failCount24h: 0,
  totalCount24h: 0,
  stuckGenerationsCount: 0,
  exhaustedQueueCount: 0,
  reservedWithProviderOver2hCount: 0,
  reservedWithoutProviderOver15mCount: 0,
  costWithoutSuccessCents: 0,
  costWithoutSuccessLinkedCents: 0,
  costWithoutSuccessMissingLinkageCents: 0,
  partialData: false,
  compatibilityWarnings: [] as string[],
};

describe("evaluateFleetUserHealth", () => {
  it("returns healthy baseline when no signals are present", () => {
    const result = evaluateFleetUserHealth(baseMetrics);
    expect(result.highestSeverity).toBe("info");
    expect(result.riskBand).toBe("low");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "HEALTHY_BASELINE",
        }),
      ])
    );
  });

  it("escalates to high risk for stuck generations + aged reservation holds", () => {
    const result = evaluateFleetUserHealth({
      ...baseMetrics,
      stuckGenerationsCount: 2,
      reservedWithProviderOver2hCount: 1,
      failRate24hPercent: 12,
      failCount24h: 6,
      totalCount24h: 50,
      costWithoutSuccessCents: 2600,
      costWithoutSuccessLinkedCents: 1200,
    });

    expect(result.highestSeverity).toBe("critical");
    expect(result.riskBand).toBe("high");
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "ACTIVE_RESERVED_HOLDS",
        "STUCK_GENERATIONS",
        "HIGH_FAIL_RATE_24H",
        "CHARGED_LINKED_NON_SUCCESS_GENERATION",
      ])
    );
    expect(result.nextSteps.length).toBeGreaterThan(0);
  });
});
