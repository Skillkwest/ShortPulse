import { describe, expect, it } from "vitest";
import {
  buildPricingObservabilityEvent,
  dedupePricingObservabilityEventsByRun,
} from "../adminBillingDiagnosticsMappers";

describe("admin billing pricing observability", () => {
  it("maps policy and variant evidence from generation metadata", () => {
    const event = buildPricingObservabilityEvent({
      sourceType: "reservation",
      rowId: "reservation-1",
      sourceRef: "run-1",
      requestId: "provider-1",
      observedAt: "2026-07-10T12:00:00.000Z",
      metadata: {
        pricing_observability: {
          mismatch: true,
          displayed_billed_credits: 7,
          actual_billed_credits: 9,
          delta_credits: 2,
          displayed_pricing_policy_version: 11,
          actual_pricing_policy_version: 12,
          displayed_pricing_variant_id: "old-variant",
          actual_pricing_variant_id: "current-variant",
        },
      },
    });

    expect(event).toMatchObject({
      displayedPricingPolicyVersion: 11,
      actualPricingPolicyVersion: 12,
      displayedPricingVariantId: "old-variant",
      actualPricingVariantId: "current-variant",
    });
  });

  it("counts reservation and ledger copies as one generation run", () => {
    const reservation = buildPricingObservabilityEvent({
      sourceType: "reservation",
      rowId: "reservation-1",
      sourceRef: "run-1",
      requestId: "provider-1",
      observedAt: "2026-07-10T12:00:00.000Z",
      metadata: { pricing_observability: { mismatch: true } },
    });
    const ledger = buildPricingObservabilityEvent({
      sourceType: "ledger",
      rowId: "ledger-1",
      sourceRef: "run-1",
      requestId: null,
      observedAt: "2026-07-10T11:59:59.000Z",
      metadata: { pricing_observability: { mismatch: true } },
    });

    expect(dedupePricingObservabilityEventsByRun([reservation!, ledger!])).toEqual([reservation]);
  });
});
