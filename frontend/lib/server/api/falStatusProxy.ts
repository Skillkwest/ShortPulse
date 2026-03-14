/**
 * Shared Fal status proxy with failure-aware refund settlement.
 * Polls queue status/result and refunds failed generations idempotently.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "./auth";
import { logGenerationFailure } from "./appErrorLogs";
import { readFalRuntimeFlags } from "./falRuntimeFlags";
import { resolveProviderRequestOwnership, settleGenerationOutcome } from "./generationBilling";
import { executeGenerationRecovery } from "../falIntegration/recoveryExecution";
import type { ResultProbeCandidate, StatusProbeCandidate } from "../falIntegration/contracts";
import {
  buildFalStatusErrorPayload,
  buildFalStatusTransientPayload,
  probeResponseUrlsForMedia,
  readJsonSafe,
  type JsonObject,
  type JsonReadResult,
} from "../falIntegration/statusProxyRuntime";
import {
  dispatchProviderResultRequest,
  dispatchProviderStatusRequest,
  resolveProviderStatusBaseUrls,
} from "../providerIntegration/statusProviderDispatcher";
import { asProviderString } from "../providerIntegration/canonicalProviderPayload";
import { readProviderApiKey } from "../providerIntegration/providerRuntimeConfig";
import {
  selectBestProviderResultCandidate,
  selectBestProviderStatusCandidate,
} from "../providerIntegration/statusProviderSelection";
import {
  isProviderCompletedStatus,
  isProviderFailedStatus,
  isProviderRetryableUpstreamResponse,
  resolveProviderSuccessfulPayloadStatus,
} from "../providerIntegration/statusProviderPolicy";
import {
  providerPayloadHasMedia,
  readProviderContentPolicyMessage,
  readProviderLifecycleStatus,
  readProviderResponseUrl,
} from "../providerIntegration/statusProviderPayload";

type FalStatusConfig = {
  provider?: string;
  modelId?: string | null;
  queueBaseUrl: string | string[];
  routeLabel: string;
  timeoutMs?: number;
  alwaysHttp200?: boolean;
};

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
  const result = await settleGenerationOutcome({
    userId,
    providerRequestId: requestId,
    outcome: "fail",
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
  try {
    await executeGenerationRecovery({
      actor: "status_proxy",
      requestId,
      userId,
      routeLabel,
      observation: {
        state: "failed",
        payload: detail ?? null,
        mediaUrls: [],
      },
    });
  } catch (error) {
    console.error("[falStatusProxy] failed to sync generation failure state", {
      requestId,
      routeLabel,
      error: String(error),
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
  return res.status(code).json(buildFalStatusErrorPayload({ requestId, error, detail }));
};

/**
 * Builds a Fal status route that normalizes failures and settles refunds.
 */
export const createFalStatusHandler = ({
  provider = "fal",
  modelId = null,
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

    const providerKey = provider.trim().toLowerCase();
    let apiKey: string;
    try {
      apiKey = readProviderApiKey(providerKey);
    } catch (error) {
      await logGenerationFailure({
        req,
        routeLabel,
        source: "api.fal_status.config_missing",
        message: String(error),
        statusCode: 500,
      });
      return res.status(500).json({ error: String(error) });
    }

    const requestId = asProviderString(req.body?.requestId);
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
    let queueBaseUrls: string[];
    try {
      queueBaseUrls = resolveProviderStatusBaseUrls({
        provider: providerKey,
        configuredBaseUrls: Array.isArray(queueBaseUrl) ? queueBaseUrl : [queueBaseUrl],
        modelId,
      });
    } catch (error) {
      return await respondErrorWithLogging({
        requestId,
        error: "Failed to resolve provider queue status base URLs.",
        detail: {
          provider: providerKey,
          modelId,
          queueBaseUrl,
          cause: String(error),
        },
        statusCode: 500,
        source: "api.fal_status.queue_base_url_resolution_failed",
        stage: "queue_base_url_resolution",
      });
    }
    if (!queueBaseUrls.length) {
      return await respondErrorWithLogging({
        requestId,
        error: "No trusted Fal queue base URL configured for this status route.",
        detail: { queueBaseUrl },
        statusCode: 500,
        source: "api.fal_status.untrusted_base_url",
        stage: "queue_base_url_validation",
      });
    }
    const runtimeFlags = readFalRuntimeFlags();
    const statusTransientFailuresEnabled = runtimeFlags.statusTransientFailuresEnabled;
    const respondTransientWithTelemetry = async ({
      source,
      stage,
      detail,
      upstreamStatus,
    }: {
      source: string;
      stage: "status" | "result";
      detail?: unknown;
      upstreamStatus?: number | null;
    }) => {
      await logGenerationFailure({
        req,
        routeLabel,
        source,
        message: "Fal status proxy encountered transient upstream state; continuing polling.",
        statusCode: upstreamStatus ?? 200,
        userId: user.id,
        userEmail: user.email ?? null,
        metadata: {
          provider_request_id: requestId,
          stage,
          detail: detail ?? null,
        },
      });
      return res.status(200).json(
        buildFalStatusTransientPayload({
          requestId,
          detail: {
            stage,
          },
        })
      );
    };

    try {
      let statusResp: Response | null = null;
      let statusData: JsonReadResult | null = null;
      let resolvedQueueBaseUrl: string | null = null;
      const statusResponseUrls = new Set<string>();
      const statusCandidates: Array<{
        probe: StatusProbeCandidate;
        response: Response;
        data: JsonReadResult;
      }> = [];
      const retryableStatusCandidates: Array<{
        probe: StatusProbeCandidate;
        response: Response;
        data: JsonReadResult;
      }> = [];

      const captureAndRespondSuccess = async ({
        payload,
        payloadStatus,
      }: {
        payload: JsonObject;
        payloadStatus: string;
      }) => {
        const captureResult = await settleGenerationOutcome({
          userId: user.id,
          providerRequestId: requestId,
          outcome: "success",
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
        try {
          await executeGenerationRecovery({
            actor: "status_proxy",
            requestId,
            userId: user.id,
            routeLabel,
            observation: {
              state: "completed",
              payload,
              mediaUrls: [],
            },
          });
        } catch (error) {
          console.error("[falStatusProxy] failed to sync generation success state", {
            requestId,
            routeLabel,
            error: String(error),
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
        const response = await dispatchProviderStatusRequest({
          provider: providerKey,
          baseUrl,
          requestId,
          apiKey,
          signal: controller.signal,
        });
        const data = await readJsonSafe(response);
        const candidateStatus = data.isJson
          ? readProviderLifecycleStatus({ provider: providerKey, payload: data.json })
          : null;
        const isCandidateCompleted = Boolean(
          candidateStatus &&
          isProviderCompletedStatus({
            provider: providerKey,
            status: candidateStatus,
          })
        );
        const isCandidateFailed = Boolean(
          candidateStatus &&
          isProviderFailedStatus({
            provider: providerKey,
            status: candidateStatus,
          })
        );
        const probe: StatusProbeCandidate = {
          index,
          baseUrl,
          isJson: data.isJson,
          isRetryableAlias: !data.isJson || response.status === 404 || response.status === 405,
          httpStatus: response.status,
          isHttpOk: response.ok,
          status: candidateStatus,
          isTerminal: isCandidateCompleted || isCandidateFailed,
          isCompleted: isCandidateCompleted,
          isFailed: isCandidateFailed,
          hasResponseUrl: data.isJson
            ? Boolean(readProviderResponseUrl({ provider: providerKey, payload: data.json }))
            : false,
          hasMedia: data.isJson
            ? providerPayloadHasMedia({ provider: providerKey, payload: data.json })
            : false,
        };
        const responseUrl = data.isJson
          ? readProviderResponseUrl({ provider: providerKey, payload: data.json })
          : null;
        if (responseUrl) {
          statusResponseUrls.add(responseUrl);
        }
        if (probe.isRetryableAlias) {
          retryableStatusCandidates.push({ probe, response, data });
          continue;
        }
        statusCandidates.push({ probe, response, data });
      }

      if (statusCandidates.length) {
        const bestStatusProbe = selectBestProviderStatusCandidate({
          provider: providerKey,
          candidates: statusCandidates.map((candidate) => candidate.probe),
        });
        const bestStatusCandidate =
          bestStatusProbe &&
          statusCandidates.find((candidate) => candidate.probe.index === bestStatusProbe.index);
        if (bestStatusCandidate) {
          statusResp = bestStatusCandidate.response;
          statusData = bestStatusCandidate.data;
          resolvedQueueBaseUrl = bestStatusCandidate.probe.baseUrl;
        }
      }

      if (!statusResp && retryableStatusCandidates.length) {
        const fallbackCandidate = retryableStatusCandidates[0];
        statusResp = fallbackCandidate.response;
        statusData = fallbackCandidate.data;
        resolvedQueueBaseUrl = fallbackCandidate.probe.baseUrl;
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

      const bestStatusMediaCandidate = statusCandidates.find(
        (candidate) => candidate.probe.isHttpOk && candidate.probe.hasMedia && candidate.data.isJson
      );
      if (bestStatusMediaCandidate) {
        return captureAndRespondSuccess({
          payload: bestStatusMediaCandidate.data.json,
          payloadStatus: resolveProviderSuccessfulPayloadStatus({
            provider: providerKey,
            candidates: [
              bestStatusMediaCandidate.probe.status,
              readProviderLifecycleStatus({
                provider: providerKey,
                payload: bestStatusMediaCandidate.data.json,
              }),
            ],
          }),
        });
      }

      const orderedResultBases = [
        resolvedQueueBaseUrl,
        ...queueBaseUrls.filter((baseUrl) => baseUrl !== resolvedQueueBaseUrl),
      ].filter((baseUrl): baseUrl is string => Boolean(baseUrl));

      if (!statusData.isJson) {
        if (statusTransientFailuresEnabled) {
          return respondTransientWithTelemetry({
            source: "telemetry.fal.status.transient.non_json_status",
            stage: "status",
            detail: statusData.text.slice(0, 500),
            upstreamStatus: statusResp.status,
          });
        }
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

      const contentPolicyMessage = readProviderContentPolicyMessage({
        provider: providerKey,
        payload: statusData.json,
      });
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

      const normalizedStatus = readProviderLifecycleStatus({
        provider: providerKey,
        payload: statusData.json,
      });
      const preferredResponseUrl = readProviderResponseUrl({
        provider: providerKey,
        payload: statusData.json,
      });
      const orderedResponseUrls = preferredResponseUrl
        ? [
            preferredResponseUrl,
            ...Array.from(statusResponseUrls).filter((url) => url !== preferredResponseUrl),
          ]
        : Array.from(statusResponseUrls);
      if (
        normalizedStatus &&
        isProviderFailedStatus({
          provider: providerKey,
          status: normalizedStatus,
        })
      ) {
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
            asProviderString(statusData.json.error) ||
            asProviderString(statusData.json.message) ||
            asProviderString(statusData.json.statusMessage) ||
            "Generation failed",
          statusCode: 422,
          source: "api.fal_status.status_failed",
          stage: "status",
          detail: statusData.json,
        });
      }

      if (!statusResp.ok) {
        if (
          isProviderRetryableUpstreamResponse({
            provider: providerKey,
            response: statusResp,
            payload: statusData.json,
          })
        ) {
          return res.status(alwaysHttp200 ? 200 : statusResp.status).json(statusData.json);
        }
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
            asProviderString(statusData.json.error) ||
            asProviderString(statusData.json.message) ||
            `${routeLabel} status request failed`,
          statusCode: statusResp.status,
          source: "api.fal_status.status_upstream_non_ok",
          stage: "status",
          detail: statusData.json,
        });
      }

      const isComplete = Boolean(
        normalizedStatus &&
        isProviderCompletedStatus({
          provider: providerKey,
          status: normalizedStatus,
        })
      );
      if (!isComplete) {
        const responseUrlProbe = await probeResponseUrlsForMedia({
          provider: providerKey,
          modelId,
          responseUrls: orderedResponseUrls,
          statusHint: normalizedStatus,
          apiKey,
          signal: controller.signal,
        });
        if (responseUrlProbe) {
          return captureAndRespondSuccess(responseUrlProbe);
        }

        // Probe direct result endpoints as a fallback when status is lagging.
        // Fal occasionally materializes result payload before status transitions.
        for (const baseUrl of orderedResultBases) {
          const probeResponse = await dispatchProviderResultRequest({
            provider: providerKey,
            baseUrl,
            requestId,
            apiKey,
            signal: controller.signal,
          });
          const probeData = await readJsonSafe(probeResponse);
          if (
            !probeResponse.ok ||
            !probeData.isJson ||
            !providerPayloadHasMedia({ provider: providerKey, payload: probeData.json })
          ) {
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
      if (providerPayloadHasMedia({ provider: providerKey, payload: statusData.json })) {
        return captureAndRespondSuccess({
          payload: statusData.json,
          payloadStatus: resolveProviderSuccessfulPayloadStatus({
            provider: providerKey,
            candidates: [normalizedStatus],
          }),
        });
      }

      let resultResp: Response | null = null;
      let resultData: JsonReadResult | null = null;
      const resultCandidates: Array<{
        probe: ResultProbeCandidate;
        response: Response;
        data: JsonReadResult;
      }> = [];
      const retryableResultCandidates: Array<{
        probe: ResultProbeCandidate;
        response: Response;
        data: JsonReadResult;
      }> = [];
      const responseUrlProbe = await probeResponseUrlsForMedia({
        provider: providerKey,
        modelId,
        responseUrls: orderedResponseUrls,
        statusHint: normalizedStatus,
        apiKey,
        signal: controller.signal,
      });
      if (responseUrlProbe) {
        return captureAndRespondSuccess(responseUrlProbe);
      }

      for (const [index, baseUrl] of orderedResultBases.entries()) {
        const response = await dispatchProviderResultRequest({
          provider: providerKey,
          baseUrl,
          requestId,
          apiKey,
          signal: controller.signal,
        });
        const data = await readJsonSafe(response);
        const candidateStatus = data.isJson
          ? readProviderLifecycleStatus({ provider: providerKey, payload: data.json })
          : null;
        const candidateHasError = data.isJson
          ? candidateStatus === "error" ||
            candidateStatus === "failed" ||
            Boolean(asProviderString(data.json.error))
          : false;
        const probe: ResultProbeCandidate = {
          index,
          baseUrl,
          isJson: data.isJson,
          isRetryableAlias: response.status === 404 || response.status === 405,
          httpStatus: response.status,
          isHttpOk: response.ok,
          status: candidateStatus,
          hasError: candidateHasError,
          hasMedia: data.isJson
            ? providerPayloadHasMedia({ provider: providerKey, payload: data.json })
            : false,
        };
        if (probe.isRetryableAlias) {
          retryableResultCandidates.push({ probe, response, data });
          continue;
        }
        resultCandidates.push({ probe, response, data });
      }

      if (!resultCandidates.length && !retryableResultCandidates.length) {
        return respondErrorWithLogging({
          requestId,
          error: `${routeLabel} result request failed`,
          statusCode: 500,
          source: "api.fal_status.result_request_failed",
          stage: "result",
        });
      }

      // Treat a full sweep of retryable alias responses (404/405) as
      // transient so polling can continue instead of settling terminal failure.
      if (!resultCandidates.length) {
        return res.status(alwaysHttp200 ? 200 : statusResp.status).json(statusData.json);
      }

      const bestResultProbe = selectBestProviderResultCandidate({
        provider: providerKey,
        candidates: resultCandidates.map((candidate) => candidate.probe),
      });
      const bestResultCandidate =
        bestResultProbe &&
        resultCandidates.find((candidate) => candidate.probe.index === bestResultProbe.index);
      if (bestResultCandidate) {
        resultResp = bestResultCandidate.response;
        resultData = bestResultCandidate.data;
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

      if (!resultData.isJson) {
        if (
          isProviderRetryableUpstreamResponse({
            provider: providerKey,
            response: resultResp,
            payload: resultData.json,
          })
        ) {
          return res.status(alwaysHttp200 ? 200 : statusResp.status).json(statusData.json);
        }
        if (statusTransientFailuresEnabled) {
          return respondTransientWithTelemetry({
            source: "telemetry.fal.status.transient.non_json_result",
            stage: "result",
            detail: resultData.text.slice(0, 500),
            upstreamStatus: resultResp.status,
          });
        }
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

      const resultPolicyMessage = readProviderContentPolicyMessage({
        provider: providerKey,
        payload: resultData.json,
      });
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
        if (
          isProviderRetryableUpstreamResponse({
            provider: providerKey,
            response: resultResp,
            payload: resultData.json,
          })
        ) {
          return res.status(alwaysHttp200 ? 200 : statusResp.status).json(statusData.json);
        }
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
            asProviderString(resultData.json.error) ||
            asProviderString(resultData.json.message) ||
            "Generation failed",
          statusCode: resultResp.status,
          source: "api.fal_status.result_upstream_non_ok",
          stage: "result",
          detail: resultData.json,
        });
      }

      const resultStatus = readProviderLifecycleStatus({
        provider: providerKey,
        payload: resultData.json,
      });
      const resultErrorMessage = asProviderString(resultData.json.error);
      const explicitResultFailure =
        resultStatus === "error" || resultStatus === "failed" || Boolean(resultErrorMessage);
      const resultHasMedia = providerPayloadHasMedia({
        provider: providerKey,
        payload: resultData.json,
      });

      if (!explicitResultFailure && !resultHasMedia && statusTransientFailuresEnabled) {
        return respondTransientWithTelemetry({
          source: "telemetry.fal.status.transient.no_media",
          stage: "result",
          detail: {
            result_status: resultStatus,
          },
          upstreamStatus: resultResp.status,
        });
      }

      if (explicitResultFailure || !resultHasMedia) {
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
          error: resultErrorMessage || "Generation failed to produce media output",
          statusCode: 502,
          source: "api.fal_status.result_missing_media",
          stage: "result",
          detail: resultData.json,
        });
      }

      return captureAndRespondSuccess({
        payload: resultData.json,
        payloadStatus: resolveProviderSuccessfulPayloadStatus({
          provider: providerKey,
          candidates: [resultStatus, normalizedStatus],
        }),
      });
    } catch (error) {
      if (statusTransientFailuresEnabled) {
        return respondTransientWithTelemetry({
          source: "telemetry.fal.status.transient.transport",
          stage: "status",
          detail: String(error),
        });
      }
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
