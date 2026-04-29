/**
 * Billing settlement policy helpers.
 * Encodes capture-result decisions without database side effects.
 */
import type { ReservationRpcState } from "./types";

export type CaptureSettlementPolicyDecision = {
  settled: boolean;
  allowLinkRepair: boolean;
  note: string;
};

/**
 * Resolves capture-result policy into settlement behavior without DB side effects.
 * This keeps recapture and reservation-link repair decisions explicit and testable.
 */
export const resolveCaptureSettlementPolicy = (
  status: ReservationRpcState
): CaptureSettlementPolicyDecision => {
  switch (status) {
    case "captured":
    case "already_captured":
      return {
        settled: true,
        allowLinkRepair: false,
        note: status,
      };
    case "already_released":
      return {
        settled: false,
        allowLinkRepair: false,
        note: "already_released",
      };
    case "not_found":
      return {
        settled: false,
        allowLinkRepair: true,
        note: status,
      };
    case "failed":
    default:
      return {
        settled: false,
        allowLinkRepair: false,
        note: status,
      };
  }
};
