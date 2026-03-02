import { hasMediaPayload, toRecord } from "./falAdapter";
import {
  dispatchProviderResponseProbeRequest,
  resolveProviderResponseUrls,
} from "../providerIntegration/statusProviderDispatcher";
import {
  isProviderCompletedStatus,
  isProviderFailedStatus,
  isProviderRetryableUpstreamResponse,
  resolveProviderSuccessfulPayloadStatus,
} from "../providerIntegration/statusProviderPolicy";

export type JsonObject = Record<string, unknown>;

export type JsonReadResult = {
  json: JsonObject;
  text: string;
  isJson: boolean;
};

/**
 * Legacy Fal compatibility wrapper for provider completed-status policy.
 */
export const isCompletedStatus = (status: string | null): boolean =>
  isProviderCompletedStatus({
    provider: "fal",
    status,
  });

/**
 * Legacy Fal compatibility wrapper for provider failed-status policy.
 */
export const isFailedStatus = (status: string | null): boolean =>
  isProviderFailedStatus({
    provider: "fal",
    status,
  });

/**
 * Legacy Fal compatibility wrapper for provider retryable-response policy.
 */
export const isRetryableUpstreamResponse = (response: Response): boolean => {
  return isProviderRetryableUpstreamResponse({
    provider: "fal",
    response,
  });
};

/**
 * Legacy Fal compatibility wrapper for provider successful-payload status policy.
 */
export const resolveSuccessfulPayloadStatus = (...candidates: unknown[]): string => {
  return resolveProviderSuccessfulPayloadStatus({
    provider: "fal",
    candidates,
  });
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

export const buildFalStatusTransientPayload = ({
  requestId,
  detail,
}: {
  requestId: string;
  detail?: unknown;
}): JsonObject => ({
  status: "IN_PROGRESS",
  state: "running",
  request_id: requestId,
  ...(detail !== undefined ? { transient_detail: detail } : {}),
});

export const probeResponseUrlsForMedia = async ({
  provider = "fal",
  responseUrls,
  statusHint,
  apiKey,
  signal,
}: {
  provider?: string;
  responseUrls: string[];
  statusHint: string | null;
  apiKey: string;
  signal: AbortSignal;
}): Promise<{ payload: JsonObject; payloadStatus: string } | null> => {
  const trustedResponseUrls = resolveProviderResponseUrls({ provider, responseUrls });
  for (const responseUrl of trustedResponseUrls) {
    const responseProbe = await dispatchProviderResponseProbeRequest({
      provider,
      responseUrl,
      apiKey,
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
    const probeStatus = resolveProviderSuccessfulPayloadStatus({
      provider,
      candidates: [
        responseProbeData.json.status,
        toRecord(responseProbeData.json).state,
        statusHint,
      ],
    });
    return {
      payload: responseProbeData.json,
      payloadStatus: probeStatus,
    };
  }
  return null;
};
