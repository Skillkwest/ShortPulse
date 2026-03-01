import type { ResultProbeCandidate, StatusProbeCandidate } from "./contracts";
import { assertTrustedFalProviderUrl } from "./providerTrustPolicy";
import {
  dispatchProviderResponseProbeRequest,
  dispatchProviderResultRequest,
  resolveProviderResponseUrls,
  dispatchProviderStatusRequest,
} from "../providerIntegration/statusProviderDispatcher";
import {
  selectBestProviderResultCandidate,
  selectBestProviderStatusCandidate,
} from "../providerIntegration/statusProviderSelection";
import {
  isProviderCompletedStatus,
  isProviderFailedStatus,
} from "../providerIntegration/statusProviderPolicy";
import { resolveProviderModelStatusBaseUrls } from "../providerIntegration/statusProviderTopology";
import { startProviderPollingSession } from "../providerIntegration/statusProviderPolling";
import {
  providerPayloadHasMedia,
  readProviderMediaUrls,
  readProviderLifecycleStatus,
  readProviderResponseUrl,
} from "../providerIntegration/statusProviderPayload";
import { assertTrustedKieProviderUrl } from "../providerIntegration/providerRuntimeConfig";
import {
  isFalProviderKey,
  isKieProviderKey,
  normalizeProviderKey,
} from "../providerIntegration/providerKey";

type JsonObject = Record<string, unknown>;

type JsonReadResult = {
  ok: boolean;
  status: number;
  json: JsonObject;
};

type ProbeState = "running" | "failed" | "completed";

export type ProviderProbeObservation = {
  state: ProbeState;
  payload: JsonObject | null;
  mediaUrls: string[];
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readJsonSafe = async (response: Response): Promise<JsonReadResult> => {
  const text = await response.text();
  if (!text) return { ok: response.ok, status: response.status, json: {} };
  try {
    const parsed = JSON.parse(text);
    return { ok: response.ok, status: response.status, json: asObject(parsed) };
  } catch {
    return {
      ok: response.ok,
      status: response.status,
      json: { raw: text.slice(0, 4000) },
    };
  }
};

export const extractRecoveryMediaUrls = (
  payload: JsonObject,
  options?: { provider?: string; modelId?: string | null }
): string[] => {
  const providerKey = normalizeProviderKey(options?.provider ?? "fal");
  const modelId = options?.modelId ?? null;
  return readProviderMediaUrls({ provider: providerKey, modelId, payload });
};

export const probeProviderResult = async ({
  provider = "fal",
  requestId,
  modelId,
  apiKey,
}: {
  provider?: string;
  requestId: string;
  modelId: string;
  apiKey: string;
}): Promise<ProviderProbeObservation> => {
  const providerKey = normalizeProviderKey(provider);
  if (!isFalProviderKey(providerKey) && !isKieProviderKey(providerKey)) {
    throw new Error(`Unsupported provider for recovery probe: ${provider}`);
  }
  const queueBaseUrls = resolveProviderModelStatusBaseUrls({
    provider: providerKey,
    modelId,
  });
  if (!queueBaseUrls.length) {
    throw new Error(`No trusted ${providerKey} status base URL configured for model: ${modelId}`);
  }
  const responseUrlSet = new Set<string>();
  const statusCandidates: StatusProbeCandidate[] = [];
  const resultCandidates: ResultProbeCandidate[] = [];
  const payloadByStatusIndex = new Map<number, JsonObject>();
  const payloadByResultIndex = new Map<number, JsonObject>();
  const pollingSession = startProviderPollingSession({
    provider: providerKey,
    modelId,
  });

  try {
    for (const [index, baseUrl] of queueBaseUrls.entries()) {
      if (isFalProviderKey(providerKey)) {
        assertTrustedFalProviderUrl(baseUrl, `recovery_status_base_${index}`);
      } else {
        assertTrustedKieProviderUrl(baseUrl, `recovery_status_base_${index}`);
      }
      const statusResponse = await dispatchProviderStatusRequest({
        provider: providerKey,
        baseUrl,
        requestId,
        apiKey,
        signal: pollingSession.signal,
      });
      const statusData = await readJsonSafe(statusResponse);
      const payload = Object.keys(statusData.json).length ? statusData.json : {};
      const statusValue = readProviderLifecycleStatus({
        provider: providerKey,
        modelId,
        payload,
      });
      const isCompleted = Boolean(
        statusValue &&
        isProviderCompletedStatus({
          provider: providerKey,
          status: statusValue,
        })
      );
      const isFailed = Boolean(
        statusValue &&
        isProviderFailedStatus({
          provider: providerKey,
          status: statusValue,
        })
      );
      statusCandidates.push({
        index,
        baseUrl,
        isJson: true,
        isRetryableAlias: statusResponse.status === 404 || statusResponse.status === 405,
        httpStatus: statusResponse.status,
        isHttpOk: statusResponse.ok,
        status: statusValue,
        isTerminal: isCompleted || isFailed,
        isCompleted,
        isFailed,
        hasResponseUrl: Boolean(
          readProviderResponseUrl({
            provider: providerKey,
            modelId,
            payload,
          })
        ),
        hasMedia: providerPayloadHasMedia({ provider: providerKey, modelId, payload }),
      });
      payloadByStatusIndex.set(index, payload);
      const responseUrl = readProviderResponseUrl({
        provider: providerKey,
        modelId,
        payload,
      });
      if (responseUrl) responseUrlSet.add(responseUrl);
    }

    const bestStatus = selectBestProviderStatusCandidate({
      provider: providerKey,
      candidates: statusCandidates,
    });
    if (bestStatus?.hasMedia) {
      const payload = payloadByStatusIndex.get(bestStatus.index) ?? null;
      if (payload) {
        return {
          state: "completed",
          payload,
          mediaUrls: extractRecoveryMediaUrls(payload, { provider: providerKey, modelId }),
        };
      }
    }

    for (const responseUrl of resolveProviderResponseUrls({
      provider: providerKey,
      responseUrls: Array.from(responseUrlSet),
      modelId,
    })) {
      const responseProbe = await dispatchProviderResponseProbeRequest({
        provider: providerKey,
        responseUrl,
        apiKey,
        signal: pollingSession.signal,
      });
      const responseData = await readJsonSafe(responseProbe);
      if (
        !responseProbe.ok ||
        !providerPayloadHasMedia({
          provider: providerKey,
          modelId,
          payload: responseData.json,
        })
      ) {
        continue;
      }
      return {
        state: "completed",
        payload: responseData.json,
        mediaUrls: extractRecoveryMediaUrls(responseData.json, {
          provider: providerKey,
          modelId,
        }),
      };
    }

    for (const [index, baseUrl] of queueBaseUrls.entries()) {
      if (isFalProviderKey(providerKey)) {
        assertTrustedFalProviderUrl(baseUrl, `recovery_result_base_${index}`);
      } else {
        assertTrustedKieProviderUrl(baseUrl, `recovery_result_base_${index}`);
      }
      const resultResponse = await dispatchProviderResultRequest({
        provider: providerKey,
        baseUrl,
        requestId,
        apiKey,
        signal: pollingSession.signal,
      });
      const resultData = await readJsonSafe(resultResponse);
      const payload = Object.keys(resultData.json).length ? resultData.json : {};
      const statusValue = readProviderLifecycleStatus({
        provider: providerKey,
        modelId,
        payload,
      });
      const hasError = Boolean(asString(payload.error)) || Boolean(asString(payload.detail));
      resultCandidates.push({
        index,
        baseUrl,
        isJson: true,
        isRetryableAlias: resultResponse.status === 404 || resultResponse.status === 405,
        httpStatus: resultResponse.status,
        isHttpOk: resultResponse.ok,
        status: statusValue,
        hasError,
        hasMedia: providerPayloadHasMedia({ provider: providerKey, modelId, payload }),
      });
      payloadByResultIndex.set(index, payload);
    }

    const bestResult = selectBestProviderResultCandidate({
      provider: providerKey,
      candidates: resultCandidates,
    });
    if (bestResult?.hasMedia) {
      const payload = payloadByResultIndex.get(bestResult.index) ?? null;
      if (payload) {
        return {
          state: "completed",
          payload,
          mediaUrls: extractRecoveryMediaUrls(payload, { provider: providerKey, modelId }),
        };
      }
    }

    if (
      bestStatus?.isFailed ||
      (bestResult?.status &&
        isProviderFailedStatus({
          provider: providerKey,
          status: bestResult.status,
        }))
    ) {
      return { state: "failed", payload: null, mediaUrls: [] };
    }
    return { state: "running", payload: null, mediaUrls: [] };
  } finally {
    pollingSession.dispose();
  }
};
