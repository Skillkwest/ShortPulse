import { buildShortPulseLifecycleHint } from "../falIntegration/statusProxyRuntime";
import { isTrustedMediaDirectPreviewUrl } from "../../mediaPreviewTrustPolicy";
import { createSignedMediaUrl } from "../mediaIngest";
import { readMediaDeliveryPathsById } from "./mediaDeliveryPaths";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { resolveGenerationLineageByProviderRequest } from "./generationLineageResolver";
import { readGenerationProjectionStatusContext } from "./generationProjection";
import { readPersistedGenerationOutputs } from "./generationOutputs";

type PersistedResultsParams = {
  userId: string;
  requestId: string;
  supabaseAdmin?: ReturnType<typeof getSupabaseAdmin>;
};

export type PersistedGenerationStatusContext = {
  generationId: string | null;
  resultUrls: string[];
  saveState?: "idle" | "saving" | "saved" | "failed" | "blocked_storage" | null;
  saveError?: string | null;
  taskState?: string | null;
  status?: string | null;
  recoveryPending?: boolean;
  completionState?: "completed_awaiting_media" | null;
  deliveryState?: "transient_provider" | "canonical_owned" | null;
  queueState?: "queued" | "dispatching" | "dispatched" | "failed" | null;
  errorMessageShort?: string | null;
  errorDetail?: string | null;
  errorPayload?: unknown | null;
};

const isSuccessfulProjectionStatus = (value: string | null | undefined): boolean => {
  return value === "success" || value === "completed" || value === "complete" || value === "ready";
};

const normalizePersistedQueueState = (
  value: string | null | undefined
): PersistedGenerationStatusContext["queueState"] => {
  if (
    value === "queued" ||
    value === "dispatching" ||
    value === "dispatched" ||
    value === "failed"
  ) {
    return value;
  }
  return null;
};

const hasPendingTerminalVisibility = (metadata: unknown): boolean => {
  const record =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return (
    record.direct_terminal_visibility_state === "settlement_pending" ||
    record.recovery_visibility_state === "settlement_pending"
  );
};

export const buildPersistedCompletedPayload = ({
  requestId,
  resultUrls,
  generationId,
  saveState = null,
  saveError = null,
  deliveryState = "canonical_owned",
  recoveryPending = false,
  completionState = null,
  providerState = "completed",
}: {
  requestId: string;
  resultUrls: string[];
  generationId?: string | null;
  saveState?: PersistedGenerationStatusContext["saveState"];
  saveError?: string | null;
  deliveryState?: "transient_provider" | "canonical_owned";
  recoveryPending?: boolean;
  completionState?: "completed_awaiting_media" | null;
  providerState?: string | null;
}) => {
  const media = resultUrls.map((url) => ({ url }));
  return {
    request_id: requestId,
    ...(typeof generationId === "string" && generationId.trim().length > 0
      ? { generationId: generationId.trim() }
      : {}),
    ...(saveState ? { saveState } : {}),
    ...(saveError ? { saveError } : {}),
    status: "completed",
    state: "completed",
    resultUrls,
    result_urls: resultUrls,
    images: media,
    videos: media,
    data: {
      images: media,
      videos: media,
    },
    shortpulseLifecycle: buildShortPulseLifecycleHint({
      taskState: "success",
      isTerminal: true,
      resultUrls,
      saveState: saveState ?? undefined,
      saveError,
      providerState,
      recoveryPending,
      ...(completionState ? { completionState } : {}),
      deliveryState,
      queueState: "dispatched",
      statusLabel: "Just now",
    }),
  };
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const sanitizePersistedProjectionResultUrls = ({
  resultUrls,
  userId,
  deliveryState,
}: {
  resultUrls: string[];
  userId: string;
  deliveryState: "transient_provider" | "canonical_owned";
}): string[] => {
  if (!resultUrls.length) return [];
  if (deliveryState === "canonical_owned") {
    return resultUrls.filter((url) =>
      isTrustedMediaDirectPreviewUrl(url, { userId, requireUserScope: true })
    );
  }

  const trusted: string[] = [];
  const seen = new Set<string>();
  for (const rawUrl of resultUrls) {
    const url = rawUrl.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    trusted.push(url);
  }
  return trusted;
};

const readSafePersistedOutputResultUrls = async ({
  outputRows,
  userId,
  supabaseAdmin,
}: {
  outputRows: Array<{ resultUrl: string; mediaFileId: string | null; metadata: unknown }>;
  userId: string;
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
}): Promise<{
  resultUrls: string[];
  deliveryState: "transient_provider" | "canonical_owned";
  hasVisibilityPendingOutputs: boolean;
}> => {
  if (!outputRows.length) {
    return {
      resultUrls: [],
      deliveryState: "transient_provider",
      hasVisibilityPendingOutputs: false,
    };
  }

  const visibleOutputRows = outputRows.filter((row) => !hasPendingTerminalVisibility(row.metadata));
  const hasVisibilityPendingOutputs = visibleOutputRows.length < outputRows.length;

  const deliveryPathsByMediaId = await readMediaDeliveryPathsById({
    mediaFileIds: visibleOutputRows
      .map((row) => row.mediaFileId)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
    userId,
    supabaseAdmin,
  });
  const allOutputsOwned =
    visibleOutputRows.length > 0 &&
    visibleOutputRows.every(
      (row) => typeof row.mediaFileId === "string" && deliveryPathsByMediaId.has(row.mediaFileId)
    );
  const signedUrlByPath = new Map<string, string | null>();
  const resultUrls: string[] = [];
  let usedTransientProviderFallback = false;

  for (const row of visibleOutputRows) {
    const mediaFileId = asString(row.mediaFileId);
    if (mediaFileId) {
      const deliveryPaths = deliveryPathsByMediaId.get(mediaFileId);
      const fullStoragePath = asString(deliveryPaths?.fullStoragePath);
      if (fullStoragePath) {
        if (!signedUrlByPath.has(fullStoragePath)) {
          try {
            signedUrlByPath.set(fullStoragePath, await createSignedMediaUrl(fullStoragePath));
          } catch {
            signedUrlByPath.set(fullStoragePath, null);
          }
        }
        const signedUrl = signedUrlByPath.get(fullStoragePath);
        if (typeof signedUrl === "string" && signedUrl.length > 0) {
          resultUrls.push(signedUrl);
          continue;
        }
      }

      const trustedTransientUrls = sanitizePersistedProjectionResultUrls({
        resultUrls: [row.resultUrl],
        userId,
        deliveryState: "transient_provider",
      });
      if (trustedTransientUrls.length) {
        usedTransientProviderFallback = true;
        resultUrls.push(trustedTransientUrls[0]);
      }
      continue;
    }

    const trustedTransientUrls = sanitizePersistedProjectionResultUrls({
      resultUrls: [row.resultUrl],
      userId,
      deliveryState: "transient_provider",
    });
    if (trustedTransientUrls.length) {
      resultUrls.push(trustedTransientUrls[0]);
    }
  }

  return {
    resultUrls,
    deliveryState:
      allOutputsOwned && !usedTransientProviderFallback ? "canonical_owned" : "transient_provider",
    hasVisibilityPendingOutputs,
  };
};

const readGenerationIdByRequestId = async ({
  userId,
  requestId,
  supabaseAdmin,
}: {
  userId: string;
  requestId: string;
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
}): Promise<string | null> => {
  const { data, error } = await supabaseAdmin
    .from("ai_generations")
    .select("id, created_at")
    .eq("user_id", userId)
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !Array.isArray(data) || !data.length) return null;

  const row = data[0];
  if (!row || typeof row !== "object" || Array.isArray(row)) return null;
  return asString((row as Record<string, unknown>).id);
};

const readGenerationIdByLineage = async ({
  userId,
  requestId,
}: {
  userId: string;
  requestId: string;
}): Promise<string | null> => {
  const lineage = await resolveGenerationLineageByProviderRequest({
    providerRequestId: requestId,
    userId,
    includeProjection: true,
  }).catch(() => null);
  return asString(lineage?.generationId);
};

export const buildPersistedFailedPayload = ({
  requestId,
  generationId,
  errorMessage,
  errorDetail,
  errorPayload,
  providerState,
  queueState,
}: {
  requestId: string;
  generationId?: string | null;
  errorMessage: string;
  errorDetail?: unknown;
  errorPayload?: unknown;
  providerState?: string | null;
  queueState?: string | null;
}) => ({
  request_id: requestId,
  ...(typeof generationId === "string" && generationId.trim().length > 0
    ? { generationId: generationId.trim() }
    : {}),
  status: "error",
  state: "error",
  error: errorMessage,
  detail: errorDetail ?? errorMessage,
  ...(errorPayload !== undefined ? { errorPayload } : {}),
  shortpulseLifecycle: buildShortPulseLifecycleHint({
    taskState: "fail",
    isTerminal: true,
    errorMessage,
    errorDetail: errorDetail ?? errorMessage,
    providerState: providerState ?? "failed",
    queueState: normalizePersistedQueueState(queueState) ?? "failed",
  }),
});

export const readPersistedGenerationStatusContext = async ({
  userId,
  requestId,
  supabaseAdmin,
}: PersistedResultsParams): Promise<PersistedGenerationStatusContext> => {
  let adminClient = supabaseAdmin;
  if (!adminClient) {
    try {
      adminClient = getSupabaseAdmin();
    } catch {
      return { generationId: null, resultUrls: [] };
    }
  }

  try {
    const projectionContext = await readGenerationProjectionStatusContext({
      userId,
      requestId,
      supabaseAdmin: adminClient,
    }).catch(() => null);
    if (projectionContext?.resultUrls.length) {
      const projectionDeliveryState: "transient_provider" | "canonical_owned" =
        projectionContext.publicationState === "published"
          ? "canonical_owned"
          : "transient_provider";
      if (projectionContext.generationId) {
        try {
          const projectedOutputRows = await readPersistedGenerationOutputs({
            generationId: projectionContext.generationId,
            userId,
            supabaseAdmin: adminClient,
          });
          if (projectedOutputRows.length) {
            const safeOutputUrls = await readSafePersistedOutputResultUrls({
              outputRows: projectedOutputRows,
              userId,
              supabaseAdmin: adminClient,
            });
            if (safeOutputUrls.hasVisibilityPendingOutputs) {
              return {
                generationId: projectionContext.generationId,
                resultUrls: [],
                status: projectionContext.status,
                taskState: projectionContext.taskState,
                recoveryPending: true,
                completionState: null,
                queueState: normalizePersistedQueueState(projectionContext.queueState),
                errorMessageShort: projectionContext.errorMessageShort,
                errorDetail: projectionContext.errorDetail,
                errorPayload: projectionContext.errorPayload,
                saveState:
                  projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
                saveError: projectionContext.saveError,
              };
            }
            if (safeOutputUrls.resultUrls.length) {
              return {
                generationId: projectionContext.generationId,
                resultUrls: safeOutputUrls.resultUrls,
                status: projectionContext.status,
                taskState: "success",
                deliveryState: safeOutputUrls.deliveryState,
                recoveryPending: false,
                completionState: null,
                queueState:
                  normalizePersistedQueueState(projectionContext.queueState) ?? "dispatched",
                errorMessageShort: projectionContext.errorMessageShort,
                errorDetail: projectionContext.errorDetail,
                errorPayload: projectionContext.errorPayload,
                saveState:
                  projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
                saveError: projectionContext.saveError,
              };
            }
          }
        } catch {
          // Fall back to sanitized projection context below.
        }
      }
      const safeProjectionUrls = sanitizePersistedProjectionResultUrls({
        resultUrls: projectionContext.resultUrls,
        userId,
        deliveryState: projectionDeliveryState,
      });
      if (safeProjectionUrls.length) {
        return {
          generationId: projectionContext.generationId,
          resultUrls: safeProjectionUrls,
          status: projectionContext.status,
          taskState: projectionContext.taskState ?? "success",
          deliveryState: projectionDeliveryState,
          recoveryPending: false,
          completionState: null,
          queueState: normalizePersistedQueueState(projectionContext.queueState) ?? "dispatched",
          errorMessageShort: projectionContext.errorMessageShort,
          errorDetail: projectionContext.errorDetail,
          errorPayload: projectionContext.errorPayload,
          saveState: projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
          saveError: projectionContext.saveError,
        };
      }
    }
    if (projectionContext?.generationId) {
      try {
        const projectedOutputRows = await readPersistedGenerationOutputs({
          generationId: projectionContext.generationId,
          userId,
          supabaseAdmin: adminClient,
        });
        if (projectedOutputRows.length) {
          const safeOutputUrls = await readSafePersistedOutputResultUrls({
            outputRows: projectedOutputRows,
            userId,
            supabaseAdmin: adminClient,
          });
          if (safeOutputUrls.hasVisibilityPendingOutputs) {
            return {
              generationId: projectionContext.generationId,
              resultUrls: [],
              status: projectionContext.status,
              taskState: projectionContext.taskState,
              recoveryPending: true,
              completionState: null,
              queueState: normalizePersistedQueueState(projectionContext.queueState),
              errorMessageShort: projectionContext.errorMessageShort,
              errorDetail: projectionContext.errorDetail,
              errorPayload: projectionContext.errorPayload,
              saveState:
                projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
              saveError: projectionContext.saveError,
            };
          }
          if (safeOutputUrls.resultUrls.length) {
            return {
              generationId: projectionContext.generationId,
              resultUrls: safeOutputUrls.resultUrls,
              status: projectionContext.status,
              taskState: "success",
              deliveryState: safeOutputUrls.deliveryState,
              recoveryPending: false,
              completionState: null,
              queueState:
                normalizePersistedQueueState(projectionContext.queueState) ?? "dispatched",
              errorMessageShort: projectionContext.errorMessageShort,
              errorDetail: projectionContext.errorDetail,
              errorPayload: projectionContext.errorPayload,
              saveState:
                projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
              saveError: projectionContext.saveError,
            };
          }
        }
      } catch {
        return { generationId: projectionContext.generationId, resultUrls: [] };
      }
    }
    if (projectionContext?.taskState === "fail") {
      return {
        generationId: projectionContext.generationId,
        resultUrls: [],
        status: projectionContext.status,
        taskState: projectionContext.taskState,
        queueState: normalizePersistedQueueState(projectionContext.queueState),
        errorMessageShort: projectionContext.errorMessageShort,
        errorDetail: projectionContext.errorDetail,
        errorPayload: projectionContext.errorPayload,
        saveState: projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
        saveError: projectionContext.saveError,
      };
    }
    if (
      projectionContext &&
      (projectionContext.taskState === "success" ||
        isSuccessfulProjectionStatus(projectionContext.status))
    ) {
      return {
        generationId: projectionContext.generationId,
        resultUrls: [],
        status: projectionContext.status,
        taskState: "success",
        recoveryPending: true,
        completionState: "completed_awaiting_media",
        queueState: normalizePersistedQueueState(projectionContext.queueState) ?? "dispatched",
        errorMessageShort: projectionContext.errorMessageShort,
        errorDetail: projectionContext.errorDetail,
        errorPayload: projectionContext.errorPayload,
        saveState: projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
        saveError: projectionContext.saveError,
      };
    }
    if (projectionContext?.generationId) {
      return {
        generationId: projectionContext.generationId,
        resultUrls: [],
        status: projectionContext.status,
        taskState: projectionContext.taskState,
        queueState: normalizePersistedQueueState(projectionContext.queueState),
        errorMessageShort: projectionContext.errorMessageShort,
        errorDetail: projectionContext.errorDetail,
        errorPayload: projectionContext.errorPayload,
        saveState: projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
        saveError: projectionContext.saveError,
      };
    }

    const generationId =
      (await readGenerationIdByLineage({
        userId,
        requestId,
      })) ??
      (await readGenerationIdByRequestId({
        userId,
        requestId,
        supabaseAdmin: adminClient,
      }).catch(() => null));
    if (generationId) {
      const outputRows = await readPersistedGenerationOutputs({
        generationId,
        userId,
        supabaseAdmin: adminClient,
      }).catch(() => []);
      if (outputRows.length) {
        const safeOutputUrls = await readSafePersistedOutputResultUrls({
          outputRows,
          userId,
          supabaseAdmin: adminClient,
        });
        if (safeOutputUrls.hasVisibilityPendingOutputs) {
          return {
            generationId,
            resultUrls: [],
            recoveryPending: true,
            completionState: null,
          };
        }
        const saveState = safeOutputUrls.deliveryState === "canonical_owned" ? "saved" : "idle";
        return {
          generationId,
          resultUrls: safeOutputUrls.resultUrls,
          status: "success",
          taskState: "success",
          deliveryState: safeOutputUrls.deliveryState,
          recoveryPending: false,
          completionState: null,
          queueState: "dispatched",
          saveState,
          saveError: null,
        };
      }
      return {
        generationId,
        resultUrls: [],
      };
    }

    return { generationId: null, resultUrls: [] };
  } catch {
    return { generationId: null, resultUrls: [] };
  }
};

export const readPersistedSuccessResultUrls = async ({
  userId,
  requestId,
  supabaseAdmin,
}: PersistedResultsParams): Promise<string[]> => {
  const context = await readPersistedGenerationStatusContext({
    userId,
    requestId,
    supabaseAdmin,
  });
  return context.resultUrls;
};
