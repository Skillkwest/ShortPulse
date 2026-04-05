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
  taskState?: string | null;
  status?: string | null;
  queueState?: "queued" | "dispatching" | "dispatched" | "failed" | null;
  errorMessageShort?: string | null;
  errorDetail?: string | null;
};

const isSuccessfulProjectionStatus = (value: string | null | undefined): boolean => {
  return value === "success" || value === "completed" || value === "complete" || value === "ready";
};

const asOptionalString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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
}: {
  requestId: string;
  resultUrls: string[];
  generationId?: string | null;
}) => ({
  request_id: requestId,
  ...(typeof generationId === "string" && generationId.trim().length > 0
    ? { generationId: generationId.trim() }
    : {}),
  status: "completed",
  state: "completed",
  resultUrls,
  result_urls: resultUrls,
  videos: resultUrls.map((url) => ({ url })),
  shortpulseLifecycle: buildShortPulseLifecycleHint({
    taskState: "success",
    isTerminal: true,
    resultUrls,
    providerState: "completed",
    queueState: "dispatched",
    statusLabel: "Just now",
  }),
});

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
      return {
        generationId: projectionContext.generationId,
        resultUrls: projectionContext.resultUrls,
        status: projectionContext.status,
        taskState: "success",
        queueState: normalizePersistedQueueState(projectionContext.queueState) ?? "dispatched",
        errorMessageShort: projectionContext.errorMessageShort,
        errorDetail: projectionContext.errorDetail,
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
          return {
            generationId: projectionContext.generationId,
            resultUrls: projectedOutputRows.map((row) => row.resultUrl),
            status: projectionContext.status,
            taskState: "success",
            queueState: normalizePersistedQueueState(projectionContext.queueState) ?? "dispatched",
            errorMessageShort: projectionContext.errorMessageShort,
            errorDetail: projectionContext.errorDetail,
          };
        }
      } catch {
        // fall through to compatibility reads if canonical output lookup fails
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
        queueState: normalizePersistedQueueState(projectionContext.queueState) ?? "dispatched",
        errorMessageShort: projectionContext.errorMessageShort,
        errorDetail: projectionContext.errorDetail,
      };
    }

    const { data, error } = await adminClient
      .from("ai_generations")
      .select("id, status, error_message, created_at")
      .eq("user_id", userId)
      .eq("request_id", requestId)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error || !Array.isArray(data) || !data.length) {
      return { generationId: null, resultUrls: [] };
    }

    // Compatibility-only fallback: ai_generations can still provide generation ids,
    // canonical output linkage, and legacy terminal failures until projection coverage is complete.
    let latestGenerationId: string | null = null;
    let latestFailedContext: PersistedGenerationStatusContext | null = null;
    let rowIndex = 0;
    for (const item of data) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      const generationId = asOptionalString(row.id);
      const status = typeof row.status === "string" ? row.status.trim().toLowerCase() : null;
      const errorMessage = asOptionalString(row.error_message);
      const isLatestRow = rowIndex === 0;
      rowIndex += 1;
      if (!latestGenerationId && generationId) {
        latestGenerationId = generationId;
      }
      if (generationId) {
        try {
          const outputRows = await readPersistedGenerationOutputs({
            generationId,
            userId,
            supabaseAdmin: adminClient,
          });
          if (outputRows.length) {
            return {
              generationId,
              resultUrls: outputRows.map((row) => row.resultUrl),
              status,
              taskState: "success",
              queueState: "dispatched",
              errorMessageShort: null,
              errorDetail: null,
            };
          }
        } catch {
          // fall back to compatibility metadata when canonical output reads fail
        }
      }
      if (
        isLatestRow &&
        !latestFailedContext &&
        (status === "fail" ||
          status === "failed" ||
          status === "error" ||
          status === "cancelled" ||
          status === "canceled")
      ) {
        latestFailedContext = {
          generationId,
          resultUrls: [],
          status,
          taskState: "fail",
          queueState: "failed",
          errorMessageShort: errorMessage ?? "Generation failed",
          errorDetail: errorMessage ?? "Generation failed",
        };
      }
    }
    if (latestFailedContext) return latestFailedContext;
    return { generationId: latestGenerationId, resultUrls: [] };
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
