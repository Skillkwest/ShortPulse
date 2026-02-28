/**
 * Provider-owned status/result candidate selection policy.
 * Keeps scoring logic inside providerIntegration so runtime callers remain provider-neutral.
 */

import type { ResultProbeCandidate, StatusProbeCandidate } from "../falIntegration/contracts";

const normalizeProvider = (provider: string): string => provider.trim().toLowerCase();

const assertSupportedProvider = (provider: string): void => {
  if (provider.startsWith("fal")) return;
  throw new Error("Unsupported provider for status candidate selection");
};

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
 * Picks the highest-confidence status probe candidate for a provider.
 */
export const selectBestProviderStatusCandidate = ({
  provider,
  candidates,
}: {
  provider: string;
  candidates: StatusProbeCandidate[];
}): StatusProbeCandidate | null => {
  const providerKey = normalizeProvider(provider);
  assertSupportedProvider(providerKey);
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) => scoreStatusCandidate(b) - scoreStatusCandidate(a))[0];
};

/**
 * Picks the highest-confidence result probe candidate for a provider.
 */
export const selectBestProviderResultCandidate = ({
  provider,
  candidates,
}: {
  provider: string;
  candidates: ResultProbeCandidate[];
}): ResultProbeCandidate | null => {
  const providerKey = normalizeProvider(provider);
  assertSupportedProvider(providerKey);
  if (!candidates.length) return null;
  return candidates.slice().sort((a, b) => scoreResultCandidate(b) - scoreResultCandidate(a))[0];
};
