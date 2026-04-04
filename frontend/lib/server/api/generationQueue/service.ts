import { getSupabaseAdmin } from "../supabaseAdmin";
import { lookupLatestGenerationAttempt } from "../generationAttempts";
import { isMissingGenerationAttemptSchemaError } from "../generationBilling/errorGuards";
import {
  readGenerationProjectionLinkBySourceRef,
  readGenerationProjectionQueueContext,
} from "../generationProjection";

const QUEUE_TABLE = "ai_generation_submit_queue";

type JsonObject = Record<string, unknown>;

type RpcErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const CLAIM_COLLISION_RETRY_LIMIT = 1;
const CLAIM_COLLISION_RETRY_BASE_MS = 40;
const CLAIM_COLLISION_RETRY_JITTER_FACTOR = 0.25;

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

const isQueueClaimCollisionError = (error: RpcErrorLike): boolean => {
  const code = String(error.code ?? "").trim();
  const message = String(error.message ?? "");
  const details = String(error.details ?? "");
  const combined = `${message} ${details}`;
  return (
    code === "23505" &&
    /ux_ai_generation_submit_queue_dispatching_user|duplicate key value/i.test(combined)
  );
};

const resolveClaimCollisionRetryDelayMs = (): number => {
  const jitterWindow = Math.max(
    1,
    Math.round(CLAIM_COLLISION_RETRY_BASE_MS * CLAIM_COLLISION_RETRY_JITTER_FACTOR)
  );
  const jitterOffset = Math.round((Math.random() * 2 - 1) * jitterWindow);
  return Math.max(1, CLAIM_COLLISION_RETRY_BASE_MS + jitterOffset);
};

const waitForClaimCollisionRetry = async (delayMs: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
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
  generationProvider: string | null;
  generationRequestId: string | null;
  generationMetadata: JsonObject;
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

export type QueueDispatchCommitStage =
  | "reservation_submitted"
  | "generation_mark_running"
  | "generation_attempt_recorded"
  | "generation_attempt_running"
  | "queue_remove"
  | "post_submit_commit"
  | "rpc";

export type QueueDispatchCommitResult =
  | {
      ok: true;
      status: "committed";
      stage: "post_submit_commit";
      code: null;
      sourceRef: string | null;
      attemptId: string | null;
      attemptNumber: number | null;
      message: null;
    }
  | {
      ok: false;
      status: "failed";
      stage: QueueDispatchCommitStage;
      code: string | null;
      sourceRef: string | null;
      attemptId: string | null;
      attemptNumber: number | null;
      message: string | null;
    };

export type GenerationQueueStatus =
  | {
      status: "queued";
      generationId: string;
      sourceRef: string | null;
      retryAfterMs: number;
      shortpulseLifecycle: {
        taskState: "pending";
        queueState: "queued";
        isTerminal: false;
        statusLabel?: string;
      };
    }
  | {
      status: "dispatching";
      generationId: string;
      sourceRef: string | null;
      retryAfterMs: number;
      shortpulseLifecycle: {
        taskState: "running";
        queueState: "dispatching";
        isTerminal: false;
        statusLabel?: string;
      };
    }
  | {
      status: "dispatched";
      generationId: string;
      sourceRef: string | null;
      requestId: string;
      provider: string;
      modelId?: string | null;
      pollingProvider?: string | null;
      shortpulseLifecycle: {
        taskState: "running";
        queueState: "dispatched";
        isTerminal: false;
        statusLabel?: string;
      };
    }
  | {
      status: "failed";
      generationId: string;
      sourceRef: string | null;
      message: string;
      shortpulseLifecycle: {
        taskState: "fail";
        queueState: "failed";
        isTerminal: true;
        errorMessage: string;
        statusLabel?: string | null;
      };
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

const parseQueueDispatchCommitStage = (value: unknown): QueueDispatchCommitStage => {
  const normalized = asString(value)?.toLowerCase();
  switch (normalized) {
    case "reservation_submitted":
    case "generation_mark_running":
    case "generation_attempt_recorded":
    case "generation_attempt_running":
    case "queue_remove":
    case "post_submit_commit":
      return normalized;
    default:
      return "rpc";
  }
};

const parseQueueDispatchCommitResult = (value: unknown): QueueDispatchCommitResult => {
  const row = asObject(Array.isArray(value) ? value[0] : value);
  const status = asString(row?.status)?.toLowerCase();
  const stage = parseQueueDispatchCommitStage(row?.stage);
  const code = asString(row?.code);
  const sourceRef = asString(row?.source_ref);
  const attemptId = asString(row?.attempt_id);
  const attemptNumber = asInteger(row?.attempt_number, Number.NaN);
  const normalizedAttemptNumber = Number.isNaN(attemptNumber) ? null : attemptNumber;
  const message = asString(row?.message);

  if (status === "committed") {
    return {
      ok: true,
      status: "committed",
      stage: "post_submit_commit",
      code: null,
      sourceRef,
      attemptId,
      attemptNumber: normalizedAttemptNumber,
      message: null,
    };
  }

  return {
    ok: false,
    status: "failed",
    stage,
    code,
    sourceRef,
    attemptId,
    attemptNumber: normalizedAttemptNumber,
    message,
  };
};

const normalizeProviderToken = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized.length) return null;
  if (normalized.startsWith("fal")) {
    if (
      normalized.includes("kling-3") ||
      normalized.includes("kling_v3") ||
      normalized.includes("kling-video/v3")
    ) {
      return "fal-kling-3";
    }
    if (normalized.includes("kling")) return "fal-kling";
    if (normalized.includes("seedance") && normalized.includes("i2v")) return "fal-seedance-i2v";
    if (normalized.includes("seedance")) return "fal-seedance";
    if (normalized.includes("sora")) return "fal-sora";
    if (normalized.includes("seedream")) return "fal-seedream";
    if (normalized.includes("veo") && normalized.includes("i2v")) return "fal-veo-i2v";
    if (normalized.includes("veo")) return "fal-veo";
    if (normalized.includes("nano-banana-pro") && normalized.includes("edit")) {
      return "fal-nano-banana-pro-edit";
    }
    if (normalized.includes("nano-banana-pro")) return "fal-nano-banana-pro";
    if (normalized.includes("nano-banana-2") && normalized.includes("edit")) {
      return "fal-nano-banana-2-edit";
    }
    if (normalized.includes("nano-banana-2")) return "fal-nano-banana-2";
    if (normalized.includes("nano-banana") && normalized.includes("edit")) {
      return "fal-nano-banana-edit";
    }
    if (normalized.includes("nano-banana")) return "fal-nano-banana";
    if (normalized.includes("flux-pro") && normalized.includes("fill")) return "fal-flux-pro-fill";
    if (
      normalized.includes("bria") &&
      normalized.includes("background") &&
      normalized.includes("remove")
    ) {
      return "fal-bria-background-remove";
    }
    if (normalized.includes("flux-2-pro") && normalized.includes("edit")) {
      return "fal-flux2-pro-edit";
    }
    if (normalized.includes("flux-2-pro")) return "fal-flux2-pro";
    if (normalized.includes("flux-2") && normalized.includes("klein")) return "fal-flux2-klein";
    if (normalized.includes("flux-2") && normalized.includes("edit")) return "fal-flux2-edit";
    if (normalized.includes("flux-2")) return "fal-flux2";
    return "fal";
  }
  if (normalized.startsWith("kie")) {
    return normalized.includes("kling") ? "kie-kling" : "kie-veo";
  }
  return null;
};

const resolveQueuePollingProvider = ({
  provider,
  modelId,
}: {
  provider: string | null | undefined;
  modelId?: string | null;
}): string | null => {
  const normalizedProvider = normalizeProviderToken(provider);
  const modelScopedProvider = normalizeProviderToken(modelId);
  if (normalizedProvider === "fal" || normalizedProvider === "kie-veo") {
    return modelScopedProvider ?? normalizedProvider;
  }
  return normalizedProvider ?? modelScopedProvider;
};
const QUEUE_STATUS_QUEUED_RETRY_MS = 2000;
const QUEUE_STATUS_DISPATCHING_RETRY_MS = 1000;
const QUEUE_STATUS_PRE_DISPATCH_RETRY_MS = 3000;

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
    generationProvider: asString(row.generation_provider),
    generationRequestId: asString(row.generation_request_id),
    generationMetadata: asObject(row.generation_metadata) ?? {},
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
  provider,
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
  provider: string;
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
    p_provider: provider,
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
  const rpcParams = {
    p_limit: Math.max(1, Math.trunc(limit)),
    p_lease_seconds: Math.max(1, Math.trunc(leaseSeconds)),
    p_user_id: userId ?? null,
  };

  for (let attempt = 0; attempt <= CLAIM_COLLISION_RETRY_LIMIT; attempt += 1) {
    const { data, error } = await getSupabaseAdmin().rpc(
      "claim_generation_submit_queue_batch",
      rpcParams
    );
    if (!error) {
      if (!Array.isArray(data)) {
        throw new Error(
          "claim_generation_submit_queue_batch failed: rpc returned non-array payload"
        );
      }
      return data
        .map((row) => parseClaimedQueueItem(row))
        .filter((row): row is ClaimedGenerationQueueItem => Boolean(row));
    }
    if (attempt < CLAIM_COLLISION_RETRY_LIMIT && isQueueClaimCollisionError(error)) {
      await waitForClaimCollisionRetry(resolveClaimCollisionRetryDelayMs());
      continue;
    }
    throw new Error(`claim_generation_submit_queue_batch failed: ${toRpcErrorMessage(error)}`);
  }

  throw new Error("claim_generation_submit_queue_batch failed: collision retry loop exhausted");
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

export const commitQueuedGenerationDispatchSuccess = async ({
  userId,
  queueId,
  generationId,
  sourceRef,
  provider,
  modelId,
  providerRequestId,
  nextRecoveryAtIso,
  generationMetadata,
  attemptMetadata,
  submitRoute,
  observedAt,
}: {
  userId: string;
  queueId: string;
  generationId: string;
  sourceRef: string;
  provider: string;
  modelId: string;
  providerRequestId: string;
  nextRecoveryAtIso: string;
  generationMetadata: JsonObject;
  attemptMetadata: JsonObject;
  submitRoute?: string | null;
  observedAt: string;
}): Promise<QueueDispatchCommitResult> => {
  const { data, error } = await getSupabaseAdmin().rpc(
    "commit_generation_submit_queue_dispatch_success",
    {
      p_user_id: userId,
      p_queue_id: queueId,
      p_generation_id: generationId,
      p_source_ref: sourceRef,
      p_provider: provider,
      p_model_id: modelId,
      p_provider_request_id: providerRequestId,
      p_next_recovery_at: nextRecoveryAtIso,
      p_generation_metadata: generationMetadata,
      p_attempt_metadata: attemptMetadata,
      p_dispatch_source: "queued_submit",
      p_submit_route: submitRoute ?? null,
      p_observed_at: observedAt,
    }
  );

  if (error) {
    return {
      ok: false,
      status: "failed",
      stage: "rpc",
      code: "POST_SUBMIT_COMMIT_RPC_FAILED",
      sourceRef,
      attemptId: null,
      attemptNumber: null,
      message: toRpcErrorMessage(error),
    };
  }

  return parseQueueDispatchCommitResult(data);
};

const readSourceRefFromGenerationMetadata = (metadata: unknown): string | null => {
  const object = asObject(metadata);
  return asString(object?.source_ref);
};

const readLegacyGenerationQueueFallback = async ({
  supabase,
  userId,
  generationId,
  sourceRef,
}: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string;
  generationId?: string | null;
  sourceRef?: string | null;
}): Promise<JsonObject | null> => {
  if (generationId) {
    const { data } = await supabase
      .from("ai_generations")
      .select("id, status, request_id, provider, model_id, error_message, metadata")
      .eq("user_id", userId)
      .eq("id", generationId)
      .maybeSingle();
    return asObject(data);
  }
  if (sourceRef) {
    const { data } = await supabase
      .from("ai_generations")
      .select("id, status, request_id, provider, model_id, error_message, metadata")
      .eq("user_id", userId)
      .contains("metadata", { source_ref: sourceRef })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return asObject(data);
  }
  return null;
};

const readAttemptRequestIdForGeneration = async ({
  userId,
  generationId,
}: {
  userId: string;
  generationId: string | null;
}): Promise<string | null> => {
  if (!generationId) return null;
  const lookup = await lookupLatestGenerationAttempt({
    userId,
    generationId,
  });
  if (lookup.error) {
    if (
      isMissingGenerationAttemptSchemaError(
        lookup.error.code ?? null,
        lookup.error.message ?? undefined
      )
    ) {
      return null;
    }
    throw new Error(lookup.error.message ?? "attempt_generation_lookup_failed");
  }
  return asString(lookup.data?.providerRequestId);
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
      .select("id, status, source_ref, generation_id, next_attempt_at, last_error, last_error_code")
      .eq("user_id", userId)
      .eq("generation_id", generationId)
      .maybeSingle();
    queueRow = asObject(data);
  }

  if (!queueRow && sourceRef) {
    const { data } = await supabase
      .from(QUEUE_TABLE)
      .select("id, status, source_ref, generation_id, next_attempt_at, last_error, last_error_code")
      .eq("user_id", userId)
      .eq("source_ref", sourceRef)
      .maybeSingle();
    queueRow = asObject(data);
  }

  let resolvedGenerationId = asString(queueRow?.generation_id) ?? generationId ?? null;
  if (!resolvedGenerationId && sourceRef) {
    const projectionLink = await readGenerationProjectionLinkBySourceRef({
      userId,
      sourceRef,
      supabaseAdmin: supabase,
    }).catch(() => null);
    resolvedGenerationId = projectionLink?.generationId ?? null;
  }

  const projectionContext = resolvedGenerationId
    ? await readGenerationProjectionQueueContext({
        userId,
        generationId: resolvedGenerationId,
        supabaseAdmin: supabase,
      }).catch(() => null)
    : null;
  let legacyProjectionFallbackRow: JsonObject | null = null;
  let projectionOnlySourceRef =
    projectionContext?.sourceRef ?? asString(queueRow?.source_ref) ?? sourceRef ?? null;
  if (!projectionOnlySourceRef && resolvedGenerationId) {
    legacyProjectionFallbackRow = await readLegacyGenerationQueueFallback({
      supabase,
      userId,
      generationId: resolvedGenerationId,
    });
    projectionOnlySourceRef = readSourceRefFromGenerationMetadata(
      legacyProjectionFallbackRow?.metadata
    );
  }
  const projectionOnlyRequestId =
    projectionContext?.requestId ?? projectionContext?.providerRequestId ?? null;
  const projectionOnlyStatus =
    projectionContext?.taskState?.toLowerCase() ?? projectionContext?.status?.toLowerCase() ?? null;
  const projectionQueueState = asString(projectionContext?.queueState)?.toLowerCase();

  if (projectionOnlyRequestId) {
    const pollingProvider = resolveQueuePollingProvider({
      provider: projectionContext?.provider ?? "fal",
      modelId: projectionContext?.modelId,
    });
    return {
      status: "dispatched",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: projectionOnlySourceRef,
      requestId: projectionOnlyRequestId,
      provider: projectionContext?.provider ?? "fal",
      ...(projectionContext?.modelId ? { modelId: projectionContext.modelId } : {}),
      ...(pollingProvider ? { pollingProvider } : {}),
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatched",
        isTerminal: false,
        statusLabel: "Submitted",
      },
    };
  }

  if (projectionOnlyStatus === "fail") {
    const message =
      projectionContext?.errorMessageShort ??
      projectionContext?.errorDetail ??
      "Generation failed before dispatch.";
    return {
      status: "failed",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: projectionOnlySourceRef,
      message,
      shortpulseLifecycle: {
        taskState: "fail",
        queueState: "failed",
        isTerminal: true,
        errorMessage: message,
        statusLabel: null,
      },
    };
  }

  if (projectionQueueState === "dispatching") {
    return {
      status: "dispatching",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: projectionOnlySourceRef,
      retryAfterMs: QUEUE_STATUS_DISPATCHING_RETRY_MS,
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatching",
        isTerminal: false,
        statusLabel: "Dispatching...",
      },
    };
  }

  if (projectionQueueState === "queued") {
    return {
      status: "queued",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: projectionOnlySourceRef,
      retryAfterMs: QUEUE_STATUS_QUEUED_RETRY_MS,
      shortpulseLifecycle: {
        taskState: "pending",
        queueState: "queued",
        isTerminal: false,
        statusLabel: "Waiting in queue...",
      },
    };
  }

  const resolvedSourceRef =
    projectionContext?.sourceRef ??
    asString(queueRow?.source_ref) ??
    sourceRef ??
    readSourceRefFromGenerationMetadata(legacyProjectionFallbackRow?.metadata);
  const queueStatus = parseQueueStatus(queueRow?.status);
  if (queueStatus === "queued") {
    return {
      status: "queued",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRef ?? null,
      retryAfterMs: QUEUE_STATUS_QUEUED_RETRY_MS,
      shortpulseLifecycle: {
        taskState: "pending",
        queueState: "queued",
        isTerminal: false,
        statusLabel: "Waiting in queue...",
      },
    };
  }

  if (queueStatus === "dispatching") {
    return {
      status: "dispatching",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRef ?? null,
      retryAfterMs: QUEUE_STATUS_DISPATCHING_RETRY_MS,
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatching",
        isTerminal: false,
        statusLabel: "Dispatching...",
      },
    };
  }

  if (queueStatus === "exhausted") {
    const queueError =
      asString(queueRow?.last_error) ??
      projectionContext?.errorMessageShort ??
      projectionContext?.errorDetail ??
      "Generation failed before dispatch.";
    return {
      status: "failed",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRef ?? null,
      message: queueError,
      shortpulseLifecycle: {
        taskState: "fail",
        queueState: "failed",
        isTerminal: true,
        errorMessage: queueError,
        statusLabel: null,
      },
    };
  }

  let generationRow: JsonObject | null =
    legacyProjectionFallbackRow && resolvedGenerationId ? legacyProjectionFallbackRow : null;
  if (!generationRow) {
    generationRow = await readLegacyGenerationQueueFallback({
      supabase,
      userId,
      generationId: generationId ?? resolvedGenerationId,
      sourceRef,
    });
  }

  resolvedGenerationId = asString(generationRow?.id) ?? resolvedGenerationId;
  const resolvedSourceRefWithLegacyFallback =
    resolvedSourceRef ?? readSourceRefFromGenerationMetadata(generationRow?.metadata);

  const requestId =
    projectionContext?.requestId ??
    projectionContext?.providerRequestId ??
    asString(generationRow?.request_id) ??
    (await readAttemptRequestIdForGeneration({
      userId,
      generationId: resolvedGenerationId,
    }));
  const generationStatus = projectionOnlyStatus ?? asString(generationRow?.status)?.toLowerCase();

  if (requestId) {
    const dispatchedModelId = projectionContext?.modelId ?? asString(generationRow?.model_id);
    const dispatchedProvider =
      projectionContext?.provider ?? asString(generationRow?.provider) ?? "fal";
    const pollingProvider = resolveQueuePollingProvider({
      provider: dispatchedProvider,
      modelId: dispatchedModelId,
    });
    return {
      status: "dispatched",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRefWithLegacyFallback ?? null,
      requestId,
      provider: dispatchedProvider,
      ...(dispatchedModelId ? { modelId: dispatchedModelId } : {}),
      ...(pollingProvider ? { pollingProvider } : {}),
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatched",
        isTerminal: false,
        statusLabel: "Submitted",
      },
    };
  }

  if (generationStatus === "fail") {
    const message =
      projectionContext?.errorMessageShort ??
      projectionContext?.errorDetail ??
      asString(generationRow?.error_message) ??
      "Generation failed before dispatch.";
    return {
      status: "failed",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRefWithLegacyFallback ?? null,
      message,
      shortpulseLifecycle: {
        taskState: "fail",
        queueState: "failed",
        isTerminal: true,
        errorMessage: message,
        statusLabel: null,
      },
    };
  }

  if (queueStatus === "exhausted") {
    const queueError =
      asString(queueRow?.last_error) ??
      asString(generationRow?.error_message) ??
      "Generation failed before dispatch.";
    return {
      status: "failed",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRefWithLegacyFallback ?? null,
      message: queueError,
      shortpulseLifecycle: {
        taskState: "fail",
        queueState: "failed",
        isTerminal: true,
        errorMessage: queueError,
        statusLabel: null,
      },
    };
  }

  if (queueStatus === "queued") {
    return {
      status: "queued",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRefWithLegacyFallback ?? null,
      retryAfterMs: QUEUE_STATUS_QUEUED_RETRY_MS,
      shortpulseLifecycle: {
        taskState: "pending",
        queueState: "queued",
        isTerminal: false,
        statusLabel: "Waiting in queue...",
      },
    };
  }

  if (queueStatus === "dispatching") {
    return {
      status: "dispatching",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRefWithLegacyFallback ?? null,
      retryAfterMs: QUEUE_STATUS_DISPATCHING_RETRY_MS,
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatching",
        isTerminal: false,
        statusLabel: "Dispatching...",
      },
    };
  }

  if (projectionQueueState === "dispatching") {
    return {
      status: "dispatching",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRefWithLegacyFallback ?? null,
      retryAfterMs: QUEUE_STATUS_DISPATCHING_RETRY_MS,
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatching",
        isTerminal: false,
        statusLabel: "Dispatching...",
      },
    };
  }

  if (projectionQueueState === "queued") {
    return {
      status: "queued",
      generationId: resolvedGenerationId ?? generationId ?? "",
      sourceRef: resolvedSourceRefWithLegacyFallback ?? null,
      retryAfterMs: QUEUE_STATUS_QUEUED_RETRY_MS,
      shortpulseLifecycle: {
        taskState: "pending",
        queueState: "queued",
        isTerminal: false,
        statusLabel: "Waiting in queue...",
      },
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
      sourceRef: resolvedSourceRefWithLegacyFallback ?? null,
      retryAfterMs: QUEUE_STATUS_PRE_DISPATCH_RETRY_MS,
      shortpulseLifecycle: {
        taskState: "pending",
        queueState: "queued",
        isTerminal: false,
        statusLabel: "Waiting in queue...",
      },
    };
  }

  return { status: "not_found" };
};
