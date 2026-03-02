/**
 * Kie record-info envelope normalizer.
 * Produces a canonical payload shape so status/recovery paths can parse one
 * consistent contract before lifecycle/media decisions.
 */

import { asProviderRecord, asProviderString } from "./canonicalProviderPayload";

const STATUS_KEYS = ["status", "state"] as const;
const RESPONSE_URL_KEYS = ["response_url", "responseUrl"] as const;
const RESULT_JSON_KEYS = ["resultJson", "result_json"] as const;

const readNumericCode = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const asJsonObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return asProviderRecord(value);
  }
  const text = asProviderString(value);
  if (!text) return {};
  try {
    return asProviderRecord(JSON.parse(text));
  } catch {
    return {};
  }
};

const collectCandidates = (payload: unknown): Record<string, unknown>[] => {
  const root = asProviderRecord(payload);
  const rootPayload = asProviderRecord(root.payload);
  const data = asProviderRecord(root.data);
  const result = asProviderRecord(root.result);
  const response = asProviderRecord(root.response);
  const output = asProviderRecord(root.output);
  const meta = asProviderRecord(root.meta);
  return [
    root,
    rootPayload,
    data,
    result,
    response,
    output,
    meta,
    asProviderRecord(data.result),
    asProviderRecord(data.output),
    asProviderRecord(result.data),
    asProviderRecord(result.output),
    asProviderRecord(response.result),
    asProviderRecord(response.data),
    asProviderRecord(output.result),
    asProviderRecord(rootPayload.result),
  ].filter((candidate) => Object.keys(candidate).length > 0);
};

const readFirstString = (
  candidates: Record<string, unknown>[],
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

const readFirstResponseUrl = (candidates: Record<string, unknown>[]): string | null => {
  const direct = readFirstString(candidates, RESPONSE_URL_KEYS);
  if (direct) return direct;
  for (const candidate of candidates) {
    const nestedUrl = asProviderString(asProviderRecord(candidate.response).url);
    if (nestedUrl) return nestedUrl;
  }
  return null;
};

const readFirstCode = (candidates: Record<string, unknown>[]): number | null => {
  for (const candidate of candidates) {
    const code = readNumericCode(candidate.code);
    if (code !== null) return code;
  }
  return null;
};

const readFirstResultJson = (candidates: Record<string, unknown>[]): Record<string, unknown> => {
  for (const candidate of candidates) {
    for (const key of RESULT_JSON_KEYS) {
      const parsed = asJsonObject(candidate[key]);
      if (Object.keys(parsed).length) return parsed;
    }
  }
  return {};
};

const readFirstResultUrls = (candidates: Record<string, unknown>[]): string[] => {
  for (const candidate of candidates) {
    const list = candidate.resultUrls ?? candidate.result_urls;
    if (!Array.isArray(list)) continue;
    const urls = list
      .map((item) => asProviderString(item))
      .filter((url): url is string => Boolean(url));
    if (urls.length) return urls;
  }
  return [];
};

/**
 * Normalizes Kie payload envelopes into a canonical status/result shape.
 */
export const normalizeKieEnvelopePayload = (payload: unknown): Record<string, unknown> => {
  const root = asProviderRecord(payload);
  const candidates = collectCandidates(root);
  const normalized: Record<string, unknown> = {
    ...root,
  };

  const status = readFirstString(candidates, STATUS_KEYS);
  const responseUrl = readFirstResponseUrl(candidates);
  const code = readFirstCode(candidates);
  const resultJson = readFirstResultJson(candidates);
  const resultUrls = readFirstResultUrls(candidates);

  delete normalized.status;
  delete normalized.state;
  delete normalized.response_url;
  delete normalized.responseUrl;

  if (status) {
    normalized.status = status;
    normalized.state = status;
  }
  if (responseUrl) {
    normalized.response_url = responseUrl;
    normalized.responseUrl = responseUrl;
  }
  if (code !== null && normalized.code === undefined) {
    normalized.code = code;
  }
  if (Object.keys(resultJson).length) {
    normalized.resultJson = resultJson;
  }
  if (resultUrls.length) {
    normalized.resultUrls = resultUrls;
    normalized.result_urls = resultUrls;
  }

  return normalized;
};
