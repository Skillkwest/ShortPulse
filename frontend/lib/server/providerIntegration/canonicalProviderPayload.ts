/**
 * Provider-neutral payload identity helpers.
 * Canonicalizes request/event/status aliases so submit/webhook paths can share one parsing contract.
 */

export type ProviderPayload = Record<string, unknown>;

const REQUEST_ID_KEYS_STRICT = [
  "request_id",
  "requestId",
  "provider_request_id",
  "providerRequestId",
  "task_id",
  "taskId",
  "operation_id",
  "operationId",
] as const;

const REQUEST_ID_KEYS_LOOSE = ["id"] as const;

const EVENT_ID_KEYS = ["event_id", "eventId", "id"] as const;
const STATUS_KEYS = ["status", "state"] as const;

/**
 * Reads a non-empty string value.
 */
export const asProviderString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

/**
 * Safely narrows unknown values to plain records.
 */
export const asProviderRecord = (value: unknown): ProviderPayload =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as ProviderPayload) : {};

/**
 * Lower-cases provider lifecycle statuses for stable comparisons.
 */
export const normalizeProviderStatus = (value: unknown): string | null => {
  const text = asProviderString(value);
  return text ? text.toLowerCase() : null;
};

const collectPayloadCandidates = (payload: ProviderPayload): ProviderPayload[] => {
  const data = asProviderRecord(payload.data);
  const result = asProviderRecord(payload.result);
  const response = asProviderRecord(payload.response);
  const rootPayload = asProviderRecord(payload.payload);
  const meta = asProviderRecord(payload.meta);
  return [
    payload,
    rootPayload,
    data,
    result,
    response,
    meta,
    asProviderRecord(data.result),
    asProviderRecord(result.data),
    asProviderRecord(response.result),
    asProviderRecord(rootPayload.result),
  ].filter((candidate) => Object.keys(candidate).length > 0);
};

const readFirstMatchingString = (
  candidates: ProviderPayload[],
  keys: readonly string[]
): string | null => {
  for (const candidate of candidates) {
    for (const key of keys) {
      const value = asProviderString(candidate[key]);
      if (value) return value;
    }
  }
  return null;
};

/**
 * Resolves a canonical provider request id across common alias shapes.
 */
export const readCanonicalProviderRequestId = (
  payload: unknown,
  options?: { allowGenericId?: boolean }
): string | null => {
  const candidates = collectPayloadCandidates(asProviderRecord(payload));
  const strictMatch = readFirstMatchingString(candidates, REQUEST_ID_KEYS_STRICT);
  if (strictMatch) return strictMatch;
  if (options?.allowGenericId) {
    return readFirstMatchingString(candidates, REQUEST_ID_KEYS_LOOSE);
  }
  return null;
};

/**
 * Resolves a canonical webhook/event id across common alias shapes.
 */
export const readCanonicalProviderEventId = (payload: unknown): string | null => {
  const candidates = collectPayloadCandidates(asProviderRecord(payload));
  return readFirstMatchingString(candidates, EVENT_ID_KEYS);
};

/**
 * Resolves normalized provider status across common alias shapes.
 */
export const readCanonicalProviderStatus = (payload: unknown): string | null => {
  const candidates = collectPayloadCandidates(asProviderRecord(payload));
  for (const candidate of candidates) {
    for (const key of STATUS_KEYS) {
      const normalized = normalizeProviderStatus(candidate[key]);
      if (normalized) return normalized;
    }
  }
  return null;
};
