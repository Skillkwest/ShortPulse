import { getSupabaseAdmin } from "../supabaseAdmin";

const QUEUE_TABLE = "ai_generation_submit_queue";

type JsonObject = Record<string, unknown>;

type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const toRpcErrorMessage = (error: RpcErrorLike): string => {
  const parts = [
    typeof error.code === "string" && error.code.trim().length ? `code=${error.code}` : null,
    typeof error.message === "string" && error.message.trim().length
      ? `message=${error.message}`
      : null,
    typeof error.details === "string" && error.details.trim().length
      ? `details=${error.details}`
      : null,
    typeof error.hint === "string" && error.hint.trim().length ? `hint=${error.hint}` : null,
  ].filter((value): value is string => Boolean(value));
  if (!parts.length) return "unknown queue claim error";
  return parts.join(" ");
};

export type GenerationQueueEnqueueResult = {
  status: "queued" | "already_queued" | "failed";
  generationId: string | null;
  sourceRef: string;
  queueStatus: "queued" | "dispatching" | "exhausted" | null;
  message: string | null;
};

export type ClaimedGenerationQueueItem = {
  queueId: string;
  generationId: string;
  userId: string;
  modelId: string;
  sourceRef: string;
  submitRoute: string;
  submitPayload: JsonObject;
  timeoutMs: number;
  attempts: number;
  status: "queued" | "dispatching" | "exhausted";
  nextAttemptAt: string | null;
  leaseUntil: string | null;
  createdAt: string | null;
};

export type QueueMutationOperation = "retry" | "exhaust" | "release" | "remove";

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

export type GenerationQueueStatus =
  | {
      status: "queued";
      generationId: string;
      sourceRef: string | null;
      retryAfterMs: number;
    }
  | {
      status: "dispatched";
      generationId: string;
      sourceRef: string | null;
      requestId: string;
      provider: string;
    }
  | {
      status: "failed";
      generationId: string;
      sourceRef: string | null;
      message: string;
    }
  | {
      status: "not_found";
    };

const asObject = (value: unknown): JsonObject | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonObject;
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asInteger = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const parseQueueStatus = (value: unknown): "queued" | "dispatching" | "exhausted" | null => {
  const normalized = asString(value)?.toLowerCase();
  if (normalized === "queued" || normalized === "dispatching" || normalized === "exhausted") {
    return normalized;
  }
  return null;
};

const toQueueMutationResult = ({
  operation,
  queueId,
  error,
  affectedCount,
}: {
  operation: QueueMutationOperation;
  queueId: string;
  error: { message?: string | null } | null;
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

const parseEnqueueRow = (value: unknown): GenerationQueueEnqueueResult => {
  const row = asObject(Array.isArray(value) ? value[0] : value);
  return {
    status:
      asString(row?.status) === "already_queued"
        ? "already_queued"
        : asString(row?.status) === "queued"
          ? "queued"
          : "failed",
    generationId: asString(row?.generation_id),
    sourceRef: asString(row?.source_ref) ?? "",
    queueStatus: parseQueueStatus(row?.queue_status),
    message: asString(row?.message),
  };
};

const parseClaimedQueueItem = (value: unknown): ClaimedGenerationQueueItem | null => {
  const row = asObject(value);
  if (!row) return null;
  const queueId = asString(row.queue_id);
  const generationId = asString(row.generation_id);
  const userId = asString(row.user_id);
  const modelId = asString(row.model_id);
  const sourceRef = asString(row.source_ref);
  const submitRoute = asString(row.submit_route) ?? "/api/fal/submit";
  const status = parseQueueStatus(row.status);
  if (!queueId || !generationId || !userId || !modelId || !sourceRef || !status) {
    return null;
  }
  return {
    queueId,
    generationId,
    userId,
    modelId,
    sourceRef,
    submitRoute,
    submitPayload: asObject(row.submit_payload) ?? {},
    timeoutMs: Math.max(1000, asInteger(row.timeout_ms, 20000)),
    attempts: Math.max(0, asInteger(row.attempts, 0)),
    status,
    nextAttemptAt: asString(row.next_attempt_at),
    leaseUntil: asString(row.lease_until),
    createdAt: asString(row.created_at),
  };
};

export const enqueueGenerationSubmit = async ({
  userId,
  sourceRef,
  modelId,
  promptText,
  mode,
  aspect,
  durationSeconds,
  resolution,
  submitRoute,
  submitPayload,
  timeoutMs,
  metadata,
}: {
  userId: string;
  sourceRef: string;
  modelId: string;
  promptText: string;
  mode: "image" | "video";
  aspect?: string | null;
  durationSeconds?: number | null;
  resolution?: string | null;
  submitRoute: string;
  submitPayload: JsonObject;
  timeoutMs: number;
  metadata?: JsonObject;
}): Promise<GenerationQueueEnqueueResult> => {
  const { data, error } = await getSupabaseAdmin().rpc("enqueue_generation_submit", {
    p_user_id: userId,
    p_source_ref: sourceRef,
    p_model_id: modelId,
    p_prompt_text: promptText,
    p_mode: mode,
    p_aspect: aspect ?? null,
    p_duration_seconds: durationSeconds ?? null,
    p_resolution: resolution ?? null,
    p_submit_route: submitRoute,
    p_submit_payload: submitPayload,
    p_timeout_ms: timeoutMs,
    p_metadata: metadata ?? {},
  });

  if (error) {
    return {
      status: "failed",
      generationId: null,
      sourceRef,
      queueStatus: null,
      message: error.message ?? "enqueue_failed",
    };
  }

  return parseEnqueueRow(data);
};

export const claimGenerationSubmitQueueBatch = async ({
  limit,
  leaseSeconds,
  userId,
}: {
  limit: number;
  leaseSeconds: number;
  userId?: string | null;
}): Promise<ClaimedGenerationQueueItem[]> => {
  const { data, error } = await getSupabaseAdmin().rpc("claim_generation_submit_queue_batch", {
    p_limit: Math.max(1, Math.trunc(limit)),
    p_lease_seconds: Math.max(1, Math.trunc(leaseSeconds)),
    p_user_id: userId ?? null,
  });
  if (error) {
    throw new Error(`claim_generation_submit_queue_batch failed: ${toRpcErrorMessage(error)}`);
  }
  if (!Array.isArray(data)) {
    throw new Error("claim_generation_submit_queue_batch failed: rpc returned non-array payload");
  }
  return data
    .map((row) => parseClaimedQueueItem(row))
    .filter((row): row is ClaimedGenerationQueueItem => Boolean(row));
};

export const countUserQueuedGenerationSubmits = async (userId: string): Promise<number> => {
  const { count } = await getSupabaseAdmin()
    .from(QUEUE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["queued", "dispatching"]);
  return Math.max(0, count ?? 0);
};

export const updateQueueItemForRetry = async ({
  queueId,
  attempts,
  nextAttemptAt,
  lastError,
  lastErrorCode,
}: {
  queueId: string;
  attempts: number;
  nextAttemptAt: string;
  lastError: string;
  lastErrorCode?: string | null;
}): Promise<QueueMutationResult> => {
  const { data, error } = await getSupabaseAdmin()
    .from(QUEUE_TABLE)
    .update({
      status: "queued",
      attempts,
      next_attempt_at: nextAttemptAt,
      lease_until: null,
      last_error: lastError,
      last_error_code: lastErrorCode ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueId)
    .select("id");
  return toQueueMutationResult({
    operation: "retry",
    queueId,
    error,
    affectedCount: Array.isArray(data) ? data.length : 0,
  });
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

export const releaseQueueLeaseBackToQueued = async ({
  queueId,
  nextAttemptAt,
}: {
  queueId: string;
  nextAttemptAt: string;
}): Promise<QueueMutationResult> => {
  const { data, error } = await getSupabaseAdmin()
    .from(QUEUE_TABLE)
    .update({
      status: "queued",
      next_attempt_at: nextAttemptAt,
      lease_until: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", queueId)
    .select("id");
  return toQueueMutationResult({
    operation: "release",
    queueId,
    error,
    affectedCount: Array.isArray(data) ? data.length : 0,
  });
};

export const removeQueueItem = async (queueId: string): Promise<QueueMutationResult> => {
  const { data, error } = await getSupabaseAdmin()
    .from(QUEUE_TABLE)
    .delete()
    .eq("id", queueId)
    .select("id");
  return toQueueMutationResult({
    operation: "remove",
    queueId,
    error,
    affectedCount: Array.isArray(data) ? data.length : 0,
  });
};

const readSourceRefFromGenerationMetadata = (metadata: unknown): string | null => {
  const object = asObject(metadata);
  return asString(object?.source_ref);
};

export const readGenerationQueueStatus = async ({
  userId,
  generationId,
  sourceRef,
}: {
  userId: string;
  generationId?: string | null;
  sourceRef?: string | null;
}): Promise<GenerationQueueStatus> => {
  if (!generationId && !sourceRef) {
    return { status: "not_found" };
  }

  const supabase = getSupabaseAdmin();
  let queueRow: JsonObject | null = null;

  if (generationId) {
    const { data } = await supabase
      .from(QUEUE_TABLE)
      .select("id, status, source_ref, generation_id, next_attempt_at")
      .eq("user_id", userId)
      .eq("generation_id", generationId)
      .maybeSingle();
    queueRow = asObject(data);
  }

  if (!queueRow && sourceRef) {
    const { data } = await supabase
      .from(QUEUE_TABLE)
      .select("id, status, source_ref, generation_id, next_attempt_at")
      .eq("user_id", userId)
      .eq("source_ref", sourceRef)
      .maybeSingle();
    queueRow = asObject(data);
  }

  let generationRow: JsonObject | null = null;
  if (generationId) {
    const { data } = await supabase
      .from("ai_generations")
      .select("id, status, request_id, provider, error_message, metadata")
      .eq("user_id", userId)
      .eq("id", generationId)
      .maybeSingle();
    generationRow = asObject(data);
  } else if (sourceRef) {
    const { data } = await supabase
      .from("ai_generations")
      .select("id, status, request_id, provider, error_message, metadata")
      .eq("user_id", userId)
      .contains("metadata", { source_ref: sourceRef })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    generationRow = asObject(data);
  }

  const resolvedGenerationId = asString(generationRow?.id) ?? asString(queueRow?.generation_id);
  const resolvedSourceRef =
    asString(queueRow?.source_ref) ??
    sourceRef ??
    readSourceRefFromGenerationMetadata(generationRow?.metadata);

  const requestId = asString(generationRow?.request_id);
  const generationStatus = asString(generationRow?.status)?.toLowerCase();

  if (requestId) {
    return {
      status: "dispatched",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRef ?? null,
      requestId,
      provider: asString(generationRow?.provider) ?? "fal",
    };
  }

  if (generationStatus === "fail") {
    return {
      status: "failed",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRef ?? null,
      message: asString(generationRow?.error_message) ?? "Generation failed before dispatch.",
    };
  }

  if (queueRow) {
    return {
      status: "queued",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRef ?? null,
      retryAfterMs: 2000,
    };
  }

  if (
    generationRow &&
    (generationStatus === "pending" ||
      generationStatus === "submitted" ||
      generationStatus === "running")
  ) {
    return {
      status: "queued",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRef ?? null,
      retryAfterMs: 2000,
    };
  }

  return { status: "not_found" };
};
