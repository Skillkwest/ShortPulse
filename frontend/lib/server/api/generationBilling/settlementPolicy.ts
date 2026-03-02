/**
 * Billing settlement policy helpers.
 * Encodes capture-result decisions without database side effects.
 */
import type { ReservationRpcState } from "./types";

export type CaptureSettlementPolicyDecision = {
  settled: boolean;
  allowLegacyFallback: boolean;
  note: string;
};

/**
 * Resolves capture-result policy into settlement behavior without DB side effects.
 * This keeps recapture/fallback decisions explicit and testable.
 */
export const resolveCaptureSettlementPolicy = (
  status: ReservationRpcState
): CaptureSettlementPolicyDecision => {
  switch (status) {
    case "captured":
    case "already_captured":
      return {
        settled: true,
        allowLegacyFallback: false,
        note: status,
      };
    case "already_released":
      return {
        settled: false,
        allowLegacyFallback: false,
        note: "already_released",
      };
    case "failed":
    case "not_found":
      return {
        settled: false,
        allowLegacyFallback: true,
        note: status,
      };
    default:
      return {
        settled: false,
        allowLegacyFallback: true,
        note: status,
      };
  }
};
