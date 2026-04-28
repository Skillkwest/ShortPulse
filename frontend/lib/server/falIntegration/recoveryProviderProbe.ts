import type { ResultProbeCandidate, StatusProbeCandidate } from "./contracts";
import { assertTrustedFalProviderUrl } from "./providerTrustPolicy";
import { readFalRuntimeFlags } from "../api/falRuntimeFlags";
import {
  dispatchProviderResponseProbeRequest,
  dispatchProviderResultRequest,
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
import { recoveryFetchWithTimeout } from "./recoveryFetchWithTimeout";
import { probeResultBasesForMedia, probeResponseUrlsForMedia } from "./statusProxyRuntime";

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

const payloadHasProviderError = (payload: JsonObject | null): boolean => {
  if (!payload) return false;
  return Boolean(asString(payload.error) || asString(payload.detail));
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
  const runtimeFlags = readFalRuntimeFlags();

  try {
    const statusResults = await Promise.all(
      queueBaseUrls.map(async (baseUrl, index) => {
        if (isFalProviderKey(providerKey)) {
          assertTrustedFalProviderUrl(baseUrl, `recovery_status_base_${index}`);
        } else {
          assertTrustedKieProviderUrl(baseUrl, `recovery_status_base_${index}`);
        }
        let statusResponse: Response;
        try {
          statusResponse = await recoveryFetchWithTimeout({
            timeoutMs: runtimeFlags.recoveryProbeTimeoutMs,
            signal: pollingSession.signal,
            execute: (signal) =>
              dispatchProviderStatusRequest({
                provider: providerKey,
                baseUrl,
                requestId,
                apiKey,
                signal,
              }),
          });
        } catch {
          return {
            index,
            baseUrl,
            payload: null,
            responseUrl: null,
            candidate: {
              index,
              baseUrl,
              isJson: false,
              isRetryableAlias: false,
              httpStatus: 0,
              isHttpOk: false,
              status: null,
              isTerminal: false,
              isCompleted: false,
              isFailed: false,
              hasResponseUrl: false,
              hasMedia: false,
            } satisfies StatusProbeCandidate,
          };
        }
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
        const responseUrl = readProviderResponseUrl({
          provider: providerKey,
          modelId,
          payload,
        });
        return {
          index,
          baseUrl,
          payload,
          responseUrl,
          candidate: {
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
            hasResponseUrl: Boolean(responseUrl),
            hasMedia: providerPayloadHasMedia({ provider: providerKey, modelId, payload }),
          } satisfies StatusProbeCandidate,
        };
      })
    );

    for (const statusResult of statusResults) {
      statusCandidates.push(statusResult.candidate);
      if (statusResult.payload) {
        payloadByStatusIndex.set(statusResult.index, statusResult.payload);
      }
      if (statusResult.responseUrl) {
        responseUrlSet.add(statusResult.responseUrl);
      }
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
    const bestStatusPayload =
      bestStatus && payloadByStatusIndex.has(bestStatus.index)
        ? (payloadByStatusIndex.get(bestStatus.index) ?? null)
        : null;
    if (
      bestStatus?.isFailed ||
      (bestStatus?.isTerminal && payloadHasProviderError(bestStatusPayload))
    ) {
      return { state: "failed", payload: bestStatusPayload, mediaUrls: [] };
    }
    const responseProbe = await probeResponseUrlsForMedia({
      provider: providerKey,
      modelId,
      responseUrls: Array.from(responseUrlSet),
      statusHint: bestStatus?.status ?? null,
      apiKey,
      signal: pollingSession.signal,
      requestResponseProbe: (responseUrl, signal) =>
        recoveryFetchWithTimeout({
          timeoutMs: runtimeFlags.recoveryProbeTimeoutMs,
          signal: pollingSession.signal,
          execute: () =>
            dispatchProviderResponseProbeRequest({
              provider: providerKey,
              responseUrl,
              apiKey,
              signal,
            }),
        }),
    });
    if (responseProbe) {
      return {
        state: "completed",
        payload: responseProbe.payload,
        mediaUrls: extractRecoveryMediaUrls(responseProbe.payload, {
          provider: providerKey,
          modelId,
        }),
      };
    }

    const resultMediaProbe = await probeResultBasesForMedia({
      provider: providerKey,
      modelId,
      resultBaseUrls: queueBaseUrls,
      requestId,
      statusHint: bestStatus?.status ?? null,
      apiKey,
      signal: pollingSession.signal,
      requestResult: (baseUrl, signal) =>
        recoveryFetchWithTimeout({
          timeoutMs: runtimeFlags.recoveryProbeTimeoutMs,
          signal: pollingSession.signal,
          execute: () =>
            dispatchProviderResultRequest({
              provider: providerKey,
              baseUrl,
              requestId,
              apiKey,
              signal,
            }),
        }),
    });
    if (resultMediaProbe) {
      return {
        state: "completed",
        payload: resultMediaProbe.payload,
        mediaUrls: extractRecoveryMediaUrls(resultMediaProbe.payload, {
          provider: providerKey,
          modelId,
        }),
      };
    }
    if (bestStatus?.isCompleted) {
      return {
        state: "completed",
        payload: payloadByStatusIndex.get(bestStatus.index) ?? null,
        mediaUrls: [],
      };
    }

    const resultResults = await Promise.all(
      queueBaseUrls.map(async (baseUrl, index) => {
        if (isFalProviderKey(providerKey)) {
          assertTrustedFalProviderUrl(baseUrl, `recovery_result_base_${index}`);
        } else {
          assertTrustedKieProviderUrl(baseUrl, `recovery_result_base_${index}`);
        }
        let resultResponse: Response;
        try {
          resultResponse = await recoveryFetchWithTimeout({
            timeoutMs: runtimeFlags.recoveryProbeTimeoutMs,
            signal: pollingSession.signal,
            execute: (signal) =>
              dispatchProviderResultRequest({
                provider: providerKey,
                baseUrl,
                requestId,
                apiKey,
                signal,
              }),
          });
        } catch {
          return {
            index,
            payload: null,
            candidate: {
              index,
              baseUrl,
              isJson: false,
              isRetryableAlias: false,
              httpStatus: 0,
              isHttpOk: false,
              status: null,
              hasError: true,
              hasMedia: false,
            } satisfies ResultProbeCandidate,
          };
        }
        const resultData = await readJsonSafe(resultResponse);
        const payload = Object.keys(resultData.json).length ? resultData.json : {};
        const statusValue = readProviderLifecycleStatus({
          provider: providerKey,
          modelId,
          payload,
        });
        const hasError = Boolean(asString(payload.error)) || Boolean(asString(payload.detail));
        return {
          index,
          payload,
          candidate: {
            index,
            baseUrl,
            isJson: true,
            isRetryableAlias: resultResponse.status === 404 || resultResponse.status === 405,
            httpStatus: resultResponse.status,
            isHttpOk: resultResponse.ok,
            status: statusValue,
            hasError,
            hasMedia: providerPayloadHasMedia({ provider: providerKey, modelId, payload }),
          } satisfies ResultProbeCandidate,
        };
      })
    );

    for (const resultResult of resultResults) {
      resultCandidates.push(resultResult.candidate);
      if (resultResult.payload) {
        payloadByResultIndex.set(resultResult.index, resultResult.payload);
      }
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
      bestResult?.status &&
      isProviderCompletedStatus({
        provider: providerKey,
        status: bestResult.status,
      })
    ) {
      return {
        state: "completed",
        payload: payloadByResultIndex.get(bestResult.index) ?? null,
        mediaUrls: [],
      };
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
