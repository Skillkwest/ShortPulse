/**
 * Output lookup miss/hard-stop policy for AI Studio task polling.
 */
export const OUTPUT_LOOKUP_MISS_MAX_RETRIES = 10;
export const OUTPUT_LOOKUP_MISS_RETRY_DELAY_MS = 400;
export const OUTPUT_LOOKUP_RECOVERY_RETRY_DELAY_MS = 2_000;
export const OUTPUT_LOOKUP_MISS_HARD_STOP_MS = 5 * 60 * 1000;

type OutputLookupEvaluationInput = {
  currentMisses: number;
  missingSinceMs?: number;
  nowMs: number;
};

type OutputLookupEvaluation = {
  lookupMisses: number;
  missingSinceMs: number;
  missingDurationMs: number;
  shouldHardStop: boolean;
  shouldEmitRetryingBreadcrumb: boolean;
  retryDelayMs: number;
};

/**
 * Computes retry/hard-stop decision when output lookup misses during polling.
 */
export const evaluateOutputLookupMiss = ({
  currentMisses,
  missingSinceMs,
  nowMs,
}: OutputLookupEvaluationInput): OutputLookupEvaluation => {
  const lookupMisses = currentMisses + 1;
  const nextMissingSinceMs = missingSinceMs ?? nowMs;
  const missingDurationMs = nowMs - nextMissingSinceMs;
  const shouldHardStop = missingDurationMs > OUTPUT_LOOKUP_MISS_HARD_STOP_MS;
  const shouldEmitRetryingBreadcrumb = lookupMisses === OUTPUT_LOOKUP_MISS_MAX_RETRIES + 1;
  const retryDelayMs =
    lookupMisses <= OUTPUT_LOOKUP_MISS_MAX_RETRIES
      ? OUTPUT_LOOKUP_MISS_RETRY_DELAY_MS
      : OUTPUT_LOOKUP_RECOVERY_RETRY_DELAY_MS;
  return {
    lookupMisses,
    missingSinceMs: nextMissingSinceMs,
    missingDurationMs,
    shouldHardStop,
    shouldEmitRetryingBreadcrumb,
    retryDelayMs,
  };
};
