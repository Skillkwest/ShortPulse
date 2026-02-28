/**
 * Retrieval engine scoring helpers for Fal alias sweep decisions.
 * Deterministic ranking prevents random terminal/no-media selection drift.
 */

import type { ResultProbeCandidate, StatusProbeCandidate } from "./contracts";
import {
  selectBestProviderResultCandidate,
  selectBestProviderStatusCandidate,
} from "../providerIntegration/statusProviderSelection";

/**
 * Legacy Fal compatibility wrapper for status probe candidate selection.
 */
export const selectBestStatusCandidate = (
  candidates: StatusProbeCandidate[]
): StatusProbeCandidate | null => {
  return selectBestProviderStatusCandidate({
    provider: "fal",
    candidates,
  });
};

/**
 * Legacy Fal compatibility wrapper for result probe candidate selection.
 */
export const selectBestResultCandidate = (
  candidates: ResultProbeCandidate[]
): ResultProbeCandidate | null => {
  return selectBestProviderResultCandidate({
    provider: "fal",
    candidates,
  });
};
