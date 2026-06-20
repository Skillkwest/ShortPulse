import {
  dispatchProviderResultRequest,
  dispatchProviderResponseProbeRequest,
  resolveProviderResponseUrls,
} from "../providerIntegration/statusProviderDispatcher";
import {
  providerPayloadHasMedia,
  readProviderLifecycleStatus,
} from "../providerIntegration/statusProviderPayload";
import {
  isProviderFailedStatus,
  resolveProviderSuccessfulPayloadStatus,
} from "../providerIntegration/statusProviderPolicy";
import { selectBestProviderResultCandidate } from "../providerIntegration/statusProviderSelection";
import type { ResultProbeCandidate } from "./contracts";

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
  saveState?: "idle" | "saving" | "saved" | "failed" | "blocked_storage";
  saveError?: string | null;
  errorMessage?: string | null;
  errorDetail?: unknown;
  providerState?: string | null;
  recoveryPending?: boolean;
  completionState?: "completed_awaiting_media";
  deliveryState?: "transient_provider" | "canonical_owned";
  queueState?: "queued" | "dispatching" | "dispatched" | "failed" | null;
  statusLabel?: string | null;
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
  saveState,
  saveError,
  errorMessage,
  errorDetail,
  providerState,
  recoveryPending,
  completionState,
  deliveryState,
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
  if (
    saveState === "idle" ||
    saveState === "saving" ||
    saveState === "saved" ||
    saveState === "failed" ||
    saveState === "blocked_storage"
  ) {
    next.saveState = saveState;
  }
  if (saveError === null) {
    next.saveError = null;
  } else if (typeof saveError === "string" && saveError.trim().length > 0) {
    next.saveError = saveError.trim();
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
  if (completionState === "completed_awaiting_media") {
    next.completionState = completionState;
  }
  if (deliveryState === "transient_provider" || deliveryState === "canonical_owned") {
    next.deliveryState = deliveryState;
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
  requestResponseProbe,
}: {
  provider?: string;
  modelId?: string | null;
  responseUrls: string[];
  statusHint: string | null;
  apiKey: string;
  signal: AbortSignal;
  requestResponseProbe?: (responseUrl: string, signal: AbortSignal) => Promise<Response>;
}): Promise<{ payload: JsonObject; payloadStatus: string } | null> => {
  const trustedResponseUrls = resolveProviderResponseUrls({ provider, responseUrls, modelId });
  const probeResults = await Promise.all(
    trustedResponseUrls.map(async (responseUrl) => {
      try {
        const responseProbe = requestResponseProbe
          ? await requestResponseProbe(responseUrl, signal)
          : await dispatchProviderResponseProbeRequest({
              provider,
              responseUrl,
              apiKey,
              signal,
            });
        const responseProbeData = await readJsonSafe(responseProbe);
        return {
          responseProbe,
          responseProbeData,
        };
      } catch {
        return null;
      }
    })
  );
  for (const probeResult of probeResults) {
    if (!probeResult) continue;
    const { responseProbe, responseProbeData } = probeResult;
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
    if (
      Boolean(responseProbeData.json.error) ||
      Boolean(responseProbeData.json.detail) ||
      isProviderFailedStatus({ provider, status: responseProbeStatus })
    ) {
      continue;
    }
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

export const probeResultBasesForMedia = async ({
  provider = "fal",
  modelId = null,
  resultBaseUrls,
  requestId,
  statusHint,
  apiKey,
  signal,
  requestResult,
}: {
  provider?: string;
  modelId?: string | null;
  resultBaseUrls: string[];
  requestId: string;
  statusHint: string | null;
  apiKey: string;
  signal: AbortSignal;
  requestResult?: (baseUrl: string, signal: AbortSignal) => Promise<Response>;
}): Promise<{ payload: JsonObject; payloadStatus: string } | null> => {
  const resultCandidates: Array<{
    probe: ResultProbeCandidate;
    response: Response;
    data: JsonReadResult;
  }> = [];

  const resultProbeResults = await Promise.all(
    resultBaseUrls.map(async (baseUrl, index) => {
      try {
        const response = requestResult
          ? await requestResult(baseUrl, signal)
          : await dispatchProviderResultRequest({
              provider,
              baseUrl,
              requestId,
              apiKey,
              signal,
            });
        const data = await readJsonSafe(response);
        const candidateStatus = data.isJson
          ? readProviderLifecycleStatus({
              provider,
              modelId,
              payload: data.json,
            })
          : null;
        const probe: ResultProbeCandidate = {
          index,
          baseUrl,
          isJson: data.isJson,
          isRetryableAlias: false,
          httpStatus: response.status,
          isHttpOk: response.ok,
          status: candidateStatus,
          hasError: data.isJson ? Boolean(data.json.error) || Boolean(data.json.detail) : true,
          hasMedia: data.isJson
            ? providerPayloadHasMedia({
                provider,
                modelId,
                payload: data.json,
              })
            : false,
        };
        return { probe, response, data };
      } catch {
        return null;
      }
    })
  );

  for (const resultProbeResult of resultProbeResults) {
    if (!resultProbeResult) continue;
    const { probe, response, data } = resultProbeResult;
    if (probe.isRetryableAlias) continue;
    resultCandidates.push({ probe, response, data });
  }

  const bestResultProbe = selectBestProviderResultCandidate({
    provider,
    candidates: resultCandidates.map((candidate) => candidate.probe),
  });
  const bestResultCandidate =
    bestResultProbe &&
    resultCandidates.find((candidate) => candidate.probe.index === bestResultProbe.index);
  if (
    !bestResultCandidate ||
    !bestResultCandidate.probe.isHttpOk ||
    !bestResultCandidate.data.isJson ||
    bestResultCandidate.probe.hasError ||
    isProviderFailedStatus({
      provider,
      status: bestResultCandidate.probe.status,
    }) ||
    !bestResultCandidate.probe.hasMedia
  ) {
    return null;
  }

  return {
    payload: bestResultCandidate.data.json,
    payloadStatus: resolveProviderSuccessfulPayloadStatus({
      provider,
      candidates: [
        bestResultCandidate.probe.status,
        bestResultCandidate.data.json.status,
        bestResultCandidate.data.json.state,
        statusHint,
      ],
    }),
  };
};
