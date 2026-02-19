/**
 * Shared Fal status proxy with failure-aware refund settlement.
 * Polls queue status/result and refunds failed generations idempotently.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "./auth";
import { logGenerationFailure } from "./appErrorLogs";
import {
  captureSucceededGenerationByProviderRequest,
  resolveProviderRequestOwnership,
  settleFailedGenerationByProviderRequest,
} from "./generationBilling";

type FalStatusConfig = {
  queueBaseUrl: string | string[];
  routeLabel: string;
  timeoutMs?: number;
  alwaysHttp200?: boolean;
};

type JsonObject = Record<string, unknown>;

type JsonReadResult = {
  json: JsonObject;
  text: string;
  isJson: boolean;
};

const completedStatuses = new Set(["completed", "succeeded", "success", "done"]);
const failedStatuses = new Set(["failed", "error", "cancelled", "canceled"]);

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const toRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const hasUrlArray = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.some((item) => {
    if (typeof item === "string") return Boolean(asString(item));
    const record = toRecord(item);
    return Boolean(
      asString(record.url) ||
      asString(record.download_url) ||
      asString(record.video_url) ||
      asString(record.image_url) ||
      asString(record.file_url)
    );
  });

const normalizeStatus = (value: unknown): string | null => {
  const text = asString(value);
  return text ? text.toLowerCase() : null;
};

const resolveSuccessfulPayloadStatus = (...candidates: unknown[]): string => {
  for (const candidate of candidates) {
    const normalized = normalizeStatus(candidate);
    if (normalized && completedStatuses.has(normalized)) {
      return normalized;
    }
  }
  return "completed";
};

const readJsonSafe = async (response: Response): Promise<JsonReadResult> => {
  const text = await response.text();
  if (!text) return { json: {}, text: "", isJson: true };
  try {
    return { json: JSON.parse(text), text, isJson: true };
  } catch {
    return { json: { raw: text.slice(0, 4000) }, text, isJson: false };
  }
};

const findContentPolicyMessage = (payload: JsonObject): string | null => {
  const detail = payload.detail;
  if (!Array.isArray(detail)) return null;
  const violation = detail.find((item) => {
    const row = toRecord(item);
    return row.type === "content_policy_violation";
  });
  const message = asString(toRecord(violation).msg);
  return message ?? null;
};

const hasMediaPayload = (payload: JsonObject): boolean => {
  const data = toRecord(payload.data);
  const output = toRecord(payload.output);
  const result = toRecord(payload.result);
  const response = toRecord(payload.response);
  const candidates = [
    payload,
    data,
    output,
    result,
    response,
    toRecord(data.result),
    toRecord(result.data),
    toRecord(response.result),
  ].filter((item) => Object.keys(item).length > 0);

  for (const candidate of candidates) {
    if (hasUrlArray(candidate.images)) return true;
    if (hasUrlArray(candidate.videos)) return true;
    if (hasUrlArray(candidate.outputs)) return true;
    if (hasUrlArray(candidate.artifacts)) return true;
    const urls =
      candidate.resultUrls ??
      candidate.result_urls ??
      candidate.image_urls ??
      candidate.video_urls ??
      toRecord(candidate.info).result_urls;
    if (hasUrlArray(urls)) return true;
    const mediaUrl =
      asString(candidate.url) ||
      asString(candidate.video) ||
      asString(candidate.image) ||
      asString(toRecord(candidate.video).url) ||
      asString(toRecord(candidate.image).url) ||
      asString(candidate.video_url) ||
      asString(candidate.image_url) ||
      asString(toRecord(toRecord(candidate.assets).video).url) ||
      asString(toRecord(toRecord(candidate.assets).image).url) ||
      asString(toRecord(toRecord(candidate.assets).video).download_url) ||
      asString(toRecord(toRecord(candidate.assets).image).download_url) ||
      asString(candidate.file_url) ||
      asString(candidate.media_url) ||
      asString(candidate.download_url);
    if (mediaUrl) return true;
  }

  return false;
};

const extractResponseUrl = (payload: JsonObject): string | null => {
  const data = toRecord(payload.data);
  const output = toRecord(payload.output);
  const result = toRecord(payload.result);
  const response = toRecord(payload.response);
  const candidates = [
    payload,
    data,
    output,
    result,
    response,
    toRecord(data.result),
    toRecord(result.data),
    toRecord(response.result),
  ];
  for (const candidate of candidates) {
    const responseUrl =
      asString(candidate.response_url) ||
      asString(candidate.responseUrl) ||
      asString(toRecord(candidate.response).url);
    if (responseUrl) return responseUrl;
  }
  return null;
};

const buildErrorPayload = ({
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

const settleFailure = async ({
  userId,
  requestId,
  reason,
  routeLabel,
  detail,
}: {
  userId: string;
  requestId: string;
  reason: string;
  routeLabel: string;
  detail?: JsonObject;
}) => {
  const result = await settleFailedGenerationByProviderRequest({
    userId,
    providerRequestId: requestId,
    reason,
    routeLabel,
    detail,
  });
  if (!result.settled && result.note !== "charge_not_found") {
    console.error("[falStatusProxy] settlement did not complete", {
      requestId,
      routeLabel,
      note: result.note,
      sourceRef: result.sourceRef ?? null,
    });
  }
};

const respondError = ({
  res,
  requestId,
  error,
  detail,
  alwaysHttp200,
  statusCode,
}: {
  res: NextApiResponse;
  requestId: string;
  error: string;
  detail?: unknown;
  alwaysHttp200: boolean;
  statusCode?: number;
}) => {
  const code = alwaysHttp200 ? 200 : (statusCode ?? 500);
  return res.status(code).json(buildErrorPayload({ requestId, error, detail }));
};

/**
 * Builds a Fal status route that normalizes failures and settles refunds.
 */
export const createFalStatusHandler = ({
  queueBaseUrl,
  routeLabel,
  timeoutMs = 60000,
  alwaysHttp200 = true,
}: FalStatusConfig) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await requireApiUser(req, res);
    if (!user) return;

    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_status.config_missing",
        message: "FAL_KEY is not set on the server",
        statusCode: 500,
      });
      return res.status(500).json({ error: "FAL_KEY is not set on the server" });
    }

    const requestId = asString(req.body?.requestId);
    if (!requestId) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_status.validation_failed",
        message: "requestId is required",
        statusCode: 400,
        userId: user.id,
        userEmail: user.email ?? null,
      });
      return res.status(400).json({ error: "requestId is required" });
    }
    const ownership = await resolveProviderRequestOwnership({
      userId: user.id,
      providerRequestId: requestId,
    });
    if (ownership !== "owned") {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_status.ownership_forbidden",
        message: "Forbidden",
        statusCode: 403,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: {
          provider_request_id: requestId,
          ownership,
        },
      });
      return res.status(403).json({ error: "Forbidden" });
    }

    const respondErrorWithLogging = async ({
      requestId,
      error,
      detail,
      statusCode = 500,
      source = "api.fal_status.error",
      stage = null,
    }: {
      requestId: string;
      error: string;
      detail?: unknown;
      statusCode?: number;
      source?: string;
      stage?: string | null;
    }) => {
      await logGenerationFailure({
        req,
        routeLabel,
        source,
        message: error,
        statusCode,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: {
          provider_request_id: requestId,
          stage,
          detail,
        },
      });
      return respondError({
        res,
        requestId,
        error,
        detail,
        alwaysHttp200,
        statusCode,
      });
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const queueBaseUrls = Array.isArray(queueBaseUrl) ? queueBaseUrl : [queueBaseUrl];

    try {
      let statusResp: Response | null = null;
      let statusData: JsonReadResult | null = null;
      let resolvedQueueBaseUrl: string | null = null;

      const captureAndRespondSuccess = async ({
        payload,
        payloadStatus,
      }: {
        payload: JsonObject;
        payloadStatus: string;
      }) => {
        const captureResult = await captureSucceededGenerationByProviderRequest({
          userId: user.id,
          providerRequestId: requestId,
          reason: "Generation charge captured after successful Fal output.",
          routeLabel,
          detail: {
            stage: "result",
            payload_status: payloadStatus,
          },
        });
        if (!captureResult.settled && captureResult.note !== "charge_not_found") {
          console.error("[falStatusProxy] capture did not settle", {
            requestId,
            routeLabel,
            note: captureResult.note,
          });
        }

        return res.status(200).json({
          ...payload,
          status: payloadStatus,
          state: payloadStatus,
          request_id: requestId,
        });
      };

      for (const [index, baseUrl] of queueBaseUrls.entries()) {
        const response = await fetch(`${baseUrl}/${requestId}/status`, {
          method: "GET",
          headers: { Authorization: `Key ${apiKey}` },
          signal: controller.signal,
        });
        const data = await readJsonSafe(response);
        const canRetryOnAlternateBase =
          !data.isJson || response.status === 404 || response.status === 405;

        if (canRetryOnAlternateBase) {
          statusResp = response;
          statusData = data;
          continue;
        }

        statusResp = response;
        statusData = data;
        resolvedQueueBaseUrl = baseUrl;
        const hasMoreBaseUrls = index < queueBaseUrls.length - 1;
        const candidateStatus =
          normalizeStatus(data.json.status) ?? normalizeStatus(toRecord(data.json).state);
        const isCandidateTerminal = Boolean(
          candidateStatus &&
          (completedStatuses.has(candidateStatus) || failedStatuses.has(candidateStatus))
        );
        const hasCandidateResponseUrl = Boolean(extractResponseUrl(data.json));

        // Some Fal aliases lag behind others. When this base is still non-terminal and
        // has no response URL yet, keep probing alternate bases before settling.
        if (hasMoreBaseUrls && !isCandidateTerminal && !hasCandidateResponseUrl) {
          continue;
        }

        break;
      }

      if (!statusResp || !statusData) {
        return respondErrorWithLogging({
          requestId,
          error: `${routeLabel} status request failed`,
          statusCode: 500,
          source: "api.fal_status.status_request_failed",
          stage: "status",
        });
      }

      if (!resolvedQueueBaseUrl) {
        resolvedQueueBaseUrl = queueBaseUrls[0] ?? null;
      }

      const orderedResultBases = [
        resolvedQueueBaseUrl,
        ...queueBaseUrls.filter((baseUrl) => baseUrl !== resolvedQueueBaseUrl),
      ].filter((baseUrl): baseUrl is string => Boolean(baseUrl));

      if (!statusData.isJson) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-release: Fal status payload malformed.",
          routeLabel,
          detail: {
            stage: "status",
            malformed: true,
          },
        });
        return respondErrorWithLogging({
          requestId,
          error: `${routeLabel} returned non-JSON status response`,
          statusCode: 500,
          source: "api.fal_status.status_non_json",
          stage: "status",
          detail: statusData.text.slice(0, 500),
        });
      }

      const contentPolicyMessage = findContentPolicyMessage(statusData.json);
      if (contentPolicyMessage) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation blocked by content policy.",
          routeLabel,
          detail: {
            stage: "status",
            content_policy: true,
            payload: statusData.json,
          },
        });
        return respondErrorWithLogging({
          requestId,
          error: contentPolicyMessage,
          statusCode: 422,
          source: "api.fal_status.content_policy",
          stage: "status",
          detail: contentPolicyMessage,
        });
      }

      const normalizedStatus =
        normalizeStatus(statusData.json.status) ?? normalizeStatus(toRecord(statusData.json).state);
      if (normalizedStatus && failedStatuses.has(normalizedStatus)) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation failed during status polling.",
          routeLabel,
          detail: {
            stage: "status",
            upstream_status: normalizedStatus,
            payload: statusData.json,
          },
        });
        return respondErrorWithLogging({
          requestId,
          error:
            asString(statusData.json.error) ||
            asString(statusData.json.message) ||
            asString(toRecord(statusData.json).statusMessage) ||
            "Generation failed",
          statusCode: 422,
          source: "api.fal_status.status_failed",
          stage: "status",
          detail: statusData.json,
        });
      }

      if (!statusResp.ok) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-release: Fal status endpoint returned non-OK response.",
          routeLabel,
          detail: {
            stage: "status",
            upstream_status: statusResp.status,
            payload: statusData.json,
          },
        });
        return respondErrorWithLogging({
          requestId,
          error:
            asString(statusData.json.error) ||
            asString(statusData.json.message) ||
            `${routeLabel} status request failed`,
          statusCode: statusResp.status,
          source: "api.fal_status.status_upstream_non_ok",
          stage: "status",
          detail: statusData.json,
        });
      }

      const isComplete = Boolean(normalizedStatus && completedStatuses.has(normalizedStatus));
      if (!isComplete) {
        const responseUrl = extractResponseUrl(statusData.json);
        if (responseUrl) {
          const responseProbe = await fetch(responseUrl, {
            method: "GET",
            headers: { Authorization: `Key ${apiKey}` },
            signal: controller.signal,
          });
          const responseProbeData = await readJsonSafe(responseProbe);
          if (
            responseProbe.ok &&
            responseProbeData.isJson &&
            hasMediaPayload(responseProbeData.json)
          ) {
            return captureAndRespondSuccess({
              payload: responseProbeData.json,
              payloadStatus: "completed",
            });
          }
        }

        // Probe direct result endpoints as a fallback when status is lagging.
        // Fal occasionally materializes result payload before status transitions.
        for (const baseUrl of orderedResultBases) {
          const probeResponse = await fetch(`${baseUrl}/${requestId}`, {
            method: "GET",
            headers: { Authorization: `Key ${apiKey}` },
            signal: controller.signal,
          });
          const probeData = await readJsonSafe(probeResponse);
          if (!probeResponse.ok || !probeData.isJson || !hasMediaPayload(probeData.json)) {
            continue;
          }
          return captureAndRespondSuccess({
            payload: probeData.json,
            payloadStatus: "completed",
          });
        }
        return res.status(alwaysHttp200 ? 200 : statusResp.status).json(statusData.json);
      }

      // Some Fal models return terminal status payloads that already include media while
      // follow-up result probes intermittently lag or fail. Treat that payload as authoritative.
      if (hasMediaPayload(statusData.json)) {
        return captureAndRespondSuccess({
          payload: statusData.json,
          payloadStatus: resolveSuccessfulPayloadStatus(normalizedStatus),
        });
      }

      let resultResp: Response | null = null;
      let resultData: JsonReadResult | null = null;
      let allResultProbesRetryable = true;
      const responseUrl = extractResponseUrl(statusData.json);
      if (responseUrl) {
        const responseProbe = await fetch(responseUrl, {
          method: "GET",
          headers: { Authorization: `Key ${apiKey}` },
          signal: controller.signal,
        });
        const responseProbeData = await readJsonSafe(responseProbe);
        if (
          responseProbe.ok &&
          responseProbeData.isJson &&
          hasMediaPayload(responseProbeData.json)
        ) {
          const probeStatus = resolveSuccessfulPayloadStatus(
            responseProbeData.json.status,
            toRecord(responseProbeData.json).state,
            normalizedStatus
          );
          return captureAndRespondSuccess({
            payload: responseProbeData.json,
            payloadStatus: probeStatus,
          });
        }
      }

      for (const baseUrl of orderedResultBases) {
        const response = await fetch(`${baseUrl}/${requestId}`, {
          method: "GET",
          headers: { Authorization: `Key ${apiKey}` },
          signal: controller.signal,
        });
        const data = await readJsonSafe(response);
        const canRetryOnAlternateBase =
          !data.isJson || response.status === 404 || response.status === 405;

        if (canRetryOnAlternateBase) {
          resultResp = response;
          resultData = data;
          continue;
        }
        allResultProbesRetryable = false;

        const candidateStatus =
          normalizeStatus(data.json.status) ?? normalizeStatus(toRecord(data.json).state);
        const candidateHasError =
          candidateStatus === "error" ||
          candidateStatus === "failed" ||
          Boolean(asString(data.json.error));
        const candidateHasMedia = hasMediaPayload(data.json);

        // Probe alternates before declaring no-media failure. Queue aliases can disagree
        // transiently, and another base often has the completed payload.
        if (!candidateHasError && !candidateHasMedia) {
          resultResp = response;
          resultData = data;
          continue;
        }

        resultResp = response;
        resultData = data;
        break;
      }

      if (!resultResp || !resultData) {
        return respondErrorWithLogging({
          requestId,
          error: `${routeLabel} result request failed`,
          statusCode: 500,
          source: "api.fal_status.result_request_failed",
          stage: "result",
        });
      }

      // Treat a full sweep of retryable responses (404/405/non-JSON across aliases)
      // as transient so polling can continue instead of settling terminal failure.
      if (allResultProbesRetryable) {
        return res.status(alwaysHttp200 ? 200 : statusResp.status).json(statusData.json);
      }

      if (!resultData.isJson) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation result was non-JSON.",
          routeLabel,
          detail: {
            stage: "result",
            upstream_status: resultResp.status,
            raw: resultData.text.slice(0, 500),
          },
        });
        return respondErrorWithLogging({
          requestId,
          error: `${routeLabel} result returned non-JSON response`,
          statusCode: 500,
          source: "api.fal_status.result_non_json",
          stage: "result",
          detail: resultData.text.slice(0, 500),
        });
      }

      const resultPolicyMessage = findContentPolicyMessage(resultData.json);
      if (resultPolicyMessage) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation blocked by content policy.",
          routeLabel,
          detail: {
            stage: "result",
            content_policy: true,
            payload: resultData.json,
          },
        });
        return respondErrorWithLogging({
          requestId,
          error: resultPolicyMessage,
          statusCode: 422,
          source: "api.fal_status.content_policy",
          stage: "result",
          detail: resultPolicyMessage,
        });
      }

      if (!resultResp.ok) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation result endpoint failed.",
          routeLabel,
          detail: {
            stage: "result",
            upstream_status: resultResp.status,
            payload: resultData.json,
          },
        });
        return respondErrorWithLogging({
          requestId,
          error:
            asString(resultData.json.error) ||
            asString(resultData.json.message) ||
            "Generation failed",
          statusCode: resultResp.status,
          source: "api.fal_status.result_upstream_non_ok",
          stage: "result",
          detail: resultData.json,
        });
      }

      const resultStatus =
        normalizeStatus(resultData.json.status) ?? normalizeStatus(toRecord(resultData.json).state);
      if (
        resultStatus === "error" ||
        resultStatus === "failed" ||
        asString(resultData.json.error) ||
        !hasMediaPayload(resultData.json)
      ) {
        await settleFailure({
          userId: user.id,
          requestId,
          reason: "Auto-refund: Fal generation completed without usable media.",
          routeLabel,
          detail: {
            stage: "result",
            payload: resultData.json,
          },
        });
        return respondErrorWithLogging({
          requestId,
          error: asString(resultData.json.error) || "Generation failed to produce media output",
          statusCode: 502,
          source: "api.fal_status.result_missing_media",
          stage: "result",
          detail: resultData.json,
        });
      }

      return captureAndRespondSuccess({
        payload: resultData.json,
        payloadStatus: resolveSuccessfulPayloadStatus(resultStatus, normalizedStatus),
      });
    } catch (error) {
      await settleFailure({
        userId: user.id,
        requestId,
        reason: "Auto-release: Fal status check transport failure.",
        routeLabel,
        detail: {
          stage: "status",
          transport_error: String(error),
        },
      });
      return respondErrorWithLogging({
        requestId,
        error: `${routeLabel} status check failed`,
        statusCode: 500,
        source: "api.fal_status.transport_error",
        stage: "status",
        detail: String(error),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  };
};
