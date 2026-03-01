/**
 * Kie status/result contract helpers.
 * Centralizes Kie payload parsing and lifecycle/retry semantics behind one boundary.
 */

import { asString, extractResponseUrl, hasMediaPayload } from "../falIntegration/falAdapter";
import { asProviderRecord, readCanonicalProviderStatus } from "./canonicalProviderPayload";
import { isSupportedKieModelId } from "./kieModelContracts";
import { extractKieResultMediaUrls } from "./kieResultMediaContracts";

const kieCompletedStatuses = new Set(["completed", "succeeded", "success", "done", "finished"]);
const kieFailedStatuses = new Set(["failed", "error", "cancelled", "canceled", "rejected"]);
const kieRetryableUpstreamStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const kieStatusFieldKeys = ["status", "state"] as const;
const kieResponseUrlFieldKeys = ["response_url", "responseUrl"] as const;

const normalizeKieStatusAlias = (status: string): string => {
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case "in_progress":
    case "processing":
      return "running";
    case "success":
    case "succeeded":
    case "done":
      return "completed";
    case "cancelled":
      return "canceled";
    default:
      return normalized;
  }
};

const parseBooleanHeader = (value: string | null): boolean | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
};

const collectKiePayloadCandidates = (payload: unknown): Record<string, unknown>[] => {
  const root = asProviderRecord(payload);
  const data = asProviderRecord(root.data);
  const result = asProviderRecord(root.result);
  const response = asProviderRecord(root.response);
  const output = asProviderRecord(root.output);
  return [root, data, result, response, output].filter(
    (candidate) => Object.keys(candidate).length > 0
  );
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
  if (modelId?.trim() && !isSupportedKieModelId(modelId)) {
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
  const status = readCanonicalProviderStatus(payload);
  return status ? normalizeKieStatusAlias(status) : null;
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
