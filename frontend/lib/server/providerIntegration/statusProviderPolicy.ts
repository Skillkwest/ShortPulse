/**
 * Provider-owned status lifecycle and upstream retry policy.
 * Centralizes terminal/success/retryability semantics behind provider contracts.
 */

import { asString } from "../falIntegration/falAdapter";
import { isFalProviderKey, isKieProviderKey } from "./providerKey";

const falCompletedStatuses = new Set(["completed", "succeeded", "success", "done"]);
const falFailedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);
const falRetryableUpstreamStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const kieCompletedStatuses = new Set(["completed", "succeeded", "success", "done", "finished"]);
const kieFailedStatuses = new Set(["failed", "error", "cancelled", "canceled", "rejected"]);
const kieRetryableUpstreamStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

const normalizeStatus = (value: unknown): string | null => {
  const text = asString(value);
  return text ? text.toLowerCase() : null;
};

const parseBooleanHeader = (value: string | null): boolean | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
};

const resolveStatusPolicy = (provider: string) => {
  if (isFalProviderKey(provider)) {
    return {
      completed: falCompletedStatuses,
      failed: falFailedStatuses,
    };
  }
  if (isKieProviderKey(provider)) {
    return {
      completed: kieCompletedStatuses,
      failed: kieFailedStatuses,
    };
  }
  return null;
};

/**
 * Returns true when a provider lifecycle status is terminal success.
 */
export const isProviderCompletedStatus = ({
  provider,
  status,
}: {
  provider: string;
  status: string | null;
}): boolean => {
  const policy = resolveStatusPolicy(provider);
  if (policy) {
    return Boolean(status && policy.completed.has(status));
  }
  throw new Error("Unsupported provider for completed-status policy");
};

/**
 * Returns true when a provider lifecycle status is terminal failure.
 */
export const isProviderFailedStatus = ({
  provider,
  status,
}: {
  provider: string;
  status: string | null;
}): boolean => {
  const policy = resolveStatusPolicy(provider);
  if (policy) {
    return Boolean(status && policy.failed.has(status));
  }
  throw new Error("Unsupported provider for failed-status policy");
};

/**
 * Resolves a normalized successful payload status from candidate values.
 */
export const resolveProviderSuccessfulPayloadStatus = ({
  provider,
  candidates,
}: {
  provider: string;
  candidates: unknown[];
}): string => {
  const policy = resolveStatusPolicy(provider);
  if (policy) {
    for (const candidate of candidates) {
      const normalized = normalizeStatus(candidate);
      if (normalized && policy.completed.has(normalized)) {
        return normalized;
      }
    }
    return "completed";
  }
  throw new Error("Unsupported provider for successful-payload status policy");
};

/**
 * Returns true when an upstream status/result response should be treated as retryable.
 */
export const isProviderRetryableUpstreamResponse = ({
  provider,
  response,
}: {
  provider: string;
  response: Response;
}): boolean => {
  if (isFalProviderKey(provider)) {
    const needsRetry = parseBooleanHeader(response.headers.get("x-fal-needs-retry"));
    if (needsRetry === false) return false;
    if (needsRetry === true) return true;

    const retryableHeader = parseBooleanHeader(response.headers.get("x-fal-retryable"));
    if (retryableHeader === true) return true;

    if (falRetryableUpstreamStatuses.has(response.status)) return true;
    return false;
  }
  if (isKieProviderKey(provider)) {
    const needsRetry = parseBooleanHeader(response.headers.get("x-kie-needs-retry"));
    if (needsRetry === false) return false;
    if (needsRetry === true) return true;

    const retryableHeader = parseBooleanHeader(response.headers.get("x-kie-retryable"));
    if (retryableHeader === true) return true;

    if (kieRetryableUpstreamStatuses.has(response.status)) return true;
    return false;
  }
  throw new Error("Unsupported provider for retryable-upstream policy");
};
