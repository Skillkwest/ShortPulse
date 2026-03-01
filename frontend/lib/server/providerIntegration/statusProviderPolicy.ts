/**
 * Provider-owned status lifecycle and upstream retry policy.
 * Centralizes terminal/success/retryability semantics behind provider contracts.
 */

import { asString } from "../falIntegration/falAdapter";
import {
  isKieCompletedStatus,
  isKieRetryableUpstreamPayload,
  isKieFailedStatus,
  isKieRetryableUpstreamResponse,
  resolveKieSuccessfulPayloadStatus,
} from "./kieStatusContracts";
import { isFalProviderKey, isKieProviderKey } from "./providerKey";

const falCompletedStatuses = new Set(["completed", "succeeded", "success", "done"]);
const falFailedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);
const falRetryableUpstreamStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
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
  if (isKieProviderKey(provider)) {
    return isKieCompletedStatus(status);
  }
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
  if (isKieProviderKey(provider)) {
    return isKieFailedStatus(status);
  }
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
  if (isKieProviderKey(provider)) {
    return resolveKieSuccessfulPayloadStatus(candidates);
  }
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
  payload,
}: {
  provider: string;
  response: Response;
  payload?: unknown;
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
    const retryableByResponse = isKieRetryableUpstreamResponse(response);
    if (retryableByResponse) return true;
    const needsRetry = parseBooleanHeader(response.headers.get("x-kie-needs-retry"));
    if (needsRetry === false) return false;
    if (payload !== undefined) {
      return isKieRetryableUpstreamPayload(payload);
    }
    return false;
  }
  throw new Error("Unsupported provider for retryable-upstream policy");
};
