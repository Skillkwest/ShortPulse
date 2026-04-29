/**
 * Unit coverage for reservation-capture settlement policy decisions.
 */
import { describe, expect, it } from "vitest";
import { resolveCaptureSettlementPolicy } from "../generationBilling/settlementPolicy";

describe("resolveCaptureSettlementPolicy", () => {
  it("treats captured states as settled without fallback", () => {
    expect(resolveCaptureSettlementPolicy("captured")).toEqual({
      settled: true,
      allowLinkRepair: false,
      note: "captured",
    });
    expect(resolveCaptureSettlementPolicy("already_captured")).toEqual({
      settled: true,
      allowLinkRepair: false,
      note: "already_captured",
    });
  });

  it("treats already_released as non-settled with no link repair", () => {
    expect(resolveCaptureSettlementPolicy("already_released")).toEqual({
      settled: false,
      allowLinkRepair: false,
      note: "already_released",
    });
  });

  it("allows reservation link repair only for missing reservation states", () => {
    expect(resolveCaptureSettlementPolicy("not_found")).toEqual({
      settled: false,
      allowLinkRepair: true,
      note: "not_found",
    });
    expect(resolveCaptureSettlementPolicy("failed")).toEqual({
      settled: false,
      allowLinkRepair: false,
      note: "failed",
    });
  });
});
