/**
 * Unit coverage for reservation-capture settlement policy decisions.
 */
import { describe, expect, it } from "vitest";
import { resolveCaptureSettlementPolicy } from "../generationBilling/settlementPolicy";

describe("resolveCaptureSettlementPolicy", () => {
  it("treats captured states as settled without fallback", () => {
    expect(resolveCaptureSettlementPolicy("captured")).toEqual({
      settled: true,
      allowLegacyFallback: false,
      note: "captured",
    });
    expect(resolveCaptureSettlementPolicy("already_captured")).toEqual({
      settled: true,
      allowLegacyFallback: false,
      note: "already_captured",
    });
  });

  it("treats already_released as non-settled with no legacy fallback", () => {
    expect(resolveCaptureSettlementPolicy("already_released")).toEqual({
      settled: false,
      allowLegacyFallback: false,
      note: "already_released",
    });
  });

  it("allows legacy fallback for failed/not_found states", () => {
    expect(resolveCaptureSettlementPolicy("failed")).toEqual({
      settled: false,
      allowLegacyFallback: true,
      note: "failed",
    });
    expect(resolveCaptureSettlementPolicy("not_found")).toEqual({
      settled: false,
      allowLegacyFallback: true,
      note: "not_found",
    });
  });
});
