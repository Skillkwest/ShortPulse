/**
 * Kie status/result contract helpers.
 * Centralizes Kie payload parsing and lifecycle/retry semantics behind one boundary.
 */

import { asString, extractResponseUrl, hasMediaPayload } from "../falIntegration/falAdapter";
import { asProviderRecord, readCanonicalProviderStatus } from "./canonicalProviderPayload";
import { isKnownKieModelId } from "./kieModelIds";
import { extractKieResultMediaUrls } from "./kieResultMediaContracts";
import { parseBooleanHeader } from "./providerHeaderUtils";

const kieCompletedStatuses = new Set(["completed", "succeeded", "success", "done", "finished"]);
const kieFailedStatuses = new Set(["failed", "fail", "error", "cancelled", "canceled", "rejected"]);
const kieRetryableUpstreamStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const kieRetryablePayloadCodes = new Set([
  "rate_limit",
  "rate_limited",
  "overloaded",
  "service_unavailable",
  "temporarily_unavailable",
  "try_again",
  "timeout",
  "timed_out",
]);
const kieStatusFieldKeys = ["status", "state"] as const;
const kieResponseUrlFieldKeys = ["response_url", "responseUrl"] as const;
const kieSuccessFlagFieldKeys = ["successFlag", "success_flag"] as const;
const kieCompletedCallbackCodes = new Set([200]);
const kieFailedCallbackCodes = new Set([501]);
const kieExplicitErrorKeys = [
  "error_message",
  "errorMessage",
  "failMsg",
  "failCode",
  "errorCode",
  "error_code",
] as const;

const normalizeKieStatusAlias = (status: string): string => {
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case "waiting":
    case "in_progress":
    case "processing":
      return "running";
    case "success":
    case "succeeded":
    case "done":
      return "completed";
    case "cancelled":
      return "canceled";
    case "fail":
      return "failed";
    default:
      return normalized;
  }
};

const collectKiePayloadCandidates = (payload: unknown): Record<string, unknown>[] => {
  const root = asProviderRecord(payload);
  const rootPayload = asProviderRecord(root.payload);
  const data = asProviderRecord(root.data);
  const result = asProviderRecord(root.result);
  const response = asProviderRecord(root.response);
  const dataResponse = asProviderRecord(data.response);
  const output = asProviderRecord(root.output);
  const meta = asProviderRecord(root.meta);
  return [
    root,
    rootPayload,
    data,
    dataResponse,
    result,
    response,
    output,
    meta,
    asProviderRecord(data.result),
    asProviderRecord(dataResponse.result),
    asProviderRecord(dataResponse.output),
    asProviderRecord(data.output),
    asProviderRecord(result.data),
    asProviderRecord(result.output),
    asProviderRecord(response.result),
    asProviderRecord(response.data),
    asProviderRecord(output.result),
    asProviderRecord(rootPayload.result),
  ].filter((candidate) => Object.keys(candidate).length > 0);
};

const readNumericCode = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) return null;
    const parsed = Number.parseInt(normalized, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const readFirstSuccessFlag = (candidates: Record<string, unknown>[]): number | null => {
  for (const candidate of candidates) {
    for (const key of kieSuccessFlagFieldKeys) {
      const parsed = readNumericCode(candidate[key]);
      if (parsed !== null) return parsed;
    }
  }
  return null;
};

const hasExplicitKieProviderError = (candidates: Record<string, unknown>[]): boolean => {
  for (const candidate of candidates) {
    const errorString = asString(candidate.error);
    if (errorString) return true;

    const errorObject = asProviderRecord(candidate.error);
    if (
      asString(errorObject.message) ||
      asString(errorObject.msg) ||
      asString(errorObject.code) ||
      asString(errorObject.errorCode) ||
      asString(errorObject.error_code)
    ) {
      return true;
    }

    for (const key of kieExplicitErrorKeys) {
      const value = candidate[key];
      const numericCode = readNumericCode(value);
      if (numericCode !== null) {
        if (numericCode > 0) return true;
        continue;
      }
      if (asString(value)) return true;
    }
  }
  return false;
};

const hasInvalidFieldType = ({
  candidates,
  keys,
}: {
  candidates: Record<string, unknown>[];
  keys: readonly string[];
}): boolean => {
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = candidate[key];
      if (value === undefined || value === null) continue;
      if (typeof value !== "string") return true;
    }
  }
  return false;
};

export type KieStatusPayloadValidationIssueCode =
  | "KIE_MODEL_UNSUPPORTED"
  | "KIE_STATUS_FIELD_INVALID"
  | "KIE_RESPONSE_URL_FIELD_INVALID";

export type KieStatusPayloadValidationIssue = {
  code: KieStatusPayloadValidationIssueCode;
  message: string;
};

/**
 * Validates Kie status/result payload shape for model-aware parsing.
 * Returns null when payload can be parsed safely.
 */
export const validateKieStatusPayloadForModel = ({
  modelId,
  payload,
}: {
  modelId?: string | null;
  payload: unknown;
}): KieStatusPayloadValidationIssue | null => {
  if (modelId?.trim() && !isKnownKieModelId(modelId)) {
    return {
      code: "KIE_MODEL_UNSUPPORTED",
      message: `Unsupported Kie status/result contract model: ${modelId}`,
    };
  }
  const candidates = collectKiePayloadCandidates(payload);
  if (hasInvalidFieldType({ candidates, keys: kieStatusFieldKeys })) {
    return {
      code: "KIE_STATUS_FIELD_INVALID",
      message: "Kie status/result payload contains a non-string status/state field.",
    };
  }
  if (hasInvalidFieldType({ candidates, keys: kieResponseUrlFieldKeys })) {
    return {
      code: "KIE_RESPONSE_URL_FIELD_INVALID",
      message: "Kie status/result payload contains a non-string response URL field.",
    };
  }
  return null;
};

/**
 * Reads normalized lifecycle status from Kie payload shapes.
 */
export const readKieLifecycleStatus = (payload: unknown): string | null => {
  if (validateKieStatusPayloadForModel({ payload })) return null;
  const root = asProviderRecord(payload);
  const candidates = collectKiePayloadCandidates(root);
  const successFlag = readFirstSuccessFlag(candidates);
  const hasExplicitProviderError = hasExplicitKieProviderError(candidates);
  if (successFlag === 2 || successFlag === 3 || hasExplicitProviderError) return "failed";
  if (successFlag === 0) return "running";
  if (successFlag === 1) return "completed";
  const status = readCanonicalProviderStatus(root);
  if (status) return normalizeKieStatusAlias(status);
  for (const candidate of candidates) {
    const code = readNumericCode(candidate.code);
    if (code === null) continue;
    if (kieCompletedCallbackCodes.has(code)) return "completed";
    if (kieFailedCallbackCodes.has(code)) return "failed";
  }
  return null;
};

/**
 * Reads provider response URL from Kie payload shapes.
 */
export const readKieResponseUrl = (payload: unknown): string | null => {
  if (validateKieStatusPayloadForModel({ payload })) return null;
  return extractResponseUrl(asProviderRecord(payload));
};

/**
 * Returns true when Kie payload includes usable media URLs.
 */
export const kiePayloadHasMedia = ({
  modelId,
  payload,
}: {
  modelId?: string | null;
  payload: unknown;
}): boolean => {
  if (validateKieStatusPayloadForModel({ modelId, payload })) return false;
  if (modelId?.trim()) {
    return extractKieResultMediaUrls({ modelId, payload }).length > 0;
  }
  return hasMediaPayload(asProviderRecord(payload));
};

/**
 * Reads Kie content/safety policy message from common payload fields.
 */
export const readKieContentPolicyMessage = (payload: unknown): string | null => {
  const root = asProviderRecord(payload);
  const fallbackMessage =
    asString(root.content_policy_message) ??
    asString(root.contentPolicyMessage) ??
    asString(root.moderation_message) ??
    asString(root.moderationMessage) ??
    asString(root.safety_message) ??
    asString(root.safetyMessage) ??
    asString(root.error_message) ??
    asString(root.errorMessage);
  if (fallbackMessage) return fallbackMessage;
  const nestedCandidates = [
    asProviderRecord(root.error),
    asProviderRecord(root.detail),
    asProviderRecord(root.data),
    asProviderRecord(root.result),
  ];
  for (const candidate of nestedCandidates) {
    const message =
      asString(candidate.content_policy_message) ??
      asString(candidate.contentPolicyMessage) ??
      asString(candidate.moderation_message) ??
      asString(candidate.moderationMessage) ??
      asString(candidate.safety_message) ??
      asString(candidate.safetyMessage) ??
      asString(candidate.error_message) ??
      asString(candidate.errorMessage) ??
      asString(candidate.message);
    if (message) return message;
  }
  return null;
};

/**
 * Returns true when lifecycle status is terminal success for Kie.
 */
export const isKieCompletedStatus = (status: string | null): boolean => {
  return Boolean(status && kieCompletedStatuses.has(normalizeKieStatusAlias(status)));
};

/**
 * Returns true when lifecycle status is terminal failure for Kie.
 */
export const isKieFailedStatus = (status: string | null): boolean => {
  return Boolean(status && kieFailedStatuses.has(normalizeKieStatusAlias(status)));
};

/**
 * Resolves a normalized successful Kie status from candidate values.
 */
export const resolveKieSuccessfulPayloadStatus = (candidates: unknown[]): string => {
  for (const candidate of candidates) {
    const status = asString(candidate);
    if (!status) continue;
    const normalized = normalizeKieStatusAlias(status);
    if (kieCompletedStatuses.has(normalized)) {
      return normalized;
    }
  }
  return "completed";
};

/**
 * Returns true when an upstream Kie response should be retried.
 */
export const isKieRetryableUpstreamResponse = (response: Response): boolean => {
  const needsRetry = parseBooleanHeader(response.headers.get("x-kie-needs-retry"));
  if (needsRetry === false) return false;
  if (needsRetry === true) return true;

  const retryableHeader = parseBooleanHeader(response.headers.get("x-kie-retryable"));
  if (retryableHeader === true) return true;

  return kieRetryableUpstreamStatuses.has(response.status);
};

/**
 * Returns true when a Kie payload encodes a retryable upstream failure.
 */
export const isKieRetryableUpstreamPayload = (payload: unknown): boolean => {
  const candidates = collectKiePayloadCandidates(payload);
  for (const candidate of candidates) {
    const numericCode = readNumericCode(candidate.code);
    if (numericCode !== null && kieRetryableUpstreamStatuses.has(numericCode)) {
      return true;
    }
    const code =
      asString(candidate.code) ??
      asString(candidate.error_code) ??
      asString(asProviderRecord(candidate.error).code) ??
      asString(asProviderRecord(candidate.error).error_code) ??
      asString(asProviderRecord(candidate.detail).code) ??
      asString(asProviderRecord(candidate.detail).error_code);
    if (code && kieRetryablePayloadCodes.has(code.trim().toLowerCase())) {
      return true;
    }
  }
  return false;
};
