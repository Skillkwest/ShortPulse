import { buildShortPulseLifecycleHint } from "../falIntegration/statusProxyRuntime";
import { getSupabaseAdmin } from "./supabaseAdmin";
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

const areAllOutputsOwned = (rows: Array<{ mediaFileId: string | null }>): boolean =>
  rows.length > 0 && rows.every((row) => typeof row.mediaFileId === "string" && row.mediaFileId);

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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

export const buildPersistedFailedPayload = ({
  requestId,
  generationId,
  errorMessage,
  errorDetail,
  providerState,
  queueState,
}: {
  requestId: string;
  generationId?: string | null;
  errorMessage: string;
  errorDetail?: unknown;
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
      const deliveryState =
        projectionContext.publicationState === "published"
          ? "canonical_owned"
          : "transient_provider";
      return {
        generationId: projectionContext.generationId,
        resultUrls: projectionContext.resultUrls,
        status: projectionContext.status,
        taskState: "success",
        deliveryState,
        recoveryPending: false,
        completionState: null,
        queueState: normalizePersistedQueueState(projectionContext.queueState) ?? "dispatched",
        errorMessageShort: projectionContext.errorMessageShort,
        errorDetail: projectionContext.errorDetail,
        saveState: projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
        saveError: projectionContext.saveError,
      };
    }
    if (projectionContext?.generationId) {
      try {
        const projectedOutputRows = await readPersistedGenerationOutputs({
          generationId: projectionContext.generationId,
          userId,
          supabaseAdmin: adminClient,
        });
        if (projectedOutputRows.length) {
          const deliveryState = areAllOutputsOwned(projectedOutputRows)
            ? "canonical_owned"
            : "transient_provider";
          return {
            generationId: projectionContext.generationId,
            resultUrls: projectedOutputRows.map((row) => row.resultUrl),
            status: projectionContext.status,
            taskState: "success",
            deliveryState,
            recoveryPending: false,
            completionState: null,
            queueState: normalizePersistedQueueState(projectionContext.queueState) ?? "dispatched",
            errorMessageShort: projectionContext.errorMessageShort,
            errorDetail: projectionContext.errorDetail,
            saveState: projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
            saveError: projectionContext.saveError,
          };
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
        saveState: projectionContext.saveState as PersistedGenerationStatusContext["saveState"],
        saveError: projectionContext.saveError,
      };
    }

    const generationId = await readGenerationIdByRequestId({
      userId,
      requestId,
      supabaseAdmin: adminClient,
    }).catch(() => null);
    if (generationId) {
      const outputRows = await readPersistedGenerationOutputs({
        generationId,
        userId,
        supabaseAdmin: adminClient,
      }).catch(() => []);
      if (outputRows.length) {
        const deliveryState = areAllOutputsOwned(outputRows)
          ? "canonical_owned"
          : "transient_provider";
        const saveState = deliveryState === "canonical_owned" ? "saved" : "idle";
        return {
          generationId,
          resultUrls: outputRows.map((row) => row.resultUrl),
          status: "success",
          taskState: "success",
          deliveryState,
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
