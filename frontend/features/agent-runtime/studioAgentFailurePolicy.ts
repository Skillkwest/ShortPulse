/**
 * Shared failure classification and retry helpers for AI Studio agent runtime lanes.
 * Keeps user-lane fallback policy consistent across retained AI Studio agent routes.
 */

export const STUDIO_AGENT_INFRA_FALLBACK_MESSAGE =
  "I can't process that request right now. Please try again.";

export type StudioAgentFailureClass =
  | "safety_refusal"
  | "infra_transient"
  | "infra_runtime"
  | "output_contract"
  | "auth_config"
  | "invalid_request";

export type StudioAgentFailureResolution =
  | "assistant_fallback"
  | "canonical_refusal"
  | "hard_error";

const AUTH_STATUS_CODES = new Set([401, 403]);
const INVALID_REQUEST_STATUS_CODES = new Set([
  400, 404, 405, 406, 409, 410, 411, 413, 414, 415, 422, 431,
]);
const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

const AUTH_DETAIL_PATTERNS: RegExp[] = [
  /\binvalid\s+api\s+key\b/i,
  /\bincorrect\s+api\s+key\b/i,
  /\bauth(?:entication|orization)?\b/i,
  /\bunauthorized\b/i,
  /\bforbidden\b/i,
  /\bpermission\b/i,
  /\bapi\s+key\b/i,
];

const TRANSIENT_DETAIL_PATTERNS: RegExp[] = [
  /\btimeout\b/i,
  /\btimed\s*out\b/i,
  /\bnetwork\b/i,
  /\btemporar(?:y|ily)\b/i,
  /\brate\s*limit\b/i,
  /\bservice\s+unavailable\b/i,
  /\boverloaded\b/i,
  /\babort(?:error)?\b/i,
  /\beconnreset\b/i,
  /\betimedout\b/i,
  /\bfetch\s+failed\b/i,
];

const OUTPUT_CONTRACT_DETAIL_PATTERNS: RegExp[] = [
  /\bparse\/repair\s+failed\b/i,
  /\bcontract\s+violation\b/i,
];

/**
 * Classifies a provider/runtime failure into a stable category used by user-lane policy.
 */
export const classifyStudioAgentFailure = ({
  status,
  detail,
  safetyRefusal = false,
}: {
  status?: number | null;
  detail?: string | null;
  safetyRefusal?: boolean;
}): StudioAgentFailureClass => {
  if (safetyRefusal) return "safety_refusal";
  const normalizedDetail = String(detail ?? "").trim();

  if (OUTPUT_CONTRACT_DETAIL_PATTERNS.some((pattern) => pattern.test(normalizedDetail))) {
    return "output_contract";
  }

  if (typeof status === "number") {
    if (AUTH_STATUS_CODES.has(status)) return "auth_config";
    if (INVALID_REQUEST_STATUS_CODES.has(status)) return "invalid_request";
    if (TRANSIENT_STATUS_CODES.has(status)) return "infra_transient";
  }

  if (AUTH_DETAIL_PATTERNS.some((pattern) => pattern.test(normalizedDetail))) {
    return "auth_config";
  }
  if (TRANSIENT_DETAIL_PATTERNS.some((pattern) => pattern.test(normalizedDetail))) {
    return "infra_transient";
  }
  return "infra_runtime";
};

/**
 * Resolves user-lane output behavior from a failure classification.
 */
export const resolveStudioAgentFailureResolution = ({
  failureClass,
}: {
  failureClass: StudioAgentFailureClass;
}): StudioAgentFailureResolution => {
  if (failureClass === "safety_refusal") return "canonical_refusal";
  if (
    failureClass === "infra_transient" ||
    failureClass === "infra_runtime" ||
    failureClass === "output_contract"
  ) {
    return "assistant_fallback";
  }
  return "hard_error";
};

/**
 * Returns true when a failed attempt should be retried with backoff+jitter.
 */
export const shouldRetryStudioAgentFailure = ({
  failureClass,
  attempt,
  maxAttempts,
}: {
  failureClass: StudioAgentFailureClass;
  attempt: number;
  maxAttempts: number;
}): boolean => {
  return failureClass === "infra_transient" && attempt < maxAttempts;
};

/**
 * Computes bounded exponential backoff with symmetric jitter.
 */
export const computeStudioAgentRetryDelayMs = ({
  attempt,
  baseDelayMs,
  maxDelayMs,
  jitterRatio = 0.25,
  randomValue = Math.random(),
}: {
  attempt: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio?: number;
  randomValue?: number;
}): number => {
  const safeAttempt = Math.max(1, attempt);
  const exponentialDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** (safeAttempt - 1));
  const jitterWindow = Math.trunc(exponentialDelay * Math.max(0, jitterRatio));
  if (jitterWindow <= 0) return Math.max(0, Math.trunc(exponentialDelay));
  const jitterOffset = Math.trunc((Math.max(0, Math.min(1, randomValue)) * 2 - 1) * jitterWindow);
  return Math.max(0, Math.trunc(exponentialDelay + jitterOffset));
};

/**
 * Async sleep helper used by bounded retry loops.
 */
export const waitForStudioAgentRetry = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, delayMs));
  });
};
