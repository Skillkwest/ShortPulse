import { hasMediaPayload, normalizeStatus, toRecord } from "./falAdapter";

export type JsonObject = Record<string, unknown>;

export type JsonReadResult = {
  json: JsonObject;
  text: string;
  isJson: boolean;
};

const completedStatuses = new Set(["completed", "succeeded", "success", "done"]);
const failedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);
const retryableUpstreamStatuses = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

export const isCompletedStatus = (status: string | null): boolean =>
  Boolean(status && completedStatuses.has(status));

export const isFailedStatus = (status: string | null): boolean =>
  Boolean(status && failedStatuses.has(status));

const parseBooleanHeader = (value: string | null): boolean | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return null;
};

export const isRetryableUpstreamResponse = (response: Response): boolean => {
  const needsRetry = parseBooleanHeader(response.headers.get("x-fal-needs-retry"));
  if (needsRetry === false) return false;
  if (needsRetry === true) return true;

  const retryableHeader = parseBooleanHeader(response.headers.get("x-fal-retryable"));
  if (retryableHeader === true) return true;

  if (retryableUpstreamStatuses.has(response.status)) return true;
  return false;
};

export const resolveSuccessfulPayloadStatus = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    const normalized = normalizeStatus(candidate);
    if (normalized && completedStatuses.has(normalized)) {
      return normalized;
    }
  }
  return "completed";
};

export const readJsonSafe = async (response: Response): Promise<JsonReadResult> => {
  const text = await response.text();
  if (!text) return { json: {}, text: "", isJson: true };
  try {
    return { json: JSON.parse(text), text, isJson: true };
  } catch {
    return { json: { raw: text.slice(0, 4000) }, text, isJson: false };
  }
};

export const buildFalStatusErrorPayload = ({
  requestId,
  error,
  detail,
}: {
  requestId: string;
  error: string;
  detail?: unknown;
}): JsonObject => ({
  status: "error",
  state: "error",
  error,
  detail: detail ?? error,
  request_id: requestId,
});

export const probeResponseUrlsForMedia = async ({
  responseUrls,
  statusHint,
  apiKey,
  signal,
}: {
  responseUrls: string[];
  statusHint: string | null;
  apiKey: string;
  signal: AbortSignal;
}): Promise<{ payload: JsonObject; payloadStatus: string } | null> => {
  for (const responseUrl of responseUrls) {
    const responseProbe = await fetch(responseUrl, {
      method: "GET",
      headers: { Authorization: `Key ${apiKey}` },
      signal,
    });
    const responseProbeData = await readJsonSafe(responseProbe);
    if (
      !responseProbe.ok ||
      !responseProbeData.isJson ||
      !hasMediaPayload(responseProbeData.json)
    ) {
      continue;
    }
    const probeStatus = resolveSuccessfulPayloadStatus(
      responseProbeData.json.status,
      toRecord(responseProbeData.json).state,
      statusHint
    );
    return {
      payload: responseProbeData.json,
      payloadStatus: probeStatus,
    };
  }
  return null;
};
