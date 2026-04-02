import {
  dispatchProviderResponseProbeRequest,
  resolveProviderResponseUrls,
} from "../providerIntegration/statusProviderDispatcher";
import {
  providerPayloadHasMedia,
  readProviderLifecycleStatus,
} from "../providerIntegration/statusProviderPayload";
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

export type ShortPulseLifecycleHint = {
  taskState: "pending" | "running" | "success" | "fail";
  isTerminal: boolean;
  resultUrls?: string[];
  errorMessage?: string | null;
  errorDetail?: unknown;
  providerState?: string | null;
  recoveryPending?: boolean;
  queueState?: "queued" | "dispatching" | "dispatched" | "failed" | null;
  statusLabel?: string | null;
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
  generationId,
  lifecycle,
}: {
  requestId: string;
  error: string;
  detail?: unknown;
  generationId?: string | null;
  lifecycle?: ShortPulseLifecycleHint;
}): JsonObject => ({
  status: "error",
  state: "error",
  error,
  detail: detail ?? error,
  request_id: requestId,
  ...(typeof generationId === "string" && generationId.trim().length > 0
    ? { generationId: generationId.trim() }
    : {}),
  ...(lifecycle ? { shortpulseLifecycle: lifecycle } : {}),
});

export const buildFalStatusTransientPayload = ({
  requestId,
  detail,
  generationId,
  lifecycle,
}: {
  requestId: string;
  detail?: unknown;
  generationId?: string | null;
  lifecycle?: ShortPulseLifecycleHint;
}): JsonObject => ({
  status: "IN_PROGRESS",
  state: "running",
  request_id: requestId,
  ...(typeof generationId === "string" && generationId.trim().length > 0
    ? { generationId: generationId.trim() }
    : {}),
  ...(detail !== undefined ? { transient_detail: detail } : {}),
  ...(lifecycle ? { shortpulseLifecycle: lifecycle } : {}),
});

export const buildShortPulseLifecycleHint = ({
  taskState,
  isTerminal,
  resultUrls,
  errorMessage,
  errorDetail,
  providerState,
  recoveryPending,
  queueState,
  statusLabel,
}: ShortPulseLifecycleHint): ShortPulseLifecycleHint => {
  const next: ShortPulseLifecycleHint = {
    taskState,
    isTerminal,
  };
  if (Array.isArray(resultUrls) && resultUrls.length > 0) {
    next.resultUrls = resultUrls;
  }
  if (typeof errorMessage === "string" && errorMessage.trim().length > 0) {
    next.errorMessage = errorMessage.trim();
  }
  if (errorDetail !== undefined) {
    next.errorDetail = errorDetail;
  }
  if (typeof providerState === "string" && providerState.trim().length > 0) {
    next.providerState = providerState.trim();
  }
  if (recoveryPending === true) {
    next.recoveryPending = true;
  }
  if (typeof queueState === "string" && queueState.trim().length > 0) {
    next.queueState = queueState.trim() as ShortPulseLifecycleHint["queueState"];
  }
  if (typeof statusLabel === "string" && statusLabel.trim().length > 0) {
    next.statusLabel = statusLabel.trim();
  }
  return next;
};

export const probeResponseUrlsForMedia = async ({
  provider = "fal",
  modelId = null,
  responseUrls,
  statusHint,
  apiKey,
  signal,
}: {
  provider?: string;
  modelId?: string | null;
  responseUrls: string[];
  statusHint: string | null;
  apiKey: string;
  signal: AbortSignal;
}): Promise<{ payload: JsonObject; payloadStatus: string } | null> => {
  const trustedResponseUrls = resolveProviderResponseUrls({ provider, responseUrls, modelId });
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
      !providerPayloadHasMedia({
        provider,
        modelId,
        payload: responseProbeData.json,
      })
    ) {
      continue;
    }
    const responseProbeStatus = readProviderLifecycleStatus({
      provider,
      modelId,
      payload: responseProbeData.json,
    });
    const probeStatus = resolveProviderSuccessfulPayloadStatus({
      provider,
      candidates: [
        responseProbeStatus,
        responseProbeData.json.status,
        responseProbeData.json.state,
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
