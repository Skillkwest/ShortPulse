/**
 * Shared provider status proxy.
 * Polls provider status/result endpoints and settles terminal outcomes canonically.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "./auth";
import { logGenerationFailure } from "./appErrorLogs";
import { readFalRuntimeFlags } from "./falRuntimeFlags";
import {
  settleDirectGenerationFailure,
  settleDirectGenerationSuccess,
} from "./directGenerationSettlement";
import { resolveProviderRequestOwnership } from "./generationBilling";
import {
  buildPersistedFailedPayload,
  buildPersistedCompletedPayload,
  readPersistedGenerationStatusContext,
} from "./falStatusPersistedResults";
import type { ResultProbeCandidate, StatusProbeCandidate } from "../falIntegration/contracts";
import {
  buildFalStatusErrorPayload,
  buildShortPulseLifecycleHint,
  buildFalStatusTransientPayload,
  readJsonSafe,
  type JsonObject,
  type JsonReadResult,
} from "../falIntegration/statusProxyRuntime";
import { executeGenerationRecovery } from "../falIntegration/recoveryExecution";
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
  readProviderMediaUrls,
  readProviderResponseUrl,
} from "../providerIntegration/statusProviderPayload";
import { normalizeExplicitContentFailure } from "../../explicitContentFailure";
import { getSupabaseAdmin } from "./supabaseAdmin";

type FalStatusConfig = {
  provider?: string;
  modelId?: string | null;
  queueBaseUrl: string | string[];
  routeLabel: string;
  timeoutMs?: number;
  alwaysHttp200?: boolean;
};

type GuardedNextApiResponse = NextApiResponse & {
  __shortpulseResponseCommitted?: boolean;
};

const sendJsonResponse = ({
  res,
  statusCode,
  payload,
}: {
  res: NextApiResponse;
  statusCode: number;
  payload: unknown;
}) => {
  const guardedResponse = res as GuardedNextApiResponse;
  if (
    guardedResponse.__shortpulseResponseCommitted ||
    guardedResponse.writableEnded ||
    guardedResponse.headersSent
  ) {
    return res;
  }
  guardedResponse.__shortpulseResponseCommitted = true;
  return res.status(statusCode).json(payload);
};

const respondError = ({
  res,
  requestId,
  error,
  detail,
  alwaysHttp200,
  statusCode,
  generationId,
  lifecycle,
}: {
  res: NextApiResponse;
  requestId: string;
  error: string;
  detail?: unknown;
  alwaysHttp200: boolean;
  statusCode?: number;
  generationId?: string | null;
  lifecycle?: import("../falIntegration/statusProxyRuntime").ShortPulseLifecycleHint;
}) => {
  const code = alwaysHttp200 ? 200 : (statusCode ?? 500);
  return sendJsonResponse({
    res,
    statusCode: code,
    payload: buildFalStatusErrorPayload({ requestId, error, detail, generationId, lifecycle }),
  });
};

const attachShortPulseLifecycle = ({
  payload,
  lifecycle,
}: {
  payload: JsonObject;
  lifecycle?: import("../falIntegration/statusProxyRuntime").ShortPulseLifecycleHint;
}): JsonObject => {
  if (!lifecycle || payload.shortpulseLifecycle) return payload;
  return {
    ...payload,
    shortpulseLifecycle: lifecycle,
  };
};

const ACTIVE_POLLING_QUEUE_STATE = "dispatched" as const;

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const deriveFalStatusBaseFromProviderUrl = ({
  requestId,
  url,
}: {
  requestId: string;
  url: string | null;
}): string | null => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const requestSegment = `/${encodeURIComponent(requestId)}`;
    if (parsed.pathname.endsWith(`${requestSegment}/status`)) {
      parsed.pathname = parsed.pathname.slice(0, -`${requestSegment}/status`.length);
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString().replace(/\/+$/, "");
    }
    if (parsed.pathname.endsWith(requestSegment)) {
      parsed.pathname = parsed.pathname.slice(0, -requestSegment.length);
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString().replace(/\/+$/, "");
    }
  } catch {
    return null;
  }
  return null;
};

const readProviderReturnedStatusBases = async ({
  provider,
  requestId,
  userId,
}: {
  provider: string;
  requestId: string;
  userId: string;
}): Promise<string[]> => {
  if (provider !== "fal") return [];
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("ai_generations")
      .select("metadata")
      .eq("user_id", userId)
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error || !Array.isArray(data) || !data.length) return [];
    const metadata = asObject(asObject(data[0]).metadata);
    const statusBase = deriveFalStatusBaseFromProviderUrl({
      requestId,
      url: asProviderString(metadata.provider_status_url),
    });
    const responseBase = deriveFalStatusBaseFromProviderUrl({
      requestId,
      url: asProviderString(metadata.provider_response_url),
    });
    return [
      ...new Set([statusBase, responseBase].filter((value): value is string => Boolean(value))),
    ];
  } catch {
    return [];
  }
};

const resolveLifecycleStatusLabel = ({
  taskState,
  recoveryPending = false,
}: {
  taskState: "pending" | "running" | "success" | "fail";
  recoveryPending?: boolean;
}): string | null => {
  if (taskState === "success") return "Just now";
  if (recoveryPending) return "Processing...";
  if (taskState === "pending") return "Processing...";
  if (taskState === "running") return "Processing...";
  return null;
};

const buildNonterminalLifecycleHint = ({
  normalizedStatus,
  recoveryPending = false,
}: {
  normalizedStatus: string | null;
  recoveryPending?: boolean;
}): import("../falIntegration/statusProxyRuntime").ShortPulseLifecycleHint =>
  buildShortPulseLifecycleHint({
    taskState:
      normalizedStatus === "pending" ||
      normalizedStatus === "queued" ||
      normalizedStatus === "in_queue"
        ? "pending"
        : "running",
    isTerminal: false,
    providerState: normalizedStatus ?? "running",
    recoveryPending,
    queueState: ACTIVE_POLLING_QUEUE_STATE,
    statusLabel: resolveLifecycleStatusLabel({
      taskState:
        normalizedStatus === "pending" ||
        normalizedStatus === "queued" ||
        normalizedStatus === "in_queue"
          ? "pending"
          : "running",
      recoveryPending,
    }),
  });

const isRecoverableNoMediaFailure = ({
  taskState,
  errorMessageShort,
  errorDetail,
}: {
  taskState?: string | null;
  errorMessageShort?: string | null;
  errorDetail?: string | null;
}): boolean => {
  if (taskState !== "fail") return false;
  const normalizedShort = errorMessageShort?.trim().toLowerCase() ?? "";
  const normalizedDetail = errorDetail?.trim().toLowerCase() ?? "";
  return (
    normalizedShort === "no media returned." ||
    normalizedShort === "no media returned" ||
    normalizedDetail.includes("terminal success without media payload")
  );
};

/**
 * Builds a provider status route that normalizes polling responses without side effects.
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
      return sendJsonResponse({
        res,
        statusCode: 405,
        payload: { error: "Method not allowed" },
      });
    }

    const user = await requireApiUser(req, res);
    if (!user) return;

    const providerKey = provider.trim().toLowerCase();

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
      return sendJsonResponse({
        res,
        statusCode: 400,
        payload: { error: "requestId is required" },
      });
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
      return sendJsonResponse({
        res,
        statusCode: 403,
        payload: { error: "Forbidden" },
      });
    }

    const persistedGenerationContext = await readPersistedGenerationStatusContext({
      userId: user.id,
      requestId,
    });
    const shouldProbeProviderBeforeFail =
      persistedGenerationContext.completionState === "completed_awaiting_media" ||
      isRecoverableNoMediaFailure({
        taskState: persistedGenerationContext.taskState,
        errorMessageShort: persistedGenerationContext.errorMessageShort,
        errorDetail: persistedGenerationContext.errorDetail,
      });
    const generationId = persistedGenerationContext.generationId;
    const attachGenerationId = (payload: JsonObject): JsonObject => {
      if (!generationId) return payload;
      const existingGenerationId = asProviderString(payload.generationId);
      if (existingGenerationId) return payload;
      return {
        ...payload,
        generationId,
      };
    };
    if (persistedGenerationContext.resultUrls.length > 0) {
      return sendJsonResponse({
        res,
        statusCode: 200,
        payload: buildPersistedCompletedPayload({
          requestId,
          resultUrls: persistedGenerationContext.resultUrls,
          generationId,
          saveState: persistedGenerationContext.saveState ?? null,
          saveError: persistedGenerationContext.saveError ?? null,
          deliveryState: persistedGenerationContext.deliveryState ?? "canonical_owned",
          recoveryPending: persistedGenerationContext.recoveryPending === true,
          completionState: persistedGenerationContext.completionState ?? null,
          providerState: persistedGenerationContext.status ?? "completed",
        }),
      });
    }
    if (persistedGenerationContext.taskState === "fail" && !shouldProbeProviderBeforeFail) {
      return respondError({
        res,
        requestId,
        error: persistedGenerationContext.errorMessageShort?.trim() || "Generation failed",
        detail:
          persistedGenerationContext.errorDetail ??
          persistedGenerationContext.errorMessageShort ??
          "Generation failed",
        alwaysHttp200,
        statusCode: 422,
        generationId,
        lifecycle: buildShortPulseLifecycleHint({
          taskState: "fail",
          isTerminal: true,
          errorMessage: persistedGenerationContext.errorMessageShort?.trim() || "Generation failed",
          errorDetail:
            persistedGenerationContext.errorDetail ??
            persistedGenerationContext.errorMessageShort ??
            "Generation failed",
          queueState: "failed",
        }),
      });
    }
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
      return sendJsonResponse({
        res,
        statusCode: 500,
        payload: { error: String(error) },
      });
    }

    const respondErrorWithLogging = async ({
      requestId,
      error,
      detail,
      statusCode = 500,
      source = "api.fal_status.error",
      stage = null,
      lifecycle,
    }: {
      requestId: string;
      error: string;
      detail?: unknown;
      statusCode?: number;
      source?: string;
      stage?: string | null;
      lifecycle?: import("../falIntegration/statusProxyRuntime").ShortPulseLifecycleHint;
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
        generationId,
        lifecycle,
      });
    };

    const readCanonicalStatusContext = async () =>
      readPersistedGenerationStatusContext({
        userId: user.id,
        requestId,
      });
    const settleCanonicalCompletedPayload = async ({
      payload,
      providerState,
    }: {
      payload: JsonObject;
      providerState: string;
    }) => {
      const settlement = await settleDirectGenerationSuccess({
        generationId,
        requestId,
        userId: user.id,
        routeLabel,
        providerState,
        resultUrls: readProviderMediaUrls({
          provider: providerKey,
          modelId,
          payload,
        }),
      });
      if (!settlement.ok) {
        await logGenerationFailure({
          req,
          routeLabel,
          source: "telemetry.api.fal_status.direct_settlement_failed",
          message: "Failed to persist canonical completed generation state.",
          statusCode: 200,
          userId: user.id,
          userEmail: user.email ?? null,
          metadata: {
            provider_request_id: requestId,
            provider_state: providerState,
            detail: settlement.error,
          },
        });
        return respondError({
          res,
          requestId,
          error: "Failed to finalize generation result. Please retry.",
          detail: settlement.error,
          alwaysHttp200,
          statusCode: 500,
          generationId,
        });
      }
      const canonicalPayload = await respondWithCanonicalCompletedPayload({
        providerState,
      });
      if (canonicalPayload) return canonicalPayload;
      return respondError({
        res,
        requestId,
        error: "Generation completed but canonical media was unavailable.",
        detail: {
          provider_state: providerState,
          provider_request_id: requestId,
        },
        alwaysHttp200,
        statusCode: 500,
        generationId: settlement.generationId,
      });
    };
    const settleCanonicalFailedPayload = async ({
      providerState,
      fallbackMessage,
      fallbackDetail,
      failureReasonCode = "provider_error",
    }: {
      providerState: string | null;
      fallbackMessage: string;
      fallbackDetail?: unknown;
      failureReasonCode?: string;
    }) => {
      const settlement = await settleDirectGenerationFailure({
        generationId,
        requestId,
        userId: user.id,
        routeLabel,
        providerState,
        errorMessage: fallbackMessage,
        errorDetail: fallbackDetail,
        failureReasonCode,
      });
      if (!settlement.ok) {
        await logGenerationFailure({
          req,
          routeLabel,
          source: "telemetry.api.fal_status.direct_failure_settlement_failed",
          message: "Failed to persist canonical failed generation state.",
          statusCode: 200,
          userId: user.id,
          userEmail: user.email ?? null,
          metadata: {
            provider_request_id: requestId,
            provider_state: providerState,
            detail: settlement.error,
          },
        });
        return respondError({
          res,
          requestId,
          error: fallbackMessage,
          detail: fallbackDetail,
          alwaysHttp200,
          statusCode: 500,
          generationId,
        });
      }
      const persistedFailure = await respondWithCanonicalFailedPayload({
        providerState,
        fallbackMessage,
        fallbackDetail,
      });
      if (persistedFailure) return persistedFailure;
      return respondError({
        res,
        requestId,
        error: fallbackMessage,
        detail: fallbackDetail,
        alwaysHttp200,
        statusCode: 500,
        generationId: settlement.generationId,
      });
    };
    const respondWithCanonicalFailedPayload = async ({
      providerState,
      fallbackMessage,
      fallbackDetail,
    }: {
      providerState?: string | null;
      fallbackMessage: string;
      fallbackDetail?: unknown;
    }) => {
      const canonicalContext = await readCanonicalStatusContext();
      if (canonicalContext.taskState !== "fail") return null;
      return sendJsonResponse({
        res,
        statusCode: 200,
        payload: buildPersistedFailedPayload({
          requestId,
          generationId: canonicalContext.generationId ?? generationId,
          errorMessage:
            canonicalContext.errorMessageShort?.trim() ||
            canonicalContext.errorDetail?.trim() ||
            fallbackMessage,
          errorDetail:
            canonicalContext.errorDetail ?? canonicalContext.errorMessageShort ?? fallbackDetail,
          providerState,
          queueState: canonicalContext.queueState ?? "failed",
        }),
      });
    };
    const respondWithCanonicalCompletedPayload = async ({
      providerState,
    }: {
      providerState: string;
    }) => {
      const canonicalContext = await readCanonicalStatusContext();
      if (!canonicalContext.resultUrls.length) return null;
      return sendJsonResponse({
        res,
        statusCode: 200,
        payload: buildPersistedCompletedPayload({
          requestId,
          resultUrls: canonicalContext.resultUrls,
          generationId: canonicalContext.generationId ?? generationId,
          saveState: canonicalContext.saveState ?? null,
          saveError: canonicalContext.saveError ?? null,
          deliveryState: canonicalContext.deliveryState ?? "canonical_owned",
          recoveryPending: canonicalContext.recoveryPending === true,
          completionState: canonicalContext.completionState ?? null,
          providerState,
        }),
      });
    };
    const respondRecoveryPendingPayload = ({
      providerState,
      detail,
    }: {
      providerState: string | null;
      detail?: unknown;
    }) =>
      sendJsonResponse({
        res,
        statusCode: 200,
        payload: buildFalStatusTransientPayload({
          requestId,
          detail,
          generationId,
          lifecycle: buildShortPulseLifecycleHint({
            taskState: "running",
            isTerminal: false,
            providerState: providerState ?? "completed",
            recoveryPending: true,
            completionState: "completed_awaiting_media",
            queueState: ACTIVE_POLLING_QUEUE_STATE,
            statusLabel: resolveLifecycleStatusLabel({
              taskState: "running",
              recoveryPending: true,
            }),
          }),
        }),
      });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const readPayloadLifecycleStatus = (payload: unknown): string | null =>
      readProviderLifecycleStatus({
        provider: providerKey,
        modelId,
        payload,
      });
    const readPayloadResponseUrl = (payload: unknown): string | null =>
      readProviderResponseUrl({
        provider: providerKey,
        modelId,
        payload,
      });
    const payloadHasMedia = (payload: unknown): boolean =>
      providerPayloadHasMedia({
        provider: providerKey,
        modelId,
        payload,
      });
    let queueBaseUrls: string[];
    try {
      const providerReturnedStatusBases = await readProviderReturnedStatusBases({
        provider: providerKey,
        requestId,
        userId: user.id,
      });
      const configuredBaseUrls = Array.isArray(queueBaseUrl) ? queueBaseUrl : [queueBaseUrl];
      queueBaseUrls = resolveProviderStatusBaseUrls({
        provider: providerKey,
        configuredBaseUrls: [...providerReturnedStatusBases, ...configuredBaseUrls],
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
        error: "No trusted provider status URL configured for this status route.",
        detail: { provider: providerKey, queueBaseUrl },
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
      return sendJsonResponse({
        res,
        statusCode: 200,
        payload: buildFalStatusTransientPayload({
          requestId,
          detail: {
            stage,
          },
          generationId,
          lifecycle: buildShortPulseLifecycleHint({
            taskState: "running",
            isTerminal: false,
            providerState: "running",
            recoveryPending: true,
            queueState: ACTIVE_POLLING_QUEUE_STATE,
            statusLabel: resolveLifecycleStatusLabel({
              taskState: "running",
              recoveryPending: true,
            }),
          }),
        }),
      });
    };

    try {
      let statusResp: Response | null = null;
      let statusData: JsonReadResult | null = null;
      let resolvedQueueBaseUrl: string | null = null;
      const statusCandidates: Array<{
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
      }) => settleCanonicalCompletedPayload({ payload, providerState: payloadStatus });

      const statusProbeResults = await Promise.all(
        queueBaseUrls.map(async (baseUrl, index) => {
          try {
            const response = await dispatchProviderStatusRequest({
              provider: providerKey,
              baseUrl,
              requestId,
              apiKey,
              signal: controller.signal,
            });
            const data = await readJsonSafe(response);
            const candidateStatus = data.isJson ? readPayloadLifecycleStatus(data.json) : null;
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
              isRetryableAlias: false,
              httpStatus: response.status,
              isHttpOk: response.ok,
              status: candidateStatus,
              isTerminal: isCandidateCompleted || isCandidateFailed,
              isCompleted: isCandidateCompleted,
              isFailed: isCandidateFailed,
              hasResponseUrl: data.isJson ? Boolean(readPayloadResponseUrl(data.json)) : false,
              hasMedia: data.isJson ? payloadHasMedia(data.json) : false,
            };
            return { probe, response, data };
          } catch {
            return null;
          }
        })
      );

      for (const statusProbeResult of statusProbeResults) {
        if (!statusProbeResult) continue;
        const { probe, response, data } = statusProbeResult;
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

      if (!statusResp || !statusData) {
        if (
          !statusProbeResults.some((result) => result !== null) &&
          statusTransientFailuresEnabled
        ) {
          return respondTransientWithTelemetry({
            source: "telemetry.fal.status.transient.transport",
            stage: "status",
            detail: "all_status_aliases_failed",
          });
        }
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
              readPayloadLifecycleStatus(bestStatusMediaCandidate.data.json),
            ],
          }),
        });
      }

      const orderedResultBases = [resolvedQueueBaseUrl].filter((baseUrl): baseUrl is string =>
        Boolean(baseUrl)
      );

      if (!statusData.isJson) {
        if (statusTransientFailuresEnabled) {
          return respondTransientWithTelemetry({
            source: "telemetry.fal.status.transient.non_json_status",
            stage: "status",
            detail: statusData.text.slice(0, 500),
            upstreamStatus: statusResp.status,
          });
        }
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
        const contentPolicyStatus = readPayloadLifecycleStatus(statusData.json) ?? "failed";
        const explicitContentFailure = normalizeExplicitContentFailure({
          message: contentPolicyMessage,
          detail: contentPolicyMessage,
          force: true,
        });
        return await settleCanonicalFailedPayload({
          providerState: contentPolicyStatus,
          fallbackMessage: explicitContentFailure?.errorMessage ?? contentPolicyMessage,
          fallbackDetail: explicitContentFailure?.errorDetail ?? contentPolicyMessage,
          failureReasonCode: "content_policy_block",
        });
      }

      const normalizedStatus = readPayloadLifecycleStatus(statusData.json);
      if (
        normalizedStatus &&
        isProviderFailedStatus({
          provider: providerKey,
          status: normalizedStatus,
        })
      ) {
        return await settleCanonicalFailedPayload({
          providerState: normalizedStatus,
          fallbackMessage:
            asProviderString(statusData.json.error) ||
            asProviderString(statusData.json.message) ||
            asProviderString(statusData.json.statusMessage) ||
            "Generation failed",
          fallbackDetail: statusData.json,
          failureReasonCode: "provider_error",
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
          if (payloadHasMedia(statusData.json)) {
            return captureAndRespondSuccess({
              payload: statusData.json,
              payloadStatus: resolveProviderSuccessfulPayloadStatus({
                provider: providerKey,
                candidates: [normalizedStatus],
              }),
            });
          }
          return sendJsonResponse({
            res,
            statusCode: alwaysHttp200 ? 200 : statusResp.status,
            payload: attachGenerationId(
              attachShortPulseLifecycle({
                payload: statusData.json,
                lifecycle: buildShortPulseLifecycleHint({
                  taskState: "running",
                  isTerminal: false,
                  providerState: normalizedStatus ?? "running",
                  recoveryPending: true,
                }),
              })
            ),
          });
        }
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
        return sendJsonResponse({
          res,
          statusCode: alwaysHttp200 ? 200 : statusResp.status,
          payload: attachGenerationId(
            attachShortPulseLifecycle({
              payload: statusData.json,
              lifecycle: buildNonterminalLifecycleHint({
                normalizedStatus,
              }),
            })
          ),
        });
      }

      // Some Fal models return terminal status payloads that already include media while
      // follow-up result probes intermittently lag or fail. Treat that payload as authoritative.
      if (payloadHasMedia(statusData.json)) {
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

      const resultProbeResults = await Promise.all(
        orderedResultBases.map(async (baseUrl, index) => {
          try {
            const response = await dispatchProviderResultRequest({
              provider: providerKey,
              baseUrl,
              requestId,
              apiKey,
              signal: controller.signal,
            });
            const data = await readJsonSafe(response);
            const candidateStatus = data.isJson ? readPayloadLifecycleStatus(data.json) : null;
            const candidateHasError = data.isJson
              ? candidateStatus === "error" ||
                candidateStatus === "failed" ||
                Boolean(asProviderString(data.json.error))
              : false;
            const probe: ResultProbeCandidate = {
              index,
              baseUrl,
              isJson: data.isJson,
              isRetryableAlias: false,
              httpStatus: response.status,
              isHttpOk: response.ok,
              status: candidateStatus,
              hasError: candidateHasError,
              hasMedia: data.isJson ? payloadHasMedia(data.json) : false,
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
        resultCandidates.push({ probe, response, data });
      }

      if (!resultCandidates.length) {
        return respondErrorWithLogging({
          requestId,
          error: `${routeLabel} result request failed`,
          statusCode: 500,
          source: "api.fal_status.result_request_failed",
          stage: "result",
        });
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
          return sendJsonResponse({
            res,
            statusCode: alwaysHttp200 ? 200 : statusResp.status,
            payload: attachGenerationId(
              attachShortPulseLifecycle({
                payload: statusData.json,
                lifecycle: buildNonterminalLifecycleHint({
                  normalizedStatus,
                  recoveryPending: true,
                }),
              })
            ),
          });
        }
        if (statusTransientFailuresEnabled) {
          return respondTransientWithTelemetry({
            source: "telemetry.fal.status.transient.non_json_result",
            stage: "result",
            detail: resultData.text.slice(0, 500),
            upstreamStatus: resultResp.status,
          });
        }
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
        const explicitContentFailure = normalizeExplicitContentFailure({
          message: resultPolicyMessage,
          detail: resultPolicyMessage,
          force: true,
        });
        return await settleCanonicalFailedPayload({
          providerState: readPayloadLifecycleStatus(resultData.json) ?? normalizedStatus,
          fallbackMessage: explicitContentFailure?.errorMessage ?? resultPolicyMessage,
          fallbackDetail: explicitContentFailure?.errorDetail ?? resultPolicyMessage,
          failureReasonCode: "content_policy_block",
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
          if (payloadHasMedia(resultData.json)) {
            return captureAndRespondSuccess({
              payload: resultData.json,
              payloadStatus: resolveProviderSuccessfulPayloadStatus({
                provider: providerKey,
                candidates: [readPayloadLifecycleStatus(resultData.json), normalizedStatus],
              }),
            });
          }
          return sendJsonResponse({
            res,
            statusCode: alwaysHttp200 ? 200 : statusResp.status,
            payload: attachGenerationId(
              attachShortPulseLifecycle({
                payload: statusData.json,
                lifecycle: buildNonterminalLifecycleHint({
                  normalizedStatus,
                  recoveryPending: true,
                }),
              })
            ),
          });
        }
        return await settleCanonicalFailedPayload({
          providerState: readPayloadLifecycleStatus(resultData.json) ?? normalizedStatus,
          fallbackMessage:
            asProviderString(resultData.json.error) ||
            asProviderString(resultData.json.message) ||
            "Generation failed",
          fallbackDetail: resultData.json,
          failureReasonCode: "provider_error",
        });
      }

      const resultStatus = readPayloadLifecycleStatus(resultData.json);
      const resultErrorMessage = asProviderString(resultData.json.error);
      const explicitResultFailure =
        resultStatus === "error" || resultStatus === "failed" || Boolean(resultErrorMessage);
      const resultHasMedia = payloadHasMedia(resultData.json);

      if (explicitResultFailure) {
        return await settleCanonicalFailedPayload({
          providerState: resultStatus ?? normalizedStatus,
          fallbackMessage: resultErrorMessage || "Generation failed to produce media output",
          fallbackDetail: resultData.json,
          failureReasonCode: "provider_error",
        });
      }

      if (!resultHasMedia) {
        try {
          const recoveryResult = await executeGenerationRecovery({
            actor: "poll",
            generationId,
            requestId,
            userId: user.id,
            observation: {
              state: "completed",
              payload: resultData.json,
              mediaUrls: [],
            },
            routeLabel,
          });
          if (
            recoveryResult.state === "recovered" ||
            recoveryResult.state === "already_persisted"
          ) {
            const canonicalPayload = await respondWithCanonicalCompletedPayload({
              providerState: resultStatus ?? normalizedStatus ?? "completed",
            });
            if (canonicalPayload) return canonicalPayload;
            return respondError({
              res,
              requestId,
              error: "Generation completed but canonical media was unavailable.",
              detail: {
                provider_state: resultStatus ?? normalizedStatus ?? "completed",
                provider_request_id: requestId,
              },
              alwaysHttp200,
              statusCode: 500,
              generationId: recoveryResult.generationId ?? generationId,
            });
          }
          if (recoveryResult.state === "provider_failed" || recoveryResult.state === "exhausted") {
            const failedPayload = await respondWithCanonicalFailedPayload({
              providerState: resultStatus ?? normalizedStatus ?? "completed",
              fallbackMessage: "Generation failed to produce media output",
              fallbackDetail: resultData.json,
            });
            if (failedPayload) return failedPayload;
            return respondError({
              res,
              requestId,
              error: "Generation failed to produce media output",
              detail: resultData.json,
              alwaysHttp200,
              statusCode: 500,
              generationId: recoveryResult.generationId ?? generationId,
            });
          }
          return respondRecoveryPendingPayload({
            providerState: resultStatus ?? normalizedStatus ?? "completed",
            detail: {
              stage: "result",
              recovery_state: recoveryResult.state,
            },
          });
        } catch (error) {
          await logGenerationFailure({
            req,
            routeLabel,
            source: "telemetry.api.fal_status.no_media_recovery_failed",
            message: "Failed to reconcile terminal no-media provider result.",
            statusCode: 500,
            userId: user.id,
            userEmail: user.email ?? null,
            metadata: {
              provider_request_id: requestId,
              provider_state: resultStatus ?? normalizedStatus ?? "completed",
              detail: error instanceof Error ? error.message : String(error),
            },
          });
          return respondError({
            res,
            requestId,
            error: "Failed to finalize generation result. Please retry.",
            detail: error instanceof Error ? error.message : String(error),
            alwaysHttp200,
            statusCode: 500,
            generationId,
          });
        }
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
