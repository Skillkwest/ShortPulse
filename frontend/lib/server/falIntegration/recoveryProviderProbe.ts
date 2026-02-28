import { asString } from "./falAdapter";
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
  readProviderLifecycleStatus,
  readProviderResponseUrl,
} from "../providerIntegration/statusProviderPayload";

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

const extractUrlObjects = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return asString(item);
      const record = asObject(item);
      return (
        asString(record.url) ||
        asString(record.download_url) ||
        asString(record.video_url) ||
        asString(record.image_url) ||
        asString(record.file_url)
      );
    })
    .filter((url): url is string => Boolean(url));
};

const collectCandidates = (payload: JsonObject): JsonObject[] => {
  const data = asObject(payload.data);
  const output = asObject(payload.output);
  const result = asObject(payload.result);
  const response = asObject(payload.response);
  const rootPayload = asObject(payload.payload);
  return [
    payload,
    rootPayload,
    data,
    output,
    result,
    response,
    asObject(data.result),
    asObject(result.data),
    asObject(response.result),
    asObject(rootPayload.result),
  ].filter((item) => Object.keys(item).length > 0);
};

export const extractRecoveryMediaUrls = (payload: JsonObject): string[] => {
  const candidates = collectCandidates(payload);
  for (const candidate of candidates) {
    const fromImages = extractUrlObjects(candidate.images);
    if (fromImages.length) return fromImages;
    const fromVideos = extractUrlObjects(candidate.videos);
    if (fromVideos.length) return fromVideos;
    const fromOutputs = extractUrlObjects(candidate.outputs);
    if (fromOutputs.length) return fromOutputs;
    const fromArtifacts = extractUrlObjects(candidate.artifacts);
    if (fromArtifacts.length) return fromArtifacts;
    const fromResultUrls = extractUrlObjects(
      candidate.result_urls ?? candidate.resultUrls ?? candidate.image_urls ?? candidate.video_urls
    );
    if (fromResultUrls.length) return fromResultUrls;

    const mediaUrl =
      asString(candidate.url) ||
      asString(candidate.video) ||
      asString(candidate.image) ||
      asString(asObject(candidate.video).url) ||
      asString(asObject(candidate.image).url) ||
      asString(candidate.video_url) ||
      asString(candidate.image_url) ||
      asString(asObject(asObject(candidate.assets).video).url) ||
      asString(asObject(asObject(candidate.assets).image).url) ||
      asString(asObject(asObject(candidate.assets).video).download_url) ||
      asString(asObject(asObject(candidate.assets).image).download_url) ||
      asString(candidate.file_url) ||
      asString(candidate.media_url) ||
      asString(candidate.download_url);
    if (mediaUrl) return [mediaUrl];
  }
  return [];
};

export const probeProviderResult = async ({
  requestId,
  modelId,
  apiKey,
}: {
  requestId: string;
  modelId: string;
  apiKey: string;
}): Promise<ProviderProbeObservation> => {
  const providerKey = "fal";
  const queueBaseUrls = resolveProviderModelStatusBaseUrls({
    provider: providerKey,
    modelId,
  });
  if (!queueBaseUrls.length) {
    throw new Error(`No trusted Fal status base URL configured for model: ${modelId}`);
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
      assertTrustedFalProviderUrl(baseUrl, `recovery_status_base_${index}`);
      const statusResponse = await dispatchProviderStatusRequest({
        provider: providerKey,
        baseUrl,
        requestId,
        apiKey,
        signal: pollingSession.signal,
      });
      const statusData = await readJsonSafe(statusResponse);
      const payload = Object.keys(statusData.json).length ? statusData.json : {};
      const statusValue = readProviderLifecycleStatus({ provider: providerKey, payload });
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
        hasResponseUrl: Boolean(readProviderResponseUrl({ provider: providerKey, payload })),
        hasMedia: providerPayloadHasMedia({ provider: providerKey, payload }),
      });
      payloadByStatusIndex.set(index, payload);
      const responseUrl = readProviderResponseUrl({ provider: providerKey, payload });
      if (responseUrl) responseUrlSet.add(responseUrl);
    }

    const bestStatus = selectBestProviderStatusCandidate({
      provider: providerKey,
      candidates: statusCandidates,
    });
    if (bestStatus?.hasMedia) {
      const payload = payloadByStatusIndex.get(bestStatus.index) ?? null;
      if (payload) {
        return { state: "completed", payload, mediaUrls: extractRecoveryMediaUrls(payload) };
      }
    }

    for (const responseUrl of resolveProviderResponseUrls({
      provider: providerKey,
      responseUrls: Array.from(responseUrlSet),
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
        !providerPayloadHasMedia({ provider: providerKey, payload: responseData.json })
      ) {
        continue;
      }
      return {
        state: "completed",
        payload: responseData.json,
        mediaUrls: extractRecoveryMediaUrls(responseData.json),
      };
    }

    for (const [index, baseUrl] of queueBaseUrls.entries()) {
      assertTrustedFalProviderUrl(baseUrl, `recovery_result_base_${index}`);
      const resultResponse = await dispatchProviderResultRequest({
        provider: providerKey,
        baseUrl,
        requestId,
        apiKey,
        signal: pollingSession.signal,
      });
      const resultData = await readJsonSafe(resultResponse);
      const payload = Object.keys(resultData.json).length ? resultData.json : {};
      const statusValue = readProviderLifecycleStatus({ provider: providerKey, payload });
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
        hasMedia: providerPayloadHasMedia({ provider: providerKey, payload }),
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
        return { state: "completed", payload, mediaUrls: extractRecoveryMediaUrls(payload) };
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
