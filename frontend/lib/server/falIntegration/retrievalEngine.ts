/**
 * Retrieval engine scoring helpers for Fal alias sweep decisions.
 * Deterministic ranking prevents random terminal/no-media selection drift.
 */

import type { ResultProbeCandidate, StatusProbeCandidate } from "./contracts";

const scoreStatusCandidate = (candidate: StatusProbeCandidate): number => {
  let score = 0;
  if (candidate.isHttpOk) score += 40;
  if (candidate.isCompleted) score += 40;
  if (candidate.isFailed) score -= 30;
  if (candidate.isTerminal) score += 15;
  if (candidate.hasMedia) score += 30;
  if (candidate.hasResponseUrl) score += 12;
  score -= candidate.index;
  return score;
};

const scoreResultCandidate = (candidate: ResultProbeCandidate): number => {
  let score = 0;
  if (candidate.isHttpOk) score += 40;
  if (candidate.hasMedia) score += 45;
  if (candidate.hasError) score -= 30;
  if (candidate.status === "completed" || candidate.status === "succeeded") score += 12;
  if (candidate.status === "error" || candidate.status === "failed") score -= 12;
  score -= candidate.index;
  return score;
};

/**
 * Picks the highest-confidence status probe candidate.
 */
export const selectBestStatusCandidate = (
  candidates: StatusProbeCandidate[]
): StatusProbeCandidate | null => {
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) => scoreStatusCandidate(b) - scoreStatusCandidate(a))[0];
};

/**
 * Picks the highest-confidence result probe candidate.
 */
export const selectBestResultCandidate = (
  candidates: ResultProbeCandidate[]
): ResultProbeCandidate | null => {
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) => scoreResultCandidate(b) - scoreResultCandidate(a))[0];
};
