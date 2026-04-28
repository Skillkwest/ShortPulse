import { getSupabaseAdmin } from "../supabaseAdmin";

const QUEUE_TABLE = "ai_generation_submit_queue";

export type QueueMutationOperation = "exhaust";

export type QueueMutationReason =
  | "applied"
  | "not_found"
  | "unexpected_affected_count"
  | "db_error";

export type QueueMutationResult = {
  ok: boolean;
  operation: QueueMutationOperation;
  queueId: string;
  affectedCount: number;
  reason: QueueMutationReason;
  errorMessage: string | null;
};

type DbErrorLike = {
  message?: string | null;
};

const toQueueMutationResult = ({
  operation,
  queueId,
  error,
  affectedCount,
}: {
  operation: QueueMutationOperation;
  queueId: string;
  error?: DbErrorLike | null;
  affectedCount: number;
}): QueueMutationResult => {
  if (error) {
    return {
      ok: false,
      operation,
      queueId,
      affectedCount,
      reason: "db_error",
      errorMessage: error.message ?? "queue mutation failed",
    };
  }
  if (affectedCount === 1) {
    return {
      ok: true,
      operation,
      queueId,
      affectedCount,
      reason: "applied",
      errorMessage: null,
    };
  }
  if (affectedCount === 0) {
    return {
      ok: false,
      operation,
      queueId,
      affectedCount,
      reason: "not_found",
      errorMessage: "queue row not found",
    };
  }
  return {
    ok: false,
    operation,
    queueId,
    affectedCount,
    reason: "unexpected_affected_count",
    errorMessage: `queue mutation affected ${affectedCount} rows`,
  };
};

export const markQueueItemExhausted = async ({
  queueId,
  attempts,
  lastError,
  lastErrorCode,
}: {
  queueId: string;
  attempts: number;
  lastError: string;
  lastErrorCode?: string | null;
}): Promise<QueueMutationResult> => {
  const { data, error } = await getSupabaseAdmin()
    .from(QUEUE_TABLE)
    .update({
      status: "exhausted",
      attempts,
      lease_until: null,
      last_error: lastError,
      last_error_code: lastErrorCode ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueId)
    .select("id");
  return toQueueMutationResult({
    operation: "exhaust",
    queueId,
    error,
    affectedCount: Array.isArray(data) ? data.length : 0,
  });
};
