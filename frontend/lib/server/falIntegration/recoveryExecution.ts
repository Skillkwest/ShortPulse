/**
 * Shared Fal generation recovery execution engine.
 * Centralizes retrieval, persistence, settlement, and lifecycle transitions.
 */
import { settleGenerationOutcome } from "../api/generationBilling";
import { readFalRuntimeFlags } from "../api/falRuntimeFlags";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { asString } from "./falAdapter";
import {
  canTransitionToSuccess,
  collectRecoveredUrls,
  resolveRetryDelaySeconds,
} from "./recoveryExecutionRuntime";
import {
  persistRecoveryMediaFilesForGeneration,
  readExistingRecoveryMediaRows,
} from "./recoveryMediaPersistence";
import { probeProviderResult } from "./recoveryProviderProbe";

type JsonObject = Record<string, unknown>;

type GenerationRow = {
  id: string;
  user_id: string;
  request_id: string | null;
  model_id: string;
  provider: string;
  mode: string;
  prompt_text: string;
  status: string;
  metadata: JsonObject;
  recovery_attempts: number;
  failure_reason_code: string | null;
  recovery_state: string;
  completed_at: string | null;
};

export type RecoveryProbeState = "running" | "failed" | "completed";
export type RecoveryActor = "reconciler" | "admin_replay" | "webhook" | "status_proxy";
export type RecoveryResultState =
  | "recovered"
  | "already_persisted"
  | "no_media"
  | "provider_running"
  | "provider_failed"
  | "exhausted"
  | "skipped"
  | "missing_generation";

export type RecoveryObservation = {
  state: RecoveryProbeState;
  payload: JsonObject | null;
  mediaUrls: string[];
};

export type RecoveryExecutionResult = {
  ok: boolean;
  state: RecoveryResultState;
  generationId: string | null;
  requestId: string | null;
  mediaFileIds: string[];
  mediaUrls: string[];
  processed: boolean;
  note?: string;
};

type ExecuteRecoveryInput = {
  actor: RecoveryActor;
  generationId?: string | null;
  requestId?: string | null;
  userId?: string | null;
  maxAttempts?: number;
  observation?: RecoveryObservation | null;
  routeLabel: string;
};

const asObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};

const parseGenerationRow = (value: unknown): GenerationRow | null => {
  const row = asObject(value);
  const id = asString(row.id);
  const userId = asString(row.user_id);
  const modelId = asString(row.model_id);
  const provider = asString(row.provider);
  const mode = asString(row.mode);
  const promptText = asString(row.prompt_text);
  const status = asString(row.status);
  const recoveryState = asString(row.recovery_state) ?? "none";
  if (!id || !userId || !modelId || !provider || !mode || !promptText || !status) {
    return null;
  }
  return {
    id,
    user_id: userId,
    request_id: asString(row.request_id),
    model_id: modelId,
    provider,
    mode,
    prompt_text: promptText,
    status,
    metadata: asObject(row.metadata),
    recovery_attempts: typeof row.recovery_attempts === "number" ? row.recovery_attempts : 0,
    failure_reason_code: asString(row.failure_reason_code),
    recovery_state: recoveryState,
    completed_at: asString(row.completed_at),
  };
};

const readGenerationRow = async ({
  generationId,
  requestId,
  userId,
}: {
  generationId?: string | null;
  requestId?: string | null;
  userId?: string | null;
}): Promise<GenerationRow | null> => {
  const supabaseAdmin = getSupabaseAdmin();
  const selectFields = [
    "id",
    "user_id",
    "request_id",
    "model_id",
    "provider",
    "mode",
    "prompt_text",
    "status",
    "metadata",
    "recovery_attempts",
    "recovery_state",
    "failure_reason_code",
    "completed_at",
  ].join(", ");
  if (generationId) {
    let query = supabaseAdmin.from("ai_generations").select(selectFields).eq("id", generationId);
    if (userId) query = query.eq("user_id", userId);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : null;
    return parseGenerationRow(row);
  }
  if (!requestId) return null;
  let query = supabaseAdmin.from("ai_generations").select(selectFields).eq("request_id", requestId);
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  return parseGenerationRow(row);
};

const updateGenerationRecoveryState = async ({
  generation,
  updates,
}: {
  generation: GenerationRow;
  updates: Record<string, unknown>;
}) => {
  const { error } = await getSupabaseAdmin()
    .from("ai_generations")
    .update(updates)
    .eq("id", generation.id)
    .eq("user_id", generation.user_id);
  if (error) throw error;
};

/**
 * Execute shared Fal recovery flow for reconciler, admin replay, webhook, and status proxy.
 */
export const executeGenerationRecovery = async ({
  actor,
  generationId,
  requestId,
  userId,
  maxAttempts,
  observation,
  routeLabel,
}: ExecuteRecoveryInput): Promise<RecoveryExecutionResult> => {
  const generation = await readGenerationRow({ generationId, requestId, userId });
  if (!generation) {
    return {
      ok: false,
      state: "missing_generation",
      generationId: null,
      requestId: requestId ?? null,
      mediaFileIds: [],
      mediaUrls: [],
      processed: false,
      note: "generation_not_found",
    };
  }
  const effectiveMaxAttempts = Math.max(
    maxAttempts ?? readFalRuntimeFlags().reconcilerMaxAttempts,
    1
  );
  const attempts = Number(generation.recovery_attempts ?? 0);
  const nowIso = new Date().toISOString();

  if (generation.status.toLowerCase() === "success") {
    const existingRows = await readExistingRecoveryMediaRows(generation.id);
    if (existingRows.length) {
      return {
        ok: true,
        state: "already_persisted",
        generationId: generation.id,
        requestId: generation.request_id,
        mediaFileIds: existingRows.map((row) => row.id),
        mediaUrls: [],
        processed: false,
      };
    }
  }

  if (!generation.request_id) {
    await updateGenerationRecoveryState({
      generation,
      updates: {
        recovery_state: "exhausted",
        failure_reason_code: "recovery_exhausted",
        next_recovery_at: null,
        last_recovery_at: nowIso,
      },
    });
    return {
      ok: true,
      state: "exhausted",
      generationId: generation.id,
      requestId: null,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
      note: "missing_request_id",
    };
  }

  const existingRows = await readExistingRecoveryMediaRows(generation.id);
  if (existingRows.length) {
    await settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      outcome: "success",
      reason: "Recovered generation media already persisted.",
      routeLabel,
      detail: {
        actor,
        generation_id: generation.id,
        existing_media_count: existingRows.length,
      },
    });
    await updateGenerationRecoveryState({
      generation,
      updates: {
        status: "success",
        completed_at: generation.completed_at ?? nowIso,
        recovery_state: "recovered",
        next_recovery_at: null,
        last_recovery_at: nowIso,
        last_media_detected_at: nowIso,
        failure_reason_code: null,
      },
    });
    return {
      ok: true,
      state: "already_persisted",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: existingRows.map((row) => row.id),
      mediaUrls: [],
      processed: true,
    };
  }

  let currentObservation = observation ?? null;
  if (!currentObservation) {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      throw new Error("FAL_KEY is not set on the server.");
    }
    currentObservation = await probeProviderResult({
      requestId: generation.request_id,
      modelId: generation.model_id,
      apiKey,
    });
  }

  const recoveredUrls = collectRecoveredUrls({
    mediaUrls: currentObservation.mediaUrls,
    payload: currentObservation.payload,
  });

  if (currentObservation.state === "running") {
    const nextDelaySeconds = resolveRetryDelaySeconds(Math.max(attempts, 1));
    await updateGenerationRecoveryState({
      generation,
      updates: {
        recovery_state: attempts >= effectiveMaxAttempts ? "exhausted" : "queued",
        failure_reason_code: attempts >= effectiveMaxAttempts ? "recovery_exhausted" : null,
        last_recovery_at: nowIso,
        next_recovery_at:
          attempts >= effectiveMaxAttempts
            ? null
            : new Date(Date.now() + nextDelaySeconds * 1000).toISOString(),
      },
    });
    return {
      ok: true,
      state: attempts >= effectiveMaxAttempts ? "exhausted" : "provider_running",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    };
  }

  if (currentObservation.state === "failed") {
    await settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      outcome: "fail",
      reason: "Provider reported failed state during recovery execution.",
      routeLabel,
      detail: {
        actor,
        generation_id: generation.id,
      },
    });
    await updateGenerationRecoveryState({
      generation,
      updates: {
        status: "fail",
        completed_at: nowIso,
        failure_reason_code: "provider_error",
        recovery_state: "exhausted",
        last_recovery_at: nowIso,
        next_recovery_at: null,
      },
    });
    return {
      ok: true,
      state: "provider_failed",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    };
  }

  if (!recoveredUrls.length) {
    await settleGenerationOutcome({
      userId: generation.user_id,
      providerRequestId: generation.request_id,
      outcome: "fail",
      reason: "Provider terminal success without media payload.",
      routeLabel,
      detail: {
        actor,
        generation_id: generation.id,
      },
    });
    const nextDelaySeconds = resolveRetryDelaySeconds(Math.max(attempts, 1));
    await updateGenerationRecoveryState({
      generation,
      updates: {
        status: "fail",
        completed_at: nowIso,
        failure_reason_code: "terminal_success_no_media",
        recovery_state: attempts >= effectiveMaxAttempts ? "exhausted" : "queued",
        last_recovery_at: nowIso,
        next_recovery_at:
          attempts >= effectiveMaxAttempts
            ? null
            : new Date(Date.now() + nextDelaySeconds * 1000).toISOString(),
      },
    });
    return {
      ok: true,
      state: attempts >= effectiveMaxAttempts ? "exhausted" : "no_media",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: [],
      processed: true,
    };
  }

  if (
    !canTransitionToSuccess({
      status: generation.status,
      failureReasonCode: generation.failure_reason_code,
      recoveryState: generation.recovery_state,
    })
  ) {
    return {
      ok: true,
      state: "skipped",
      generationId: generation.id,
      requestId: generation.request_id,
      mediaFileIds: [],
      mediaUrls: recoveredUrls,
      processed: false,
      note: "transition_blocked",
    };
  }

  const mediaFileIds = await persistRecoveryMediaFilesForGeneration({
    generation,
    mediaUrls: recoveredUrls,
  });
  const metadata = asObject(generation.metadata);
  await settleGenerationOutcome({
    userId: generation.user_id,
    providerRequestId: generation.request_id,
    outcome: "success",
    reason: "Generation recovered with persisted media.",
    routeLabel,
    detail: {
      actor,
      generation_id: generation.id,
      media_file_count: mediaFileIds.length,
    },
  });
  await updateGenerationRecoveryState({
    generation,
    updates: {
      status: "success",
      completed_at: nowIso,
      metadata: {
        ...metadata,
        result_urls: recoveredUrls,
        media_file_ids: mediaFileIds,
        recovery_execution_at: nowIso,
        recovery_execution_actor: actor,
      },
      recovery_state: "recovered",
      last_recovery_at: nowIso,
      next_recovery_at: null,
      last_media_detected_at: nowIso,
      failure_reason_code: null,
    },
  });
  return {
    ok: true,
    state: "recovered",
    generationId: generation.id,
    requestId: generation.request_id,
    mediaFileIds,
    mediaUrls: recoveredUrls,
    processed: true,
  };
};
